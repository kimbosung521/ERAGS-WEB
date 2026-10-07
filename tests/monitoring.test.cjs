const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const CATEGORIES_URL = 'https://api.example.com/api/v2/first-aid/categories'

function setup(payload, {
  status = 200, hasSession = true, hasInvalidJson = false, categories = { success: true, data: [] }, categoryStatus = 200,
} = {}) {
  const requests = []
  const categoryRequests = []
  function load(path, imports = {}) {
    const source = readFileSync(path, 'utf8').replace('import.meta.env.VITE_API_BASE_URL', '"https://api.example.com/"')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const context = {
      exports: {}, require: (name) => imports[name], URLSearchParams, console: { warn: () => {}, info: () => {} }, setTimeout, clearTimeout,
      fetch: async (url, init) => {
        if (url === CATEGORIES_URL) {
          categoryRequests.push({ url, init })
          if (categories === 'hang') return new Promise(() => {})
          return { status: categoryStatus, ok: categoryStatus >= 200 && categoryStatus < 300, json: async () => categories }
        }
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
    './api': api, './auth': {
      withAdminToken: (request) => hasSession
        ? request('test-access')
        : Promise.reject(new api.ApiRequestError(401, '로그인이 필요합니다.', 'AUTH_REQUIRED')),
    },
  })
  return { ...monitoring, requests, categoryRequests }
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
  const result = await service.getMonitoringIncidents(undefined, 0, signal)
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
  assert.equal('person' in incident, false)
  assert.equal('guardian' in incident, false)
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
  const result = await service.getMonitoringIncidents(undefined, 50)
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

test('잘못된 응답 구조는 가짜 빈 목록으로 처리하지 않는다', async () => {
  const invalidPayloads = [null, { success: true, data: {} }]
  for (const mutate of [
    (data) => { data.eventCursor = -1 },
    (data) => { data.nextOffset = 0 },
    (data) => { data.items = {} },
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

test('형식이 잘못된 사건만 제외하고 나머지 사건은 유지한다', async () => {
  for (const mutate of [
    (item) => { item.status = 'toString' },
    (item) => { item.incidentId = ' ' },
    (item) => { item.guide.createdAt = 'invalid-date' },
    (item) => { item.guide.injuries = [{ categoryCode: 1 }] },
    (item) => { item.location = { latitude: 200, longitude: 127 } },
    (item) => { item.location = { latitude: 37.5, longitude: null } },
  ]) {
    const payload = response()
    const broken = structuredClone(payload.data.items[0])
    broken.incidentId = 'test-broken'
    mutate(broken)
    payload.data.items.push(broken, null)
    const result = await setup(payload).getMonitoringIncidents()
    assert.equal(result.items.map((item) => item.id).join(), 'test-compound')
    assert.equal(result.invalidCount, 2)
  }
})

test('문서상 필수인 location 필드가 없으면 해당 사건을 제외한다', async () => {
  assert.equal((await setup(response()).getMonitoringIncidents()).invalidCount, 0)
  const payload = response()
  delete payload.data.items[0].location
  const result = await setup(payload).getMonitoringIncidents()
  assert.equal(result.items.length, 0)
  assert.equal(result.invalidCount, 1)
})

test('위치 보고 실패 객체(좌표 null)는 위치 미확인으로 표시한다', async () => {
  const payload = response()
  payload.data.items[0].location = {
    status: 'DENIED', observedAt: '2026-10-03T08:00:00Z', receivedAt: '2026-10-03T08:00:01Z',
    latitude: null, longitude: null, accuracy: null,
  }
  const incident = (await setup(payload).getMonitoringIncidents()).items[0]
  assert.equal(incident.location, null)
  assert.equal(incident.address, '위치 미확인')
})

test('문서 형식의 오류 envelope에서 code를 보존하고 코드만 있는 message는 안내 문구로 바꾼다', async () => {
  const failure = (code, message) => ({ success: false, error: { code, message, details: [] } })
  await assert.rejects(setup(failure('UNAUTHENTICATED', 'UNAUTHENTICATED'), { status: 401 }).getMonitoringIncidents(), (error) => {
    assert.equal(error.status, 401)
    assert.equal(error.errorCode, 'UNAUTHENTICATED')
    assert.equal(error.message, '로그인이 만료되었습니다. 다시 로그인해 주세요.')
    return true
  })
  await assert.rejects(setup(failure('HTTPS_REQUIRED', 'HTTPS_REQUIRED'), { status: 403 }).getMonitoringIncidents(), (error) => error.errorCode === 'HTTPS_REQUIRED' && error.message === '보안 연결(HTTPS)로 접속해야 합니다.')
  await assert.rejects(setup(failure('INTERNAL_ERROR', '요청을 처리할 수 없습니다.'), { status: 500 }).getMonitoringIncidents(), (error) => error.errorCode === 'INTERNAL_ERROR' && error.message === '요청을 처리할 수 없습니다.')
})

test('카테고리 코드를 응급처치 대분류 이름으로 표시한다', async () => {
  const service = setup(response(), { categories: { success: true, data: [{ category_code: 'BLEEDING', category_name: '출혈' }] } })
  const result = await service.getMonitoringIncidents()
  assert.equal(result.items[0].category, '출혈 · BURN')
  assert.equal(service.categoryRequests[0].init.headers.Authorization, undefined)
})

test('카테고리 조회가 실패하거나 지연돼도 목록은 코드로 표시한다', async () => {
  const failed = await setup(response(), { categoryStatus: 500, categories: { success: false, error: { code: 'INTERNAL_ERROR', message: 'x', details: [] } } }).getMonitoringIncidents()
  assert.equal(failed.items[0].category, 'BLEEDING · BURN')
  const startedAt = Date.now()
  const slow = await setup(response(), { categories: 'hang' }).getMonitoringIncidents()
  assert.equal(slow.items[0].category, 'BLEEDING · BURN')
  assert.ok(Date.now() - startedAt < 3_000)
})

test('선택한 상태와 기간을 쿼리로 보내고 비어 있는 기간은 보내지 않는다', async () => {
  const payload = response()
  payload.data.nextOffset = null
  const service = setup(payload)
  await service.getMonitoringIncidents({ status: 'CLOSED', from: '2026-10-03T00:00:00+09:00', to: '2026-10-03T23:59:59+09:00' }, 0)
  await service.getMonitoringIncidents({ status: 'ALL', from: null, to: null }, 50)
  const first = new URL(service.requests[0].url).searchParams
  assert.equal(first.get('status'), 'CLOSED')
  assert.equal(first.get('from'), '2026-10-03T00:00:00+09:00')
  assert.equal(first.get('to'), '2026-10-03T23:59:59+09:00')
  assert.equal(service.requests[1].url, 'https://api.example.com/api/v1/monitoring/incidents?status=ALL&limit=50&offset=50')
})

function detailResponse() {
  return {
    success: true,
    data: {
      incidentId: 'test/compound', status: 'RESPONDING', revision: 2, updatedAt: '2026-10-03T08:00:00Z',
      guide: {
        sessionId: 'test/compound', kind: 'COMPOUND', createdAt: '2026-10-03T08:00:00Z', generatedAt: '2026-10-03T08:00:01Z',
        generationStatus: 'COMPLETE', ageGroup: 'ADULT', call119Required: true, redFlags: ['TEST_ONLY_RISK'], blockedReasons: [],
        injuries: [{
          injuryId: 'bleeding-1', categoryCode: 'BLEEDING', subtypeCode: 'BLEEDING_SEVERE', severityCode: 'HIGH', summary: null,
          redFlags: [], reasons: [], missingInputs: [], disposition: 'ACTIVE', steps: [],
        }],
        execution: [{
          executionStepId: 'plan:1', instruction: '시험용 단계', sources: [{ injuryId: 'bleeding-1', stepId: 101 }],
          supplies: [{ itemId: 1, itemName: '시험용 거즈', quantity: 2 }],
        }],
      },
      location: {
        status: 'AVAILABLE', latitude: 37.55, longitude: 126.93, accuracy: 20,
        observedAt: '2026-10-03T08:00:00Z', receivedAt: '2026-10-03T08:00:01Z',
      },
      progress: {
        source: 'COMPOUND_SERVER', status: 'IN_PROGRESS', revision: 1, currentStepId: 'plan:1', blockedReason: null,
        completedStepIds: [], heldInjuries: [], usedSupplies: [{ itemId: 1, itemName: '시험용 거즈', quantity: null }], records: [],
      },
      history: [{ status: 'ACKNOWLEDGED', at: '2026-10-03T08:00:00Z', actorId: '1', reason: null }],
    },
  }
}

test('사건 상세는 incidentId를 경로에 인코딩해 Bearer 인증으로 요청한다', async () => {
  const service = setup(detailResponse())
  const signal = new AbortController().signal
  const detail = await service.getMonitoringIncident('test/compound', signal)
  const request = service.requests[0]
  assert.equal(request.url, 'https://api.example.com/api/v1/monitoring/incidents/test%2Fcompound')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.headers.Authorization, 'Bearer test-access')
  assert.equal(request.init.signal, signal)
  assert.equal(detail.id, 'test/compound')
  assert.equal(detail.status, 'responding')
  assert.equal(detail.revision, 2)
  assert.equal(detail.history[0].status, 'acknowledged')
  assert.equal(detail.guide.execution[0].supplies[0].quantity, 2)
  assert.equal(detail.progress.usedSupplies[0].quantity, null)
  assert.equal(detail.location.accuracy, 20)
})

test('사건 상세의 사용 기록 미확인(null)과 위치 보고 전(null)을 그대로 유지한다', async () => {
  const payload = detailResponse()
  payload.data.progress = {
    source: 'UNKNOWN', status: null, revision: null, currentStepId: null, blockedReason: null,
    completedStepIds: [], heldInjuries: [], usedSupplies: null, records: [],
  }
  payload.data.location = null
  const detail = await setup(payload).getMonitoringIncident('test/compound')
  assert.equal(detail.progress.usedSupplies, null)
  assert.equal(detail.progress.source, 'UNKNOWN')
  assert.equal(detail.location, null)
})

test('사건 상세의 손상 카테고리를 대분류 이름으로 표시한다', async () => {
  const service = setup(detailResponse(), { categories: { success: true, data: [{ category_code: 'BLEEDING', category_name: '출혈' }] } })
  assert.equal((await service.getMonitoringIncident('test/compound')).guide.injuries[0].category, '출혈')
})

test('없는 사건(404)은 안내 문구와 코드를 보존한다', async () => {
  const service = setup({ success: false, error: { code: 'INCIDENT_NOT_FOUND', message: 'INCIDENT_NOT_FOUND', details: [] } }, { status: 404 })
  await assert.rejects(service.getMonitoringIncident('missing'), (error) => (
    error.status === 404 && error.errorCode === 'INCIDENT_NOT_FOUND' && error.message === '해당 사건을 찾을 수 없습니다.'
  ))
})

test('사건 상세 형식이 잘못되면 일부만 보여주지 않고 오류로 처리한다', async () => {
  for (const mutate of [
    (data) => { data.status = 'toString' },
    (data) => { data.revision = -1 },
    (data) => { data.guide.execution = null },
    (data) => { data.progress.completedStepIds = [1] },
    (data) => { data.location.longitude = null },
    (data) => { data.history = [{ status: 'NEW', at: 'invalid', actorId: '1', reason: null }] },
  ]) {
    const payload = detailResponse()
    mutate(payload.data)
    await assert.rejects(setup(payload).getMonitoringIncident('test/compound'), (error) => error.errorCode === 'INVALID_RESPONSE')
  }
  await assert.rejects(setup({ success: true }).getMonitoringIncident('x'), (error) => error.errorCode === 'INVALID_RESPONSE')
})

test('세션이 없으면 상세도 네트워크 요청 전에 인증 오류를 반환한다', async () => {
  const service = setup(detailResponse(), { hasSession: false })
  await assert.rejects(service.getMonitoringIncident('x'), (error) => error.status === 401 && error.errorCode === 'AUTH_REQUIRED')
  assert.equal(service.requests.length, 0)
})
