const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup(payload, { status = 200, hasSession = true, hasInvalidJson = false } = {}) {
  const requests = []
  function load(path, imports = {}) {
    const source = readFileSync(path, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', '"https://api.example.com/"')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const context = {
      exports: {}, require: (name) => imports[name], URLSearchParams,
      fetch: async (url, init) => {
        requests.push({ url, init })
        return {
          status, ok: status >= 200 && status < 300,
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
  const monitoring = load('src/services/monitoring.ts', {
    './api': api, './auth': { getAdminAccessToken: () => hasSession ? 'test-access' : null },
  })
  return { ...monitoring, requests }
}

function response() {
  return {
    success: true,
    data: {
      items: [{
        incidentId: 'test-compound', status: 'ACKNOWLEDGED', location: null,
        guide: { createdAt: '2026-10-03T08:00:00Z', injuries: [{ categoryCode: 'BLEEDING' }, { categoryCode: 'BURN' }] },
      }],
      total: 51, nextOffset: 50, fetchedAt: '2026-10-03T08:00:00Z', eventCursor: 7,
    },
  }
}

test('Bearer 인증으로 활성 목록을 요청하고 커서와 페이지 정보를 유지한다', async () => {
  const service = setup(response())
  const signal = new AbortController().signal
  const result = await service.getMonitoringIncidents(0, signal)
  const request = service.requests[0]
  assert.equal(request.url, 'https://api.example.com/api/v1/monitoring/incidents?status=ACTIVE&limit=50&offset=0')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.headers.Authorization, 'Bearer test-access')
  assert.equal(request.init.signal, signal)
  assert.equal(result.total, 51)
  assert.equal(result.nextOffset, 50)
  assert.equal(result.eventCursor, 7)
  assert.equal(result.fetchedAt, response().data.fetchedAt)
})

test('복합 손상은 사건 하나로 유지하고 개인정보와 미확인 위치를 만들지 않는다', async () => {
  const result = await setup(response()).getMonitoringIncidents()
  assert.equal(result.items.length, 1)
  const incident = result.items[0]
  assert.equal(incident.id, 'test-compound')
  assert.equal(incident.category, 'BLEEDING · BURN')
  assert.equal(incident.status, 'acknowledged')
  assert.equal(incident.person, null)
  assert.equal(incident.guardian, null)
  assert.equal(incident.location, null)
  assert.equal(incident.address, '위치 미확인')
})

test('좌표가 없는 위치 보고와 유효한 좌표를 구분한다', async () => {
  const payload = response()
  payload.data.items[0].location = { latitude: null, longitude: null }
  assert.equal((await setup(payload).getMonitoringIncidents()).items[0].location, null)
  payload.data.items[0].location = { latitude: 37.5, longitude: 127 }
  const result = await setup(payload).getMonitoringIncidents()
  assert.equal(result.items[0].location.latitude, 37.5)
  assert.equal(result.items[0].location.longitude, 127)
})

test('빈 목록은 정상 결과이며 다음 페이지 요청은 지정된 offset을 사용한다', async () => {
  const payload = response()
  payload.data.items = []
  payload.data.nextOffset = null
  const service = setup(payload)
  const result = await service.getMonitoringIncidents(50)
  assert.equal(result.items.length, 0)
  assert.equal(result.nextOffset, null)
  assert.ok(service.requests[0].url.endsWith('offset=50'))
})

test('세션이 없으면 네트워크 요청 전에 인증 오류를 반환한다', async () => {
  const service = setup(response(), { hasSession: false })
  await assert.rejects(service.getMonitoringIncidents(), (error) => error.status === 401 && error.errorCode === 'AUTH_REQUIRED')
  assert.equal(service.requests.length, 0)
})

for (const status of [401, 403, 500]) {
  test(`서버 오류 ${status}의 status, errorCode, message를 보존한다`, async () => {
    const service = setup({ success: false, errorCode: 'MONITORING_DENIED', message: '서버에서 제공한 오류' }, { status })
    await assert.rejects(service.getMonitoringIncidents(), (error) => {
      assert.equal(error.status, status)
      assert.equal(error.errorCode, 'MONITORING_DENIED')
      assert.equal(error.message, '서버에서 제공한 오류')
      return true
    })
  })
}

test('성공 HTTP 상태의 실패 응답도 서버 오류를 유지한다', async () => {
  const service = setup({ success: false, message: '조회 거부', errorCode: 'DENIED' })
  await assert.rejects(service.getMonitoringIncidents(), (error) => error.status === 200 && error.errorCode === 'DENIED' && error.message === '조회 거부')
})

test('잘못된 응답과 좌표는 가짜 빈 목록으로 처리하지 않는다', async () => {
  const invalidPayloads = [null, { success: true, data: {} }]
  for (const mutate of [
    (data) => { data.eventCursor = -1 },
    (data) => { data.nextOffset = 0 },
    (data) => { data.items[0].status = 'toString' },
    (data) => { data.items[0].guide.createdAt = 'invalid-date' },
    (data) => { data.items[0].location = { latitude: 200, longitude: 127 } },
  ]) {
    const payload = response()
    mutate(payload.data)
    invalidPayloads.push(payload)
  }
  for (const payload of invalidPayloads) {
    await assert.rejects(setup(payload).getMonitoringIncidents(), (error) => error.errorCode === 'INVALID_RESPONSE')
  }
  await assert.rejects(setup(null, { hasInvalidJson: true }).getMonitoringIncidents(), (error) => error.errorCode === 'INVALID_RESPONSE')
})
