import { useRef, useState } from 'react'
import { loginAdmin } from '../../../services/auth'
import type { LoginRequest } from '../../../types/auth'

export default function useLogin() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isPendingRef = useRef(false)

  async function handleLogin(credentials: LoginRequest) {
    if (isPendingRef.current) return
    isPendingRef.current = true
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      await loginAdmin(credentials)
      window.location.assign('/')
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : '로그인에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      isPendingRef.current = false
      setIsSubmitting(false)
    }
  }

  function handleClearError() {
    setErrorMessage('')
  }

  return { isSubmitting, errorMessage, handleLogin, handleClearError }
}
