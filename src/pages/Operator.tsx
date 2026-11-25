import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useParams } from 'react-router-dom'
import {
  callNext,
  finishTicket,
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

  async function handleFinish() {
    if (!current || busy) return
    setBusy(true)
    setError(null)
    try {
      await finishTicket(current.id)
      if (branch) await refresh(branch.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bitirmək mümkün olmadı')
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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Fon — dashboard ilə eyni naxış */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div
        aria-hidden
        className="anim-drift absolute -left-32 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.28),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden
        className="anim-drift absolute -right-28 top-56 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.22),transparent_65%)] blur-2xl"
      />

      <header className="glass-strong sticky top-0 z-20 border-b border-slate-200/60 dark:border-slate-700/50">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/25">
              <Icon icon="lucide:qr-code" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{branch.name}</div>
              <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">Operator paneli</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className="glass flex items-center gap-1 rounded-xl px-2.5 py-1.5"
              title="Gözləyən ziyarətçi sayı"
            >
              <Icon icon="lucide:users" className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              <span className="text-sm font-black tabular-nums text-brand-600 dark:text-brand-400">
                {waitingCount}
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-lg space-y-4 px-4 py-6 sm:px-6">
        {/* Hazırda çağırılan */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-center text-white shadow-xl shadow-slate-900/20 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider opacity-70">
            <span className="anim-ping h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Hazırda çağırılan
          </div>
          <div className="my-1.5 text-6xl font-black tabular-nums">{current?.code ?? '—'}</div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm opacity-70">
            {current?.visitor_name && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="lucide:user" className="h-3.5 w-3.5" />
                {current.visitor_name}
              </span>
            )}
            {svcName(current?.service_id ?? null) && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="lucide:briefcase" className="h-3.5 w-3.5" />
                {svcName(current?.service_id ?? null)}
              </span>
            )}
            {current?.operator_id && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="lucide:headset" className="h-3.5 w-3.5" />
                {opName(current.operator_id)}
              </span>
            )}
            {!current && <span className="text-xs">Növbəti ziyarətçi gözlənir</span>}
          </div>
          {current && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleFinish}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold transition hover:bg-emerald-600 disabled:opacity-50"
              >
                <Icon icon="lucide:check" className="h-4 w-4" />
                Xidmət tamam
              </button>
              <button
                onClick={() => openRedirect(current)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm transition hover:bg-white/20"
              >
                <Icon icon="lucide:corner-up-right" className="h-4 w-4" />
                Yönləndir
              </button>
            </div>
          )}
        </div>

        {/* Əməliyyatlar */}
        <div className="grid grid-cols-2 gap-3">
          {/* Mən kiməm */}
          {operators.length > 0 && (
            <label className="glass glass-card col-span-2 flex flex-col gap-2 rounded-2xl px-4 py-3">
              <span className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon icon="lucide:user-round" className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Mən kiməm
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  çağırış sizə bağlanır
                </span>
              </span>
              <select
                value={meId}
                onChange={(e) => pickMe(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-3 pr-9 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                title="Çağırılan nömrə sizə bağlanır"
              >
                <option value="">Operator seçin</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            onClick={handleNext}
            disabled={busy}
            className="btn-primary col-span-2 flex items-center justify-center gap-2 rounded-2xl py-5 text-xl font-bold shadow-lg shadow-brand-600/25 disabled:opacity-50"
          >
            <Icon icon="lucide:play" className="h-6 w-6" />
            Növbəti
            {waitingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm tabular-nums">
                {waitingCount}
              </span>
            )}
          </button>
          <button
            onClick={handleRecall}
            disabled={!current || busy}
            className="glass glass-card flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-slate-700 transition hover:border-brand-500/40 disabled:opacity-40 dark:text-slate-200"
          >
            <Icon icon="lucide:rotate-ccw" className="h-5 w-5" />
            Geri çağır
          </button>
          <a
            href={`#/display/${branch.slug}`}
            target="_blank"
            rel="noreferrer"
            className="glass glass-card flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-slate-700 transition hover:border-brand-500/40 dark:text-slate-200"
          >
            <Icon icon="lucide:monitor" className="h-5 w-5" />
            Ekranı aç
          </a>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <Icon icon="lucide:circle-alert" className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Gözləyən siyahısı */}
        <div className="glass glass-card overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Icon icon="lucide:list-ordered" className="h-4 w-4 text-brand-500" />
              Gözləyənlər
            </span>
            <span className="rounded-full bg-brand-600/10 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              {waiting.length}
            </span>
          </div>
          {waiting.length === 0 && (
            <div className="flex flex-col items-center px-4 pb-6 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon icon="lucide:users" className="h-5 w-5" />
              </span>
              <div className="mt-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Növbədə kimsə yoxdur
              </div>
              <div className="mt-1 max-w-[260px] text-xs text-slate-400 dark:text-slate-500">
                Ziyarətçi QR-u skan edib nömrə alanda burada görünəcək
              </div>
            </div>
          )}
          <div className="divide-y divide-slate-100/80 dark:divide-slate-800/70">
            {waiting.slice(0, 25).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-black ${
                      i === 0
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{t.code}</span>
                  <div className="min-w-0 truncate text-sm text-slate-500 dark:text-slate-400">
                    {t.visitor_name ?? ''}
                    {svcName(t.service_id) && (
                      <span className="text-slate-400 dark:text-slate-500"> · {svcName(t.service_id)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openRedirect(t)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-800 dark:text-slate-400"
                  title="Digər xidmətə / əməkdaşa yönləndir"
                >
                  <Icon icon="lucide:arrow-right" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ==== Yönləndirmə modalı ==== */}
      {redirectFor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setRedirectFor(null)}
        >
          <div
            className="glass glass-card w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 rounded-xl bg-brand-600/10 px-3.5 py-3 dark:bg-brand-500/10">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 font-black text-white tabular-nums">
                {redirectFor.code.split('-')[1]}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{redirectFor.code}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Ziyarətçi nömrəsi</div>
              </div>
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
 * /panel (slug-sız) — DEMO dashboard + qeydiyyat təşviqi.
 * Bura real filiallar göstərilmir (əvvəl bütün istifadəçilərin filialları
 * sıralanırdı — sızıntı idi). Yalnız browser çərçivəsində nümunə dashboard.
 * Bütün rəqəmlər demo məlumatdır — çərçivədə açıq "DEMO" nişanı var.
 */
function PanelDemo() {
  const [nudge, setNudge] = useState(false)

  const demoWaiting = [
    { code: 'A-13', svc: 'Kassir' },
    { code: 'A-14', svc: 'Məsləhət' },
    { code: 'A-15', svc: 'Kassir' },
  ]

  const menu = [
    { icon: 'lucide:list-checks', label: 'Növbə', active: true },
    { icon: 'lucide:building-2', label: 'Filiallar' },
    { icon: 'lucide:qr-code', label: 'QR kodlar' },
    { icon: 'lucide:trending-up', label: 'Analitika' },
    { icon: 'lucide:settings', label: 'Tənzimləmə' },
  ]

  const stats = [
    { label: 'Gözləyir', value: '3', icon: 'lucide:users' },
    { label: 'Orta gözləmə', value: '~12 dəq', icon: 'lucide:clock' },
    { label: 'Bu gün', value: '24', icon: 'lucide:calendar-check' },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
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
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <a href="#/" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/30">
            <Icon icon="lucide:qr-code" className="h-4.5 w-4.5" />
          </span>
          QR Növbə
        </a>
        <span className="glass rounded-full px-3 py-1 text-xs font-bold text-brand-700 dark:text-brand-300">DEMO</span>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-6 pt-2 text-center">
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 sm:text-3xl">Demo panel</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Belə işləyir — nümunə məlumatlarla, real vaxt rejimi
          </p>
        </div>

        {/* ===== Browser çərçivəsi ===== */}
        <div className="glass glass-card overflow-hidden rounded-2xl shadow-2xl shadow-slate-900/10 sm:rounded-3xl">
          {/* URL bar */}
          <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-2.5 dark:border-slate-700/60">
            <div aria-hidden className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-slate-100/80 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <Icon icon="lucide:lock" className="h-3 w-3 shrink-0" />
              <span className="truncate">qr.free.je/#/panel</span>
            </div>
            <span className="rounded-full bg-brand-600/10 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              DEMO
            </span>
          </div>

          {/* Dashboard */}
          <div className="flex">
            {/* Mini sidebar (mobilde gizlənir) */}
            <aside className="hidden w-44 shrink-0 border-r border-slate-200/70 p-3 dark:border-slate-700/60 md:block">
              <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-brand-600 to-brand-500 text-white">
                  <Icon icon="lucide:qr-code" className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">QR Növbə</span>
              </div>
              <nav className="space-y-0.5">
                {menu.map((m) => (
                  <div
                    key={m.label}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                      m.active
                        ? 'bg-brand-600 font-semibold text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon icon={m.icon} className="h-3.5 w-3.5 shrink-0" />
                    {m.label}
                  </div>
                ))}
              </nav>
              <div className="mt-3 rounded-lg border border-dashed border-slate-300/80 p-2 text-center text-[10px] leading-tight text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Nümunə filial — demo məlumat
              </div>
            </aside>

            {/* Məzmun */}
            <div className="min-w-0 flex-1 p-4 sm:p-5">
              {/* Başlıq */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Nümunə filial</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Gözləmə zalı · Kassir masası</div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="anim-ping h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  CANLI
                </span>
              </div>

              {/* Stat kartlar */}
              <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-200/70 bg-white/70 p-2.5 dark:border-slate-700/60 dark:bg-slate-900/60 sm:p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                      <Icon icon={s.icon} className="h-3 w-3" />
                      <span className="truncate">{s.label}</span>
                    </div>
                    <div className="mt-1 text-lg font-black tabular-nums text-slate-800 dark:text-slate-100 sm:text-xl">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Çağırılan + növbə */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Çağırılan kartı */}
                <div className="rounded-2xl bg-slate-900 p-4 text-center text-white dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-wider opacity-60">Hazırda çağırılan</div>
                  <div className="my-1 text-4xl font-black tabular-nums sm:text-5xl">A-12</div>
                  <div className="text-xs opacity-60">Kassir</div>
                  <button
                    onClick={() => setNudge(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                  >
                    <Icon icon="lucide:play" className="h-4 w-4" />
                    Növbəti
                  </button>
                  {nudge && (
                    <p className="mt-2 text-[11px] font-medium leading-tight text-brand-300">
                      Bu demo-dur — real panel üçün qeydiyyatdan keçin ↓
                    </p>
                  )}
                </div>

                {/* Gözləyənlər */}
                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>Gözləyənlər</span>
                    <span className="rounded-full bg-brand-600/10 px-2 py-0.5 font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      3
                    </span>
                  </div>
                  {demoWaiting.map((w, i) => (
                    <div key={w.code} className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm">
                      <span className="w-4 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{i + 1}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{w.code}</span>
                      <span className="truncate text-slate-500 dark:text-slate-400">· {w.svc}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                        {i === 0 ? '~4 dəq' : i === 1 ? '~8 dəq' : '~12 dəq'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Qeydiyyat təşviqi */}
        <div className="glass glass-card mx-auto mt-8 max-w-xl rounded-3xl p-6 text-center sm:p-8">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 sm:text-xl">Öz panelinizi qurun</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Filial yaradın, QR-u çap edin, növbəni idarə edin — bir neçə dəqiqəyə.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
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
