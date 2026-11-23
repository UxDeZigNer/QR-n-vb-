import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useParams } from 'react-router-dom'
import {
  callNext,
  getCurrent,
  getLive,
  getOperators,
  getServices,
  getWaiting,
  recallTicket,
  redirectTicket,
  subscribeBranch,
} from '../lib/queue'
import { supabase } from '../lib/supabase'
import type { Branch, Operator, Service, Ticket } from '../lib/types'

const ME_KEY = (slug: string) => `qrm_me:${slug}`

export default function Operator() {
  const { slug } = useParams()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [waiting, setWaiting] = useState<Ticket[]>([])
  const [current, setCurrent] = useState<Ticket | null>(null)
  const [waitingCount, setWaitingCount] = useState(0)
  const [services, setServices] = useState<Service[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [meId, setMeId] = useState<string>('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Yönləndirmə modalı
  const [redirectFor, setRedirectFor] = useState<Ticket | null>(null)
  const [rService, setRService] = useState<string>('')
  const [rOperator, setROperator] = useState<string>('')
  const [rBack, setRBack] = useState(false)

  const refresh = useCallback(async (branchId: string) => {
    const [w, c, live] = await Promise.all([
      getWaiting(branchId),
      getCurrent(branchId),
      getLive(branchId),
    ])
    setWaiting(w)
    setCurrent(c)
    setWaitingCount(live?.waiting_count ?? 0)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('branches').select('*').eq('slug', slug).maybeSingle()
      if (cancelled || !data) return
      const b = data as Branch
      setBranch(b)
      const [svcs, ops] = await Promise.all([getServices(b.id), getOperators(b.id)])
      if (cancelled) return
      setServices(svcs)
      setOperators(ops)
      const saved = localStorage.getItem(ME_KEY(slug))
      if (saved && ops.some((o) => o.id === saved)) setMeId(saved)
      await refresh(b.id)
    })()
    return () => {
      cancelled = true
    }
  }, [slug, refresh])

  useEffect(() => {
    if (!branch) return
    return subscribeBranch(branch.id, () => void refresh(branch.id))
  }, [branch, refresh])

  async function handleNext() {
    if (!branch || busy) return
    setBusy(true)
    setError(null)
    try {
      const t = await callNext(branch.id, meId || null)
      if (!t) setError('Növbədə gözləyən yoxdur')
      await refresh(branch.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xəta')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecall() {
    if (!current || busy) return
    setBusy(true)
    try {
      await recallTicket(current.id)
      if (branch) await refresh(branch.id)
    } finally {
      setBusy(false)
    }
  }

  function pickMe(id: string) {
    setMeId(id)
    if (slug) localStorage.setItem(ME_KEY(slug), id)
  }

  // ---- Yönləndirmə ----
  function openRedirect(t: Ticket) {
    setRedirectFor(t)
    setRService(t.service_id ?? '')
    setROperator('')
    setRBack(false)
    setError(null)
  }

  async function applyRedirect() {
    if (!redirectFor) return
    setBusy(true)
    setError(null)
    try {
      await redirectTicket({
        ticketId: redirectFor.id,
        serviceId: rService || null,
        operatorId: rOperator || null,
        backToQueue: rBack,
      })
      setRedirectFor(null)
      if (branch) await refresh(branch.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yönləndirmə mümkün olmadı')
    } finally {
      setBusy(false)
    }
  }

  const svcName = (id: string | null) =>
    id ? (services.find((s) => s.id === id)?.name ?? '—') : null
  const opName = (id: string | null) =>
    id ? (operators.find((o) => o.id === id)?.name ?? '—') : null

  if (!slug) return <PanelDemo />
  if (!branch) return <Center>Yüklənir…</Center>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800/40">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{branch.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Operator paneli</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mən kiməm */}
            {operators.length > 0 && (
              <select
                value={meId}
                onChange={(e) => pickMe(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:border-brand-500 max-w-[140px]"
                title="Mən kiməm — çağırılan nömrə sizə bağlanır"
              >
                <option value="">Operator seçin</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            <div className="text-right">
              <div className="text-xl font-black text-brand-600 tabular-nums leading-none">
                {waitingCount}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">gözləyir</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Hazırda çağırılan */}
        <div className="rounded-3xl bg-slate-900 text-white p-6 text-center">
          <div className="text-sm opacity-70">Hazırda çağırılan</div>
          <div className="text-6xl font-black tabular-nums my-1">{current?.code ?? '—'}</div>
          <div className="text-sm opacity-70">
            {current?.visitor_name ? `${current.visitor_name} • ` : ''}
            {svcName(current?.service_id ?? null) ?? ''}
            {current?.operator_id ? ` • ${opName(current.operator_id)}` : ''}
          </div>
          {current && (
            <button
              onClick={() => openRedirect(current)}
              className="mt-3 rounded-full bg-white/10 hover:bg-white/20 px-4 py-1.5 text-sm transition inline-flex items-center gap-1.5"
            >
              <Icon icon="lucide:corner-up-right" className="w-4 h-4" />
              Yönləndir
            </button>
          )}
        </div>

        {/* Əməliyyatlar */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleNext}
            disabled={busy}
            className="col-span-2 rounded-2xl bg-brand-600 text-white text-xl font-bold py-5 hover:bg-brand-700 disabled:opacity-50 transition shadow-md flex items-center justify-center gap-2"
          >
            <Icon icon="lucide:play" className="w-6 h-6" />
            Növbəti
          </button>
          <button
            onClick={handleRecall}
            disabled={!current || busy}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-4 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Icon icon="lucide:rotate-ccw" className="w-5 h-5" />
            Geri çağır
          </button>
          <a
            href={`#/display/${branch.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-4 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-center flex items-center justify-center gap-2"
          >
            <Icon icon="lucide:monitor" className="w-5 h-5" />
            Ekranı aç
          </a>
        </div>

        {error && <div className="text-sm text-red-600 text-center">{error}</div>}

        {/* Gözləyən siyahısı */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Gözləyənlər ({waiting.length})
          </div>
          {waiting.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              Növbədə kimsə yoxdur
            </div>
          )}
          {waiting.slice(0, 25).map((t, i) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">{i + 1}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100 shrink-0">{t.code}</span>
                <div className="min-w-0 text-sm text-slate-500 dark:text-slate-400 truncate">
                  {t.visitor_name ?? ''}
                  {svcName(t.service_id) && (
                    <span className="text-slate-400 dark:text-slate-500"> · {svcName(t.service_id)}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => openRedirect(t)}
                className="shrink-0 text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1.5 text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600"
                title="Digər xidmətə / əməkdaşa yönləndir"
              >
                <Icon icon="lucide:arrow-right" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* ==== Yönləndirmə modalı ==== */}
      {redirectFor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setRedirectFor(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="text-sm text-slate-400 dark:text-slate-500">Yönləndir</div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{redirectFor.code}</div>
            </div>

            {/* Xidmət seçimi */}
            {services.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Xidmət</div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={rService === ''} onClick={() => setRService('')}>
                    dəyişmə
                  </Chip>
                  {services.map((s) => (
                    <Chip
                      key={s.id}
                      active={rService === s.id}
                      onClick={() => setRService(s.id)}
                    >
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Əməkdaş seçimi */}
            <div>
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Əməkdaş</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={rOperator === ''} onClick={() => setROperator('')}>
                  seçilməyib
                </Chip>
                {operators.map((o) => (
                  <Chip
                    key={o.id}
                    active={rOperator === o.id}
                    onClick={() => setROperator(o.id)}
                  >
                    {o.name}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Gözləməyə qaytar */}
            {(redirectFor.status === 'called' || redirectFor.status === 'serving') && (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rBack}
                  onChange={(e) => setRBack(e.target.checked)}
                  className="accent-brand-600"
                />
                Gözləmə siyahısına qaytar (yenidən növbəyə düşsün)
              </label>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2">
              <button
                onClick={() => setRedirectFor(null)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                İmtina
              </button>
              <button
                onClick={applyRedirect}
                disabled={busy}
                className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? '…' : 'Yönləndir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm border transition ${
        active
          ? 'border-brand-600 bg-brand-50 dark:bg-slate-950 text-brand-700 font-semibold'
          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * /panel (slug-sız) — DEMO panel + qeydiyyat təşviqi.
 * Bura real filiallar göstərilmir (əvvəl bütün istifadəçilərin filialları
 * sıralanırdı — sızıntı idi). Yalnız nümunə paneldir.
 */
function PanelDemo() {
  const [nudge, setNudge] = useState(false)

  const demoWaiting = [
    { code: 'A-13', svc: 'Kassir' },
    { code: 'A-14', svc: 'Məsləhət' },
    { code: 'A-15', svc: 'Kassir' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Fon — landing ilə eyni naxış (şəbəkə + drift orbs) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div
        aria-hidden
        className="anim-drift absolute -left-32 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.3),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden
        className="anim-drift absolute -right-28 top-40 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.24),transparent_65%)] blur-2xl"
      />

      {/* Header */}
      <header className="relative z-10 max-w-lg mx-auto px-6 py-5 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/30">
            <Icon icon="lucide:qr-code" className="h-4.5 w-4.5" />
          </span>
          QR Növbə
        </a>
        <span className="glass rounded-full px-3 py-1 text-xs font-bold text-brand-700 dark:text-brand-300">DEMO</span>
      </header>

      <main className="relative z-10 max-w-lg mx-auto px-6 pb-16 space-y-5">
        <div className="pt-2 text-center">
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Operator paneli</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Belə işləyir — nümunə rejimdə</p>
        </div>

        {/* Nümunə panel — real panelin vizual surəti */}
        <div className="glass glass-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-800 dark:text-slate-100">Nümunə filial</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Operator paneli</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black leading-none tabular-nums text-brand-600">3</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">gözləyir</div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            {/* Hazırda çağırılan */}
            <div className="rounded-2xl bg-slate-900 p-5 text-center text-white dark:bg-slate-800">
              <div className="text-xs opacity-70">Hazırda çağırılan</div>
              <div className="my-1 text-5xl font-black tabular-nums">A-12</div>
              <div className="text-xs opacity-70">Kassir</div>
            </div>

            {/* Növbəti — kliklənəndə qeydiyyata yönləndirir */}
            <button
              onClick={() => setNudge(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-md transition hover:bg-brand-700"
            >
              <Icon icon="lucide:play" className="h-5 w-5" />
              Növbəti
            </button>
            {nudge && (
              <p className="text-center text-xs font-medium text-brand-600 dark:text-brand-400">
                Bu demo-dur — real panel üçün qeydiyyatdan keçin ↓
              </p>
            )}

            {/* Gözləyənlər */}
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white/70 dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900/70">
              <div className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">Gözləyənlər (3)</div>
              {demoWaiting.map((w, i) => (
                <div key={w.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-4 shrink-0 text-xs text-slate-400 dark:text-slate-500">{i + 1}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{w.code}</span>
                  <span className="truncate text-slate-500 dark:text-slate-400">· {w.svc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Qeydiyyat təşviqi */}
        <div className="glass glass-card rounded-3xl p-6 text-center">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Öz panelinizi qurun</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Filial yaradın, QR-u çap edin, növbəni idarə edin — bir neçə dəqiqəyə.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href="#/auth"
              className="btn-sheen flex-1 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              Pulsuz qeydiyyat
            </a>
            <a
              href="#/auth"
              className="glass rounded-xl px-5 py-3 font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
            >
              Hesabım var
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-slate-400 dark:text-slate-500">{children}</div>
}
