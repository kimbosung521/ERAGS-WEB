const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function setup(key = 'test-key') {
  const scripts = []
  const timers = new Set()
  const geocodeCalls = []
  const maps = {
    load: (callback) => callback(),
    services: {
      Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
      Geocoder: class { coord2Address(x, y, callback) { geocodeCalls.push({ x, y, callback }) } },
    },
  }
  const source = readFileSync('src/services/kakaoMaps.ts', 'utf8')
    .replace('import.meta.env.VITE_KAKAO_MAP_APP_KEY', JSON.stringify(key))
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = {
    exports: {},
    window: {
      kakao: { maps },
      setTimeout: (callback) => { timers.add(callback); return callback },
      clearTimeout: (callback) => timers.delete(callback),
    },
    document: {
      createElement: () => ({ remove() { this.isRemoved = true } }),
      head: { appendChild: (script) => scripts.push(script) },
    },
  }
  vm.runInNewContext(code, context)
  return { load: context.exports.loadKakaoMaps, reverseGeocode: context.exports.reverseGeocode, scripts, timers, maps, geocodeCalls }
}

test('동시 호출은 SDK 한 번만 로딩하고 완료 후 재사용한다', async () => {
  const { load, scripts, timers, maps } = setup()
  const first = load()
  assert.equal(load(), first)
  assert.equal(scripts.length, 1)
  scripts[0].onload()
  assert.equal(await first, maps)
  assert.equal(await load(), maps)
  assert.equal(timers.size, 0)
})

test('실패 후 스크립트와 타이머를 정리하고 다시 시도할 수 있다', async () => {
  const { load, scripts, timers, maps } = setup()
  const first = load()
  scripts[0].onerror()
  await assert.rejects(first, /불러오지 못했습니다/)
  assert.equal(scripts[0].isRemoved, true)
  assert.equal(timers.size, 0)
  const retry = load()
  scripts[1].onload()
  assert.equal(await retry, maps)
})

test('키 누락과 SDK 응답 지연을 명시적으로 실패 처리한다', async () => {
  const missing = setup('')
  await assert.rejects(missing.load(), /키가 설정되지/)
  assert.equal(missing.scripts.length, 0)
  const slow = setup()
  const pending = slow.load()
  ;[...slow.timers][0]()
  await assert.rejects(pending, /불러오지 못했습니다/)
  assert.equal(slow.scripts[0].isRemoved, true)
})

test('역지오코딩은 건물명과 도로명 주소를 우선하고 같은 좌표는 한 번만 조회한다', async () => {
  const { reverseGeocode, scripts, geocodeCalls } = setup()
  const first = reverseGeocode(37.5, 127.1)
  assert.equal(reverseGeocode(37.5, 127.1), first)
  scripts[0].onload()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(geocodeCalls.length, 1)
  assert.deepEqual([geocodeCalls[0].x, geocodeCalls[0].y], [127.1, 37.5])
  geocodeCalls[0].callback([{ address: { address_name: '지번' }, road_address: { address_name: '도로명', building_name: '건물' } }], 'OK')
  assert.equal(await first, '건물 (도로명)')
  assert.equal(await reverseGeocode(37.5, 127.1), '건물 (도로명)')
  assert.equal(geocodeCalls.length, 1)
  const noBuilding = reverseGeocode(37.6, 127.1)
  await new Promise((resolve) => setImmediate(resolve))
  geocodeCalls[1].callback([{ address: { address_name: '지번' }, road_address: { address_name: '도로명', building_name: '' } }], 'OK')
  assert.equal(await noBuilding, '도로명')
})

test('역지오코딩은 결과 없음은 null, 오류는 실패로 처리하고 다시 시도할 수 있다', async () => {
  const { reverseGeocode, scripts, geocodeCalls } = setup()
  const empty = reverseGeocode(0, 0)
  scripts[0].onload()
  await new Promise((resolve) => setImmediate(resolve))
  geocodeCalls[0].callback([], 'ZERO_RESULT')
  assert.equal(await empty, null)
  const failed = reverseGeocode(1, 1)
  await new Promise((resolve) => setImmediate(resolve))
  geocodeCalls[1].callback([], 'ERROR')
  await assert.rejects(failed, /조회하지 못했습니다/)
  const retry = reverseGeocode(1, 1)
  assert.notEqual(retry, failed)
  await new Promise((resolve) => setImmediate(resolve))
  geocodeCalls[2].callback([{ address: { address_name: '지번' }, road_address: null }], 'OK')
  assert.equal(await retry, '지번')
})
