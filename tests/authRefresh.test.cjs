const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const SESSION_KEY = 'erags.admin.session'
const REFRESH_URL = 'https://api.example.com/api/auth/refresh'

function session(expiresInMs) {
  return {
    access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 3600, expires_at: Date.now() + expiresInMs,
    user: { id: 1, email: 'admin@example.com', role: 'admin' },
  }
}

function tokenSet(suffix = 'new') {
  return { success: true, data: { access_token: `${suffix}-access`, refresh_token: `${suffix}-refresh`, expires_in: 3600 } }
}

// responses: 재발급 요청에 순서대로 돌려줄 응답. { status, body } 또는 'network'(네트워크 오류)
function setup(initialSession, responses = []) {
  const stored = new Map(initialSession ? [[SESSION_KEY, JSON.stringify(initialSession)]] : [])
  const requests = []
  function load(path, imports = {}) {
    const source = readFileSync(path, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', '"https://api.example.com/"')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const context = {
      exports: {}, require: (name) => imports[name], console: { info: () => {}, warn: () => {} },
      sessionStorage: {
        getItem: (key) => stored.get(key) ?? null,
        removeItem: (key) => stored.delete(key),
        setItem: (key, value) => stored.set(key, value),
      },
      fetch: async (url, init) => {
        requests.push({ url, init })
        const next = responses.shift()
        if (!next || next === 'network') throw new TypeError('Failed to fetch')
        if (next.wait) await next.wait
        return { status: next.status, ok: next.status >= 200 && next.status < 300, json: async () => next.body }
      },
    }
    vm.runInNewContext(code, context)
    return context.exports
  }
  const api = load('src/services/api.ts')
  const auth = load('src/services/auth.ts', { './api': api })
  return { ...auth, api, stored, requests, saved: () => JSON.parse(stored.get(SESSION_KEY) ?? 'null') }
}

const rejected = { status: 401, body: { success: false, error: { code: 'ACCESS_TOKEN_INVALID', message: '유효하지 않거나 만료된 토큰입니다.', details: [] } } }

test('Refresh Token으로 재발급하고 사용자 정보는 유지한 채 토큰과 만료 시각을 갱신한다', async () => {
  const auth = setup(session(10_000), [{ status: 200, body: tokenSet() }])
  assert.equal(await auth.refreshAdminSession(), 'new-access')
  assert.equal(auth.requests[0].url, REFRESH_URL)
  assert.equal(auth.requests[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(auth.requests[0].init.body), { refresh_token: 'old-refresh' })
  const saved = auth.saved()
  assert.equal(saved.access_token, 'new-access')
  assert.equal(saved.refresh_token, 'new-refresh')
  assert.equal(saved.user.email, 'admin@example.com')
  assert.ok(saved.expires_at > Date.now() + 3_500_000)
})

test('동시에 여러 번 재발급을 요청해도 서버에는 한 번만 보낸다', async () => {
  const auth = setup(session(10_000), [{ status: 200, body: tokenSet() }])
  const tokens = await Promise.all([auth.refreshAdminSession(), auth.refreshAdminSession(), auth.refreshAdminSession()])
  assert.deepEqual(tokens, ['new-access', 'new-access', 'new-access'])
  assert.equal(auth.requests.length, 1)
})

test('재발급이 거절되면 세션을 지워 다시 로그인하게 한다', async () => {
  const auth = setup(session(10_000), [rejected])
  await assert.rejects(auth.refreshAdminSession(), (error) => error.status === 401)
  assert.equal(auth.saved(), null)
})

test('만료가 가까운 토큰은 요청 전에 재발급한 토큰으로 요청한다', async () => {
  const auth = setup(session(30_000), [{ status: 200, body: tokenSet() }])
  const used = []
  assert.equal(await auth.withAdminToken(async (token) => { used.push(token); return 'ok' }), 'ok')
  assert.deepEqual(used, ['new-access'])
})

test('유효한 토큰은 재발급 없이 그대로 쓴다', async () => {
  const auth = setup(session(30 * 60_000))
  const used = []
  await auth.withAdminToken(async (token) => { used.push(token) })
  assert.deepEqual(used, ['old-access'])
  assert.equal(auth.requests.length, 0)
})

test('요청이 401이면 한 번만 재발급해서 다시 요청하고, 그래도 401이면 오류를 그대로 전달한다', async () => {
  const auth = setup(session(30 * 60_000), [{ status: 200, body: tokenSet() }])
  const used = []
  const result = await auth.withAdminToken(async (token) => {
    used.push(token)
    if (token === 'old-access') throw new auth.api.ApiRequestError(401, '만료', 'UNAUTHENTICATED')
    return 'ok'
  })
  assert.equal(result, 'ok')
  assert.deepEqual(used, ['old-access', 'new-access'])

  const always401 = setup(session(30 * 60_000), [{ status: 200, body: tokenSet() }])
  let calls = 0
  await assert.rejects(always401.withAdminToken(async () => {
    calls += 1
    throw new always401.api.ApiRequestError(401, '만료', 'UNAUTHENTICATED')
  }), (error) => error.status === 401)
  assert.equal(calls, 2)
  assert.equal(always401.requests.length, 1)
})

test('401이 아닌 오류는 재발급하지 않는다', async () => {
  const auth = setup(session(30 * 60_000))
  await assert.rejects(auth.withAdminToken(async () => {
    throw new auth.api.ApiRequestError(403, '권한 없음', 'FORBIDDEN')
  }), (error) => error.status === 403)
  assert.equal(auth.requests.length, 0)
})

test('세션이 없으면 요청 전에 인증 오류를 반환한다', async () => {
  const auth = setup(null)
  let called = false
  await assert.rejects(auth.withAdminToken(async () => { called = true }), (error) => error.status === 401 && error.errorCode === 'AUTH_REQUIRED')
  assert.equal(called, false)
})

test('만료된 Access Token도 Refresh Token으로 세션을 복구하고, 거절되면 null, 네트워크 오류면 세션을 유지한 채 reject한다', async () => {
  const far = setup(session(30 * 60_000))
  assert.equal(await far.ensureFreshAdminSession(), far.saved().expires_at)
  assert.equal(far.requests.length, 0)

  const expired = setup(session(-60_000), [{ status: 200, body: tokenSet() }])
  assert.equal(expired.getAdminSessionExpiresAt(), null)
  assert.equal(expired.hasStoredAdminSession(), true)
  const next = await expired.ensureFreshAdminSession()
  assert.ok(next > Date.now() + 3_500_000)

  const denied = setup(session(-60_000), [rejected])
  assert.equal(await denied.ensureFreshAdminSession(), null)
  assert.equal(denied.hasStoredAdminSession(), false)

  const offline = setup(session(30_000), ['network'])
  await assert.rejects(offline.ensureFreshAdminSession())
  assert.equal(offline.saved().access_token, 'old-access')
})

test('재발급 응답 형식이 잘못되면 세션을 지운다', async () => {
  const auth = setup(session(10_000), [{ status: 200, body: { success: true, data: { access_token: 'x' } } }])
  await assert.rejects(auth.refreshAdminSession(), (error) => error.errorCode === 'INVALID_RESPONSE')
  assert.equal(auth.saved(), null)
})

test('로그아웃은 세션을 지우고 서버에 Refresh Token 폐기를 keepalive로 요청한다', async () => {
  const auth = setup(session(30 * 60_000), [{ status: 200, body: { success: true, data: null } }])
  await auth.logoutAdmin()
  assert.equal(auth.saved(), null)
  assert.equal(auth.requests[0].url, 'https://api.example.com/api/auth/logout')
  assert.equal(auth.requests[0].init.method, 'POST')
  assert.equal(auth.requests[0].init.keepalive, true)
  assert.deepEqual(JSON.parse(auth.requests[0].init.body), { refresh_token: 'old-refresh' })
})

test('서버 폐기에 실패해도 브라우저 세션은 지우고, 세션이 없으면 요청하지 않는다', async () => {
  const offline = setup(session(30 * 60_000), ['network'])
  await offline.logoutAdmin()
  assert.equal(offline.saved(), null)

  const empty = setup(null)
  await empty.logoutAdmin()
  assert.equal(empty.requests.length, 0)
})

test('재발급 중에 로그아웃하면 재발급 결과로 세션을 되살리지 않는다', async () => {
  let respond
  const wait = new Promise((resolve) => { respond = resolve })
  const auth = setup(session(10_000), [{ status: 200, body: tokenSet(), wait }])
  const refreshing = auth.refreshAdminSession()
  await auth.logoutAdmin()
  respond()
  await assert.rejects(refreshing, (error) => error.errorCode === 'AUTH_REQUIRED')
  assert.equal(auth.saved(), null)
  assert.equal(auth.requests[0].url, REFRESH_URL)
})
