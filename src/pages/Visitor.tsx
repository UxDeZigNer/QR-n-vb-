import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useParams } from 'react-router-dom'
import {
  getBranchBySlug,
  getCurrent,
  getLive,
  getServices,
  joinQueue,
  subscribeBranch,
} from '../lib/queue'
import type { Branch, Service, Ticket } from '../lib/types'

const MY_TICKET_KEY = (slug: string) => `qrm_ticket:${slug}`

/** Təxmini gözləmə: önümüzdəki say * xidmətin orta vaxtı */
function estimateMinutes(ahead: number, avg: number) {
  return Math.max(1, Math.round(ahead * avg))
}

export default function Visitor() {
  const { slug = '' } = useParams()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [myTicket, setMyTicket] = useState<Ticket | null>(null)
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const [waitingCount, setWaitingCount] = useState(0)

  const [serviceId, setServiceId] = useState<string>('')
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (branchId: string) => {
    const [live, cur] = await Promise.all([getLive(branchId), getCurrent(branchId)])
    setWaitingCount(live?.waiting_count ?? 0)
    setCurrentCode(cur?.code ?? live?.current_code ?? null)
  }, [])

  // Filialı yüklə + əvvəlki nömrəni bərpa et
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const b = await getBranchBySlug(slug)
        if (cancelled) return
        if (!b || !b.is_active) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setBranch(b)
        const [svcs] = await Promise.all([getServices(b.id), refresh(b.id)])
        if (cancelled) return
        setServices(svcs)

        const saved = localStorage.getItem(MY_TICKET_KEY(slug))
        if (saved) {
          const t = JSON.parse(saved) as Ticket
          setMyTicket(t)
          // Telefon yenidən açılsa statusu təzələ
          const { supabase } = await import('../lib/supabase')
          const { data } = await supabase.from('tickets').select('*').eq('id', t.id).maybeSingle()
          if (data && !cancelled) {
            setMyTicket(data as Ticket)
            if (data.status === 'done' || data.status === 'skipped') {
              localStorage.removeItem(MY_TICKET_KEY(slug))
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Xəta baş verdi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, refresh])

  // Real-time abunə
  useEffect(() => {
    if (!branch) return
    const unsub = subscribeBranch(branch.id, () => {
      void refresh(branch.id)
      // Öz nömrəmizin statusunu da təzələ
      const saved = localStorage.getItem(MY_TICKET_KEY(slug))
      if (saved) {
        const t = JSON.parse(saved) as Ticket
        void import('../lib/supabase').then(({ supabase }) =>
          supabase
            .from('tickets')
            .select('*')
            .eq('id', t.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setMyTicket(data as Ticket)
                if (data.status === 'done' || data.status === 'skipped') {
                  localStorage.removeItem(MY_TICKET_KEY(slug))
                }
              }
            }),
        )
      }
    })
    return unsub
  }, [branch, slug, refresh])

  async function handleJoin() {
    if (!branch || joining) return
    setJoining(true)
    setError(null)
    try {
      const t = await joinQueue({
        branchId: branch.id,
        serviceId: serviceId || null,
        name: name.trim() || null,
      })
      localStorage.setItem(MY_TICKET_KEY(slug), JSON.stringify(t))
      setMyTicket(t)
      void refresh(branch.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Növbəyə qoşulmaq mümkün olmadı')
    } finally {
      setJoining(false)
    }
  }

  function leaveQueue() {
    localStorage.removeItem(MY_TICKET_KEY(slug))
    setMyTicket(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-brand-50 dark:bg-slate-950">
        <div className="animate-pulse text-brand-600 text-lg">Yüklənir…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center bg-brand-50 dark:bg-slate-950 px-6">
        <div className="text-center">
          <Icon icon="lucide:search" className="w-12 h-12 mx-auto mb-3 text-brand-500 dark:text-brand-400" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Növbə tapılmadı</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">QR kodu yenidən skan edin və ya təşkilatla əlaqə saxlayın.</p>
        </div>
      </div>
    )
  }

  const activeService = services.find(
    (s) => s.id === (myTicket?.service_id ?? serviceId),
  )
  const ahead = myTicket && myTicket.status === 'waiting'
    ? Math.max(0, myTicket.seq - (currentCode ? parseInt(currentCode.split('-')[1] ?? '0', 10) : 0) - 1)
    : 0

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-brand-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Fon — saytın ümumi naxışı */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div
        aria-hidden
        className="anim-drift absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.25),transparent_65%)] blur-2xl"
      />

      <header className="glass-strong sticky top-0 z-20 border-b border-slate-200/60 dark:border-slate-700/50">
        <div className="mx-auto flex max-w-md items-center gap-3 px-6 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-sm font-black text-white shadow-lg shadow-brand-600/25">
            {branch?.prefix}
          </div>
          <div className="min-w-0">
            <div className="truncate font-bold leading-tight text-slate-800 dark:text-slate-100">{branch?.name}</div>
            <div className="truncate text-xs text-slate-400 dark:text-slate-500">
              {branch?.address ?? 'Növbə sistemi'}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-md space-y-5 px-6 py-8">
        {!myTicket ? (
          // ---- NÖVBƏYƏ QOŞUL ----
          <div className="space-y-5">
            {/* Çağırılan nömrə */}
            <div className="glass glass-card rounded-3xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span className="anim-ping h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Hazırda çağırılan
              </div>
              <div className="mt-1 text-6xl font-black tabular-nums text-brand-600 dark:text-brand-400">
                {currentCode ?? '—'}
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-300">
                <Icon icon="lucide:users" className="h-4 w-4 text-brand-500" />
                Növbədə <b className="tabular-nums">{waitingCount}</b> nəfər gözləyir
              </div>
            </div>

            {/* Qoşulma kartı */}
            <div className="glass glass-card space-y-4 rounded-3xl p-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon icon="lucide:ticket" className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Növbəyə qoşulun</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Xidməti seçin, nömrəni alın</p>
                </div>
              </div>

              {services.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Xidmət
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setServiceId(s.id === serviceId ? '' : s.id)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          serviceId === s.id
                            ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20'
                            : 'border-slate-200/80 bg-white/70 text-slate-700 hover:border-brand-400 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Icon
                            icon="lucide:briefcase"
                            className={`h-3.5 w-3.5 ${serviceId === s.id ? 'text-white' : 'text-brand-500'}`}
                          />
                          {s.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            serviceId === s.id ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          ~{s.avg_minutes} dəq gözləmə
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Adınız (istəyə bağlı)
                </label>
                <div className="relative mt-1.5">
                  <Icon
                    icon="lucide:user"
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Məsələn, Elvin"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/80 py-2.5 pl-9 pr-3 text-slate-800 outline-none transition focus:border-brand-500 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  <Icon icon="lucide:circle-alert" className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joining}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold shadow-lg shadow-brand-600/25 disabled:opacity-50"
              >
                <Icon icon="lucide:qr-code" className="h-5 w-5" />
                {joining ? 'Qoşulur…' : 'Nömrə al'}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
                <Icon icon="lucide:smartphone" className="h-3.5 w-3.5" />
                Nömrəniz bu cihazda saxlanılır — printer lazım deyil
              </p>
            </div>
          </div>
        ) : (
          // ---- NÖMRƏM ----
          <div className="space-y-5">
            {/* Nömrə kartı */}
            <div
              className={`relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-xl transition ${
                myTicket.status === 'waiting'
                  ? 'bg-gradient-to-br from-brand-600 to-brand-500 shadow-brand-600/30'
                  : 'bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-600/30'
              }`}
            >
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider opacity-80">
                {myTicket.status === 'waiting' ? (
                  <>
                    <span className="anim-ping h-1.5 w-1.5 rounded-full bg-white" />
                    Növbədəsiniz
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:bell-ring" className="h-3.5 w-3.5" />
                    Canlı status
                  </>
                )}
              </div>
              <div className="my-2 text-7xl font-black tabular-nums">{myTicket.code}</div>
              <div className="flex flex-col items-center gap-1.5 text-sm opacity-90">
                {myTicket.status === 'waiting' && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="lucide:users" className="h-4 w-4" />
                    Önünüzdə <b>{ahead}</b> nəfər var
                  </span>
                )}
                {(myTicket.status === 'called' || myTicket.status === 'serving') && (
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Icon icon="lucide:bell-ring" className="h-4 w-4" />
                    Ziyarətçi, siz çağırılırsınız!
                  </span>
                )}
                {myTicket.status === 'done' && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="lucide:check-circle-2" className="h-4 w-4" />
                    Xidmətiniz tamamlandı
                  </span>
                )}
                {myTicket.status === 'skipped' && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon="lucide:x-circle" className="h-4 w-4" />
                    Nömrəniz buraxıldı
                  </span>
                )}
              </div>
              {activeService && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-sm font-medium">
                  <Icon icon="lucide:briefcase" className="h-3.5 w-3.5" />
                  {activeService.name}
                </div>
              )}
            </div>

            {/* Təxmini gözləmə */}
            {myTicket.status === 'waiting' && (
              <div className="glass glass-card flex items-center gap-4 rounded-2xl p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon icon="lucide:clock" className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Təxmini gözləmə</div>
                  <div className="text-2xl font-black tabular-nums text-slate-800 dark:text-slate-100">
                    ~{estimateMinutes(ahead, activeService?.avg_minutes ?? 5)} dəq
                  </div>
                </div>
                <div className="ml-auto text-right text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                  Xidmətin orta
                  <br />
                  vaxtına görə
                </div>
              </div>
            )}

            {/* Status məlumatları */}
            <div className="glass glass-card divide-y divide-slate-100/80 overflow-hidden rounded-2xl dark:divide-slate-800/70">
              <InfoRow icon="lucide:bell-ring" label="Hazırda çağırılan" value={currentCode ?? '—'} mono />
              <InfoRow icon="lucide:users" label="Növbədə gözləyən" value={`${waitingCount} nəfər`} />
              <InfoRow
                icon="lucide:activity"
                label="Növbə statusu"
                value={
                  myTicket.status === 'waiting'
                    ? 'Gözləyir…'
                    : myTicket.status === 'called'
                      ? 'Çağırıldı'
                      : myTicket.status === 'serving'
                        ? 'Xidmət göstərilir'
                        : myTicket.status === 'done'
                          ? 'Tamamlandı'
                          : 'Buraxıldı'
                }
              />
            </div>

            <button
              onClick={leaveQueue}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm text-slate-400 transition hover:text-red-500 dark:text-slate-500"
            >
              <Icon icon="lucide:log-out" className="h-4 w-4" />
              Növbəni tərk et
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

/** Status sətiri — icon + etiket + dəyər */
function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: string
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <Icon icon={icon} className="h-4 w-4" />
      </span>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`ml-auto text-sm font-bold text-slate-800 dark:text-slate-100 ${mono ? 'tabular-nums' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
