const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup(payload, { status = 200, hasInvalidJson = false } = {}) {
  const stored = new Map([['erags.admin.session', 'previous-session']])
  const requests = []
  function load(path, imports = {}) {
    const source = readFileSync(path, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', '"https://api.example.com/"')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const context = {
      exports: {},
      require: (name) => imports[name],
      sessionStorage: {
        getItem: (key) => stored.get(key) ?? null,
        removeItem: (key) => stored.delete(key),
        setItem: (key, value) => stored.set(key, value),
      },
      window: { location: { pathname: '/' } },
      fetch: async (url, init) => {
        requests.push({ url, init })
        return {
          status,
          ok: status >= 200 && status < 300,
          json: async () => {
            if (hasInvalidJson) throw new SyntaxError('invalid JSON')
            return payload
          },
        }
      },
    }
    vm.runInNewContext(code, context)
    return context.exports
  }
  const api = load('src/services/api.ts')
  const auth = load('src/services/auth.ts', { './api': api })
  function renderApp() {
    const app = load('src/App.tsx', {
      react: { useState: (initialize) => [initialize(), () => {}], useEffect: () => {} },
      'react/jsx-runtime': { jsx: (type) => type },
      './services/auth': auth,
      './screens/emergency/EmergencyScreen': { default: 'EmergencyScreen' },
      './screens/login/LoginScreen': { default: 'LoginScreen' },
    })
    return app.default()
  }
  return { ...auth, stored, requests, api, renderApp }
}

function response(role = 'admin') {
  return {
    success: true,
    data: {
      access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600,
      user: { id: 1, email: 'admin@example.com', name: '관리자', role },
    },
  }
}

const credentials = { email: 'admin@example.com', password: 'test-password' }

test('admin만 세션을 저장하고 지정한 로그인 API에 이메일과 비밀번호를 전송한다', async () => {
  const auth = setup(response())
  await auth.loginAdmin(credentials)
  const saved = JSON.parse(auth.stored.get('erags.admin.session'))
  assert.equal(saved.user.role, 'admin')
  assert.equal(saved.access_token, 'test-access')
  assert.equal(saved.refresh_token, 'test-refresh')
  assert.equal(saved.expires_in, 3600)
  assert.ok(saved.expires_at > Date.now())
  assert.equal(auth.requests[0].url, 'https://api.example.com/api/auth/login')
  assert.equal(auth.requests[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(auth.requests[0].init.body), credentials)
  assert.equal('password' in saved, false)
})

test('로그인하지 않은 상태에서 관제 주소에 직접 접속해도 로그인 화면만 렌더링한다', () => {
  const auth = setup(response())
  auth.stored.clear()
  assert.equal(auth.getAdminSessionExpiresAt(), null)
  assert.equal(auth.renderApp(), 'LoginScreen')
})

test('관리자 로그인 후 새로고침해도 유효한 세션이면 관제 화면을 렌더링한다', async () => {
  const auth = setup(response())
  await auth.loginAdmin(credentials)
  assert.ok(auth.getAdminSessionExpiresAt() > Date.now())
  assert.equal(auth.renderApp(), 'EmergencyScreen')
})

test('로그아웃하면 토큰이 삭제되고 관제 주소에 다시 접속해도 로그인 화면을 표시한다', async () => {
  const auth = setup(response())
  await auth.loginAdmin(credentials)
  assert.equal(auth.renderApp(), 'EmergencyScreen')
  auth.clearAdminSession()
  assert.equal(auth.stored.has('erags.admin.session'), false)
  assert.equal(auth.getAdminSessionExpiresAt(), null)
  assert.equal(auth.renderApp(), 'LoginScreen')
  auth.clearAdminSession()
  assert.equal(auth.renderApp(), 'LoginScreen')
})

test('만료·잘못된 JSON·일반 사용자·빈 토큰·만료 시간 누락 세션은 관제 화면을 차단한다', async () => {
  const auth = setup(response())
  await auth.loginAdmin(credentials)
  const session = JSON.parse(auth.stored.get('erags.admin.session'))
  const legacySession = { ...session }
  delete legacySession.expires_at
  for (const invalid of [
    'invalid-json',
    JSON.stringify({ ...session, expires_at: Date.now() - 1 }),
    JSON.stringify({ ...session, user: { ...session.user, role: 'user' } }),
    JSON.stringify({ ...session, access_token: '' }),
    JSON.stringify(legacySession),
  ]) {
    auth.stored.set('erags.admin.session', invalid)
    assert.equal(auth.getAdminSessionExpiresAt(), null)
    assert.equal(auth.renderApp(), 'LoginScreen')
  }
})

for (const role of ['user', undefined, 'ADMIN', 'unexpected']) {
  test(`관리자 외 권한(${String(role)})은 기존 세션을 지우고 새 토큰을 저장하지 않는다`, async () => {
    const payload = response()
    payload.data.user.role = role
    const auth = setup(payload)
    await assert.rejects(auth.loginAdmin(credentials), (error) => error.errorCode === 'ADMIN_ONLY')
    assert.equal(auth.stored.size, 0)
  })
}

test('서버의 status, errorCode, message를 유지한다', async () => {
  const auth = setup({ success: false, errorCode: 'INVALID_CREDENTIALS', message: '비밀번호가 틀렸습니다.' }, { status: 401 })
  await assert.rejects(auth.loginAdmin(credentials), (error) => {
    assert.equal(error.status, 401)
    assert.equal(error.errorCode, 'INVALID_CREDENTIALS')
    assert.equal(error.message, '비밀번호가 틀렸습니다.')
    return true
  })
  assert.equal(auth.stored.size, 0)
})

test('성공 HTTP 상태라도 success false이면 로그인하지 않는다', async () => {
  const auth = setup({ ...response(), success: false, message: '로그인 거부' })
  await assert.rejects(auth.loginAdmin(credentials), (error) => error.message === '로그인 거부')
  assert.equal(auth.stored.size, 0)
})

test('잘못된 JSON이나 누락된 토큰은 세션을 저장하지 않는다', async () => {
  const payload = response()
  delete payload.data.access_token
  for (const auth of [setup(payload), setup(null, { hasInvalidJson: true }), setup({ success: true })]) {
    await assert.rejects(auth.loginAdmin(credentials), (error) => error.errorCode === 'INVALID_RESPONSE')
    assert.equal(auth.stored.size, 0)
  }
})
