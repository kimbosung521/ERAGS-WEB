import type { Emergency } from '../../types/emergency'

// 인물과 주소는 가상이며 좌표는 지도 시연용으로 실제 사건 위치와 무관하다.
export const mockEmergencies: readonly Emergency[] = [
  {
    id: 'ER-0017', category: '낙상 감지', status: 'unconfirmed',
    occurredAt: '2026-09-20T14:30:12+09:00',
    person: { name: '김영자', age: 78 }, address: '서울 마포구 가상로 21',
    guardian: { name: '김민수', phone: '010-0000-0000' },
    location: { latitude: 37.5563, longitude: 126.9236 },
  },
  {
    id: 'ER-0016', category: 'SOS 긴급 호출', status: 'unconfirmed',
    occurredAt: '2026-09-20T14:28:45+09:00',
    person: { name: '박정수', age: 72 }, address: '서울 마포구 가상로 118',
    guardian: { name: '박지수', phone: '010-0000-0000' },
    location: { latitude: 37.5620, longitude: 126.9250 },
  },
  {
    id: 'ER-0015', category: '장시간 움직임 없음', status: 'responding',
    occurredAt: '2026-09-20T14:21:03+09:00',
    person: { name: '이순희', age: 81 }, address: '서울 마포구 가상로 156',
    guardian: { name: '이민호', phone: '010-0000-0000' },
    location: { latitude: 37.5509, longitude: 126.9145 },
  },
]
