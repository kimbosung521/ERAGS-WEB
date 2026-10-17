const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function setup({ error = null } = {}) {
  const mapCalls = []
  const imports = {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '../hooks/useEmergencyMap': {
      useEmergencyMap: (...args) => {
        mapCalls.push(args)
        return { containerRef: { current: null }, isReady: error === null, error }
      },
    },
    '../hooks/useLocationAddress': { useLocationAddress: () => ({ address: null }) },
    './detail/format': { formatCoordinates: (latitude, longitude) => `${latitude}, ${longitude}` },
  }
  const code = ts.transpileModule(readFileSync('src/screens/emergency/components/EmergencyMap.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const context = { exports: {}, require: (name) => imports[name] }
  vm.runInNewContext(code, context)
  return {
    mapCalls,
    render: (props) => renderToStaticMarkup(React.createElement(context.exports.default, {
      emergencies: [], selectedId: null, onSelect: () => {}, detailLocation: null, ...props,
    })),
  }
}

const coordinates = { latitude: 37.5, longitude: 127 }
const incident = { id: 'selected', category: '출혈', status: 'unconfirmed', location: null }

test('사건이 없으면 안내 화면을 표시하고 지도를 생성하지 않는다', () => {
  const { render, mapCalls } = setup()
  assert.match(render(), /표시할 위치 정보가 없습니다/)
  assert.equal(mapCalls.length, 0)
})

test('선택한 사건에 좌표가 없으면 다른 사건의 좌표가 있어도 위치 없음 화면을 표시한다', () => {
  const { render, mapCalls } = setup()
  const html = render({ emergencies: [incident, { ...incident, id: 'other', location: coordinates }], selectedId: incident.id })
  assert.match(html, /위치 정보를 확인할 수 없습니다/)
  assert.match(html, /위치가 확인되면 자동으로 지도가 표시됩니다/)
  assert.doesNotMatch(html, /aria-label="위급상황 위치 지도"/)
  assert.equal(mapCalls.length, 0)
})

test('목록에 좌표가 없어도 상세에서 위치를 받으면 지도를 표시한다', () => {
  const { render, mapCalls } = setup()
  const html = render({ emergencies: [incident], selectedId: incident.id, detailLocation: { ...coordinates, accuracy: 20 } })
  assert.match(html, /aria-label="위급상황 위치 지도"/)
  assert.equal(mapCalls.length, 1)
  assert.equal(mapCalls[0][3].latitude, coordinates.latitude)
  assert.equal(mapCalls[0][3].accuracy, 20)
})

test('상세를 받기 전에도 선택한 사건의 목록 좌표가 있으면 지도를 표시한다', () => {
  const { render, mapCalls } = setup()
  const html = render({ emergencies: [{ ...incident, location: coordinates }], selectedId: incident.id })
  assert.match(html, /aria-label="위급상황 위치 지도"/)
  assert.equal(mapCalls.length, 1)
})

test('최신 상세에서 좌표를 확인할 수 없으면 이전 목록 좌표로 지도를 표시하지 않는다', () => {
  const { render, mapCalls } = setup()
  const html = render({
    emergencies: [{ ...incident, location: coordinates }], selectedId: incident.id,
    detailLocation: { latitude: null, longitude: null, accuracy: null, status: 'DENIED' },
  })
  assert.match(html, /위치 정보를 확인할 수 없습니다/)
  assert.equal(mapCalls.length, 0)
})

test('지도 로딩에 실패하면 지도를 숨기고 안내와 재시도 버튼을 표시한다', () => {
  const { render } = setup({ error: '지도 로딩 실패' })
  const html = render({ emergencies: [{ ...incident, location: coordinates }], selectedId: incident.id })
  assert.match(html, /aria-label="위급상황 위치 지도" hidden=""/)
  assert.match(html, /role="alert"/)
  assert.match(html, /지도를 불러오지 못했습니다/)
  assert.match(html, /지도 다시 불러오기/)
  assert.doesNotMatch(html, /지도를 불러오는 중입니다/)
})
