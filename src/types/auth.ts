export interface LoginRequest {
  email: string
  password: string
}

export interface AdminSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  user: {
    id: number
    email: string
    name?: string
    guardian_phone?: string
    role: 'admin'
  }
}
