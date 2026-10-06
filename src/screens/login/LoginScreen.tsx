import type { FormEvent } from 'react'
import useLogin from './hooks/useLogin'
import './LoginScreen.css'

export default function LoginScreen() {
  const { isSubmitting, errorMessage, handleLogin, handleClearError } = useLogin()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    void handleLogin({
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    })
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <strong className="login-brand">ERAGS</strong>
        <h1 id="login-title">로그인</h1>
        <p className="login-description">이메일과 비밀번호를 입력해 주세요.</p>
        <form className="login-form" onSubmit={handleSubmit} onChange={handleClearError} aria-busy={isSubmitting}>
          <div className="login-field">
            <label htmlFor="login-email">이메일</label>
            <input id="login-email" name="email" type="email" autoComplete="username" placeholder="name@example.com" disabled={isSubmitting} required />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">비밀번호</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력해 주세요" disabled={isSubmitting} required />
          </div>
          <button className="login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? '로그인 중…' : '로그인'}</button>
          <p className="login-status" role="status">
            {errorMessage}
          </p>
        </form>
      </section>
    </main>
  )
}
