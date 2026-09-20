export type EmergencyStatus = 'unconfirmed' | 'responding'

export interface Emergency {
  id: string
  category: string
  status: EmergencyStatus
  occurredAt: string
  person: { name: string; age: number }
  address: string
  guardian: { name: string; phone: string }
  location: { latitude: number; longitude: number }
}
