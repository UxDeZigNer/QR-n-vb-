import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { callNext, getCurrent, getLive, getWaiting, recallTicket, subscribeBranch } from '../lib/queue'
import { supabase } from '../lib/supabase'
import type { Branch, Ticket } from '../lib/types'

export default function Operator() {
  const { slug } = useParams()

  const [branch, setBranch] = useState<Branch | null>(null)
  const [waiting, setWaiting] = useState<Ticket[]>([])
  const [current, setCurrent] = useState<Ticket | null>(null)
  const [waitingCount, setWaitingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Filial seçimi: /panel/<slug> və ya /panel-də seçim siyahısı
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
      if (cancelled) return
      if (data) {
        setBranch(data as Branch)
        await refresh(data.id)
      }
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
      const t = await callNext(branch.id)
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

  if (!slug) return <BranchPicker />
  if (!branch) return <Center>Yüklənir…</Center>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-800">{branch.name}</div>
          <div className="text-xs text-slate-500">Operator paneli</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-brand-600 tabular-nums">{waitingCount}</div>
          <div className="text-xs text-slate-500">gözləyir</div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {/* Hazırda çağırılan */}
        <div className="rounded-3xl bg-slate-900 text-white p-6 text-center">
          <div className="text-sm opacity-70">Hazırda çağırılan</div>
          <div className="text-6xl font-black tabular-nums my-1">{current?.code ?? '—'}</div>
          <div className="text-sm opacity-70">
            {current?.visitor_name ? `${current.visitor_name} • ` : ''}
            {current ? new Date(current.called_at ?? current.joined_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : 'gözləyirik'}
          </div>
        </div>

        {/* Əməliyyatlar */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleNext}
            disabled={busy}
            className="col-span-2 rounded-2xl bg-brand-600 text-white text-xl font-bold py-5 hover:bg-brand-700 disabled:opacity-50 transition shadow-md"
          >
            ▶ Növbəti
          </button>
          <button
            onClick={handleRecall}
            disabled={!current || busy}
            className="rounded-2xl bg-white border border-slate-200 py-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            🔁 Geri çağır
          </button>
          <a
            href={`#/display/${branch.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-white border border-slate-200 py-4 font-semibold text-slate-700 hover:bg-slate-100 text-center"
          >
            🖥 Ekranı aç
          </a>
        </div>

        {error && <div className="text-sm text-red-600 text-center">{error}</div>}

        {/* Gözləyən siyahısı */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          <div className="px-4 py-3 text-sm font-semibold text-slate-600">
            Gözləyənlər ({waiting.length})
          </div>
          {waiting.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Növbədə kimsə yoxdur</div>
          )}
          {waiting.slice(0, 20).map((t, i) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5">{i + 1}</span>
                <span className="font-mono font-bold text-slate-800">{t.code}</span>
                {t.visitor_name && <span className="text-sm text-slate-500">{t.visitor_name}</span>}
              </div>
              <span className="text-xs text-slate-400">
                {new Date(t.joined_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

/** /panel — hansı filialda işlədiyini seçir */
function BranchPicker() {
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    void supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Operator paneli</h1>
        <p className="text-slate-500 mb-6 text-sm">Filialınızı seçin</p>
        <div className="space-y-2">
          {branches.map((b) => (
            <a
              key={b.id}
              href={`#/panel/${b.slug}`}
              className="block bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-brand-400 transition"
            >
              <div className="font-semibold text-slate-800">{b.name}</div>
              <div className="text-xs text-slate-400">/q/{b.slug}</div>
            </a>
          ))}
          {branches.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-8">
              Hələ filial yaradılmayıb — Dashboard-dan yaradın
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center text-slate-400">{children}</div>
}
