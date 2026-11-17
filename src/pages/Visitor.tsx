import { useCallback, useEffect, useState } from 'react'
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
          <div className="text-5xl mb-3">🔍</div>
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
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white dark:from-slate-800 dark:to-slate-900">
      <header className="px-6 py-5 flex items-center gap-3 border-b border-brand-100 bg-white/70 backdrop-blur">
        <div className="w-9 h-9 rounded-xl bg-brand-600 grid place-items-center text-white font-bold">
          {branch?.prefix}
        </div>
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">{branch?.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{branch?.address ?? 'Növbə sistemi'}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        {!myTicket ? (
          // ---- NÖVBƏYƏ QOŞUL ----
          <div className="space-y-5">
            <div className="text-center">
              <div className="text-5xl font-black text-brand-600 tabular-nums">
                {currentCode ?? '—'}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Hazırda çağırılan nömrə</div>
              <div className="mt-3 inline-flex items-center gap-2 text-sm bg-white dark:bg-slate-900 border border-brand-100 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Növbədə {waitingCount} nəfər gözləyir
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Növbəyə qoşulun</h2>

              {services.length > 0 && (
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-300">Xidmət</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setServiceId(s.id === serviceId ? '' : s.id)}
                        className={`text-sm rounded-xl border px-3 py-2 text-left transition ${
                          serviceId === s.id
                            ? 'border-brand-600 bg-brand-50 dark:bg-slate-950 text-brand-700'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        {s.name}
                        <div className="text-xs text-slate-400 dark:text-slate-500">~{s.avg_minutes} dəq</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-slate-600 dark:text-slate-300">Adınız (istəyə bağlı)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Məsələn, Elvin"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 outline-none focus:border-brand-500"
                />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full rounded-xl bg-brand-600 text-white font-semibold py-3 hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {joining ? 'Qoşulur…' : 'Nömrə al'}
              </button>
            </div>
          </div>
        ) : (
          // ---- NÖMRƏM ----
          <div className="space-y-5">
            <div
              className={`rounded-3xl p-8 text-center text-white shadow-lg transition ${
                myTicket.status === 'waiting' ? 'bg-brand-600' : 'bg-emerald-600'
              }`}
            >
              <div className="text-sm opacity-80">Sizin nömrəniz</div>
              <div className="text-7xl font-black tabular-nums my-2">{myTicket.code}</div>
              <div className="text-sm opacity-90">
                {myTicket.status === 'waiting' && `Önünüzdə ${ahead} nəfər var`}
                {(myTicket.status === 'called' || myTicket.status === 'serving') &&
                  '⬇️ Siz çağırılırsınız!'}
                {myTicket.status === 'done' && 'Xidmətiniz tamamlandı ✓'}
                {myTicket.status === 'skipped' && 'Nömrəniz buraxıldı'}
              </div>
              {activeService && (
                <div className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm">
                  Xidmət: {activeService.name}
                </div>
              )}
            </div>

            {myTicket.status === 'waiting' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 text-center">
                <div className="text-sm text-slate-500 dark:text-slate-400">Təxmini gözləmə</div>
                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  ~{estimateMinutes(ahead, activeService?.avg_minutes ?? 5)} dəq
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Hazırda çağırılan</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{currentCode ?? '—'}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-slate-500 dark:text-slate-400">Növbədə gözləyən</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{waitingCount} nəfər</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-slate-500 dark:text-slate-400">Növbə statusu</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {myTicket.status === 'waiting' && 'Gözləyir…'}
                  {myTicket.status === 'called' && 'Çağırıldı'}
                  {myTicket.status === 'serving' && 'Xidmət göstərilir'}
                  {myTicket.status === 'done' && 'Tamamlandı'}
                  {myTicket.status === 'skipped' && 'Buraxıldı'}
                </span>
              </div>
            </div>

            <button
              onClick={leaveQueue}
              className="w-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 py-2"
            >
              Növbəni tərk et
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
