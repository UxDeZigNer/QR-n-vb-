import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
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
        const redirect = `${window.location.origin}${import.meta.env.BASE_URL}#/dashboard`
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect, data: { full_name: fullName.trim(), phone: phone.trim() } },
        })
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
    <div className="min-h-screen bg-brand-50 dark:bg-slate-950 grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <a href="#/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 inline-flex items-center gap-1">
          <Icon icon="lucide:arrow-left" className="w-4 h-4" />
          Ana səhifə
        </a>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mt-3 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {mode === 'login' ? 'Daxil ol' : 'Hesab yarat'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' ? 'Növbə panelinə giriş' : 'Növbə sisteminizi bir neçə dəqiqəyə qurun'}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === 'signup' && (
              <>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ad Soyad"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 outline-none focus:border-brand-500"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobil nömrə (+994…)"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 outline-none focus:border-brand-500"
                />
              </>
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-poçt"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 outline-none focus:border-brand-500"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrə"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 outline-none focus:border-brand-500"
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
            className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 mt-4"
          >
            {mode === 'login' ? 'Hesab yoxdur? Qeydiyyat' : 'Hesab var? Daxil ol'}
          </button>
        </div>
      </div>
    </div>
  )
}
