import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/** Bərpa linki (`#/reset-password`) — e-poçtdakı linkə keçdikdə açılır.
 * PKCE flow: `?code=` avtomatik dəyişdirilir, session yaranır, sonra yeni şifrə təyin olunur. */
export default function ResetPassword() {
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setHasSession(!!data.session)
      setChecking(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Şifrələr uyğun gəlmir')
      return
    }
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMsg('Şifrəniz yeniləndi — panellə keçirik…')
      setTimeout(() => nav('/dashboard'), 1200)
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
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Yeni şifrə təyin et</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Bərpa linki ilə daxil olmusunuz — yeni şifrənizi yazın
          </p>

          {checking ? (
            <div className="mt-5 text-sm text-slate-500 dark:text-slate-400">Yoxlanılır…</div>
          ) : !hasSession ? (
            <div className="mt-5 space-y-4">
              <div className="text-sm text-red-600">
                Link etibarsızdır və ya müddəti bitib. Yeni link istəyin — linki eyni cihaz və brauzerdə açın.
              </div>
              <button
                onClick={() => nav('/auth')}
                className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5 hover:bg-brand-700"
              >
                Yeni link istə
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Yeni şifrə"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2.5 outline-none focus:border-brand-500"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Yeni şifrə (təkrar)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2.5 outline-none focus:border-brand-500"
              />

              {error && <div className="text-sm text-red-600">{error}</div>}
              {msg && <div className="text-sm text-emerald-600">{msg}</div>}

              <button
                disabled={busy}
                className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5 hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Gözləyin…' : 'Şifrəni yenilə'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
