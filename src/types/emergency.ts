export type EmergencyStatus = 'unconfirmed' | 'acknowledged' | 'responding' | 'closed'

export interface Emergency {
  id: string
  category: string
  status: EmergencyStatus
  occurredAt: string
  person: { name: string; age: number } | null
  address: string
  guardian: { name: string; phone: string } | null
  location: { latitude: number; longitude: number } | null
}

export interface EmergencyListResult {
  items: Emergency[]
  total: number
  nextOffset: number | null
  fetchedAt: string
  eventCursor: number
}
