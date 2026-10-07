const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function streamOf(chunks) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      controller.close()
    },
  })
}

function setup({ status = 200, contentType = 'text/event-stream', chunks = [], json = null, hasSession = true } = {}) {
  const requests = []
  const warnings = []
  function load(path, imports = {}) {
    const source = readFileSync(path, 'utf8').replace(/import\.meta\.env\.VITE_API_BASE_URL/g, '"https://api.example.com/"')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const context = {
      exports: {}, require: (name) => imports[name], TextDecoder, console: { info: () => {}, warn: (...args) => warnings.push(args) },
      fetch: async (url, init) => {
        requests.push({ url, init })
        return {
          status, ok: status >= 200 && status < 300,
          headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
          body: streamOf(chunks),
          json: async () => {
            if (json === null) throw new SyntaxError('invalid JSON')
            return json
          },
        }
      },
    }
    vm.runInNewContext(code, context)
    return context.exports
  }
  const api = load('src/services/api.ts')
  const events = load('src/services/monitoringEvents.ts', {
    './api': api, './auth': { getAdminAccessToken: () => hasSession ? 'test-access' : null },
  })
  return { ...events, requests, warnings }
}

function guideEvent(eventId, sessionId) {
  return `event: guide.created\nid: ${eventId}\ndata: ${JSON.stringify({ eventId, guide: { sessionId, kind: 'SINGLE' } })}\n\n`
}

test('SSE 파서는 청크 경계·CRLF·heartbeat·여러 줄 data를 처리한다', () => {
  const messages = []
  const parser = setup().createSseParser((message) => messages.push(message))
  parser.push(': heartbeat\n\nevent: guide.cre')
  parser.push('ated\r')
  parser.push('\ndata: {"a":\ndata: 1}\nid: 3\r\n')
  parser.push('\r\n')
  parser.push('data: plain\n\n')
  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    { event: 'guide.created', data: '{"a":\n1}', id: '3' },
    { event: 'message', data: 'plain', id: null },
  ])
})

test('Bearer 인증과 Last-Event-ID 헤더로 연결하고 guide.created만 전달한다', async () => {
  const service = setup({ chunks: [': ping\n\n', guideEvent(8, 'session-a'), 'event: other\ndata: {}\n\n', guideEvent(9, 'session-b')] })
  const received = []
  let opened = false
  const signal = new AbortController().signal
  await service.streamMonitoringEvents({ lastEventId: 7, signal, onOpen: () => { opened = true }, onEvent: (event) => received.push(event) })
  const request = service.requests[0]
  assert.equal(request.url, 'https://api.example.com/api/v1/monitoring/events')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.headers.Authorization, 'Bearer test-access')
  assert.equal(request.init.headers['Last-Event-ID'], '7')
  assert.equal(request.init.headers.Accept, 'text/event-stream')
  assert.equal(request.init.signal, signal)
  assert.ok(opened)
  assert.deepEqual(JSON.parse(JSON.stringify(received)), [{ eventId: 8, sessionId: 'session-a' }, { eventId: 9, sessionId: 'session-b' }])
})

test('청크 경계에서 잘린 한글도 깨지지 않는다', async () => {
  const bytes = new TextEncoder().encode(guideEvent(1, '사건-가'))
  const middle = bytes.indexOf(0xea) + 1 // '사' 또는 '가'의 첫 바이트 뒤에서 자른다
  const service = setup({ chunks: [bytes.slice(0, middle), bytes.slice(middle)] })
  const received = []
  await service.streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: (event) => received.push(event) })
  assert.equal(received[0].sessionId, '사건-가')
})

test('형식이 잘못된 이벤트는 건너뛰고 다음 이벤트를 계속 받는다', async () => {
  const service = setup({ chunks: [
    'event: guide.created\ndata: not-json\n\n',
    `event: guide.created\ndata: ${JSON.stringify({ eventId: 0, guide: { sessionId: 'x' } })}\n\n`,
    `event: guide.created\ndata: ${JSON.stringify({ eventId: 2, guide: {} })}\n\n`,
    guideEvent(3, 'session-ok'),
  ] })
  const received = []
  await service.streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: (event) => received.push(event) })
  assert.equal(received.map((event) => event.eventId).join(), '3')
  assert.equal(service.warnings.length, 3)
})

test('401/403/400 연결 실패는 서버 오류 코드를 보존한다', async () => {
  const failure = (code) => ({ success: false, error: { code, message: code, details: [] } })
  await assert.rejects(
    setup({ status: 401, contentType: 'application/json', json: failure('UNAUTHENTICATED') })
      .streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: () => {} }),
    (error) => error.status === 401 && error.errorCode === 'UNAUTHENTICATED' && error.message === '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  )
  await assert.rejects(
    setup({ status: 400, contentType: 'application/json', json: failure('INVALID_REQUEST') })
      .streamMonitoringEvents({ lastEventId: 999, signal: new AbortController().signal, onEvent: () => {} }),
    (error) => error.status === 400 && error.errorCode === 'INVALID_REQUEST',
  )
  await assert.rejects(
    setup({ status: 502, contentType: 'text/html' }).streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: () => {} }),
    (error) => error.status === 502 && error.message === '요청에 실패했습니다. (502)',
  )
})

test('SSE가 아닌 성공 응답은 형식 오류로 처리한다', async () => {
  await assert.rejects(
    setup({ contentType: 'text/html' }).streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: () => {} }),
    (error) => error.errorCode === 'INVALID_RESPONSE',
  )
})

test('세션이 없으면 연결 요청 전에 인증 오류를 반환한다', async () => {
  const service = setup({ hasSession: false })
  await assert.rejects(
    service.streamMonitoringEvents({ lastEventId: 0, signal: new AbortController().signal, onEvent: () => {} }),
    (error) => error.status === 401 && error.errorCode === 'AUTH_REQUIRED',
  )
  assert.equal(service.requests.length, 0)
})
