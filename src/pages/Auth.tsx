import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Təsdiq linki e-poçtunuza göndərildi — linkə keçin və daxil olun.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        nav('/dashboard')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xəta baş verdi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-50 grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <a href="#/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Ana səhifə
        </a>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-3 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">
            {mode === 'login' ? 'Daxil ol' : 'Hesab yarat'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Növbə panelinə giriş' : 'Növbə sisteminizi bir neçə dəqiqəyə qurun'}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-poçt"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrə"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500"
            />

            {error && <div className="text-sm text-red-600">{error}</div>}
            {msg && <div className="text-sm text-emerald-600">{msg}</div>}

            <button
              disabled={busy}
              className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5 hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Gözləyin…' : mode === 'login' ? 'Daxil ol' : 'Qeydiyyat'}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-sm text-slate-500 hover:text-slate-700 mt-4"
          >
            {mode === 'login' ? 'Hesab yoxdur? Qeydiyyat' : 'Hesab var? Daxil ol'}
          </button>
        </div>
      </div>
    </div>
  )
}
