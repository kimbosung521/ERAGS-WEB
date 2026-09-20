# ERAGS 관리자 웹

React + TypeScript + Vite로 구성한 가짜 데이터 기반 위급상황 관제 화면입니다.

## 실행

- `npm install`: 의존성 설치
- `npm run dev`: 개발 서버
- `npm run lint`: ESLint 검사
- `npm run build`: TypeScript 검사 및 프로덕션 빌드
- `npm run preview`: 빌드 결과 확인

## 구조

```text
src/
├── main.tsx
├── App.tsx
├── index.css
├── types/
│   └── emergency.ts
└── screens/
    └── emergency/
        ├── EmergencyScreen.tsx
        ├── EmergencyScreen.css
        ├── emergency.mock.ts
        ├── emergency.constants.ts
        └── components/
            ├── EmergencyList.tsx
            ├── EmergencyDetail.tsx
            └── EmergencyMap.tsx
```

- `App`: 화면 진입점. 현재 화면 하나이므로 라우터 없이 연결합니다.
- `EmergencyScreen`: 화면 배치와 사건 선택 상태, 모바일 보기 상태를 관리합니다.
- `components`: 이 화면 전용 UI. 데이터와 이벤트를 props로 받고 API를 호출하지 않습니다.
- `types/emergency`: 화면과 세 컴포넌트가 공유하는 사건 타입입니다. 개별 Props는 각 파일에 둡니다.
- `emergency.mock`: 개인정보를 포함하지 않는 고정 예시 데이터입니다.
- `emergency.constants`: 화면 내부에서 공유하는 처리 상태 표시명입니다.
- `index.css`: 전역 폰트와 기본 스타일. 화면 스타일은 화면 폴더에 둡니다.

## 반응형

- 1200px 이상: 목록 / 지도 / 상세 3단.
- 768–1199px: 목록 / 지도 2단, 하단 상세.
- 767px 이하: 목록·지도 전환, 하단 상세로 이동하는 버튼.

지도는 카카오맵 Web SDK로 표시하며 사건 좌표는 가상 데이터입니다.
검색, 처리 상태 변경, 연락, 서버 연동은 아직 구현하지 않았습니다.

## 확장 기준

여러 화면에서 재사용하는 UI가 생기면 `src/components/`로 옮깁니다.
지도 수명주기와 선택 동기화는 `screens/emergency/hooks/useEmergencyMap.ts`, SDK 로딩은 `services/kakaoMaps.ts`에서 관리합니다.
서버 연동은 Screen → Hook → Domain Service → 공통 요청 계층 순서로 구성합니다.
현재는 API 요청 계층이나 authenticatedFetch가 없으므로 미리 구현하지 않습니다.

SDK 로더 테스트: node --test tests/kakaoMaps.test.cjs (Node 기본 테스트 도구 사용).
기본 검증은 lint/build 후 목록과 지도에서 사건 선택, 상세 동기화, 반응형 배치를 확인합니다.

## 카카오맵 설정

.env.example을 .env.local로 복사하고 VITE_KAKAO_MAP_APP_KEY에 JavaScript 키를 설정합니다. .env.local은 Git에서 제외됩니다. 키 변경 후 개발 서버를 다시 실행합니다.
카카오 Developers에서 카카오맵을 활성화하고 JavaScript 키의 SDK 도메인에 개발 주소(http://127.0.0.1:5173)와 배포 주소를 등록합니다. localhost를 사용한다면 http://localhost:5173도 별도로 등록합니다.
웹용 JavaScript 키는 브라우저에 전달되는 키이므로 도메인 제한으로 사용 범위를 관리합니다. REST API 키나 Admin 키를 넣지 않습니다.
