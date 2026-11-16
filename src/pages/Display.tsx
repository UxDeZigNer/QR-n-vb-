import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCurrent, getLive, getWaiting, subscribeBranch } from '../lib/queue'
import { supabase } from '../lib/supabase'
import type { Branch, Ticket } from '../lib/types'

export default function Display() {
  const { slug } = useParams()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [current, setCurrent] = useState<Ticket | null>(null)
  const [waiting, setWaiting] = useState<Ticket[]>([])
  const [waitingCount, setWaitingCount] = useState(0)
  const [now, setNow] = useState(new Date())

  const refresh = useCallback(async (branchId: string) => {
    const [c, w, live] = await Promise.all([
      getCurrent(branchId),
      getWaiting(branchId),
      getLive(branchId),
    ])
    setCurrent(c)
    setWaiting(w)
    setWaitingCount(live?.waiting_count ?? 0)
  }, [])

  useEffect(() => {
    if (!slug) return
    void supabase
      .from('branches')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBranch(data as Branch)
          void refresh(data.id)
        }
      })
  }, [slug, refresh])

  useEffect(() => {
    if (!branch) return
    return subscribeBranch(branch.id, () => void refresh(branch.id))
  }, [branch, refresh])

  // Saat
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!branch) return <div className="min-h-screen bg-slate-900" />

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col select-none">
      {/* Başlıq */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 grid place-items-center text-xl font-black">
            {branch.prefix}
          </div>
          <div>
            <div className="text-2xl font-bold">{branch.name}</div>
            <div className="text-sm text-white/50">Növbə gözləmə ekranı</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono tabular-nums">
            {now.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-sm text-white/50">
            {now.toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-3 gap-8 p-10">
        {/* Hazırda çağırılan — böyük */}
        <div className="col-span-2 flex flex-col items-center justify-center rounded-3xl bg-brand-600">
          <div className="text-lg uppercase tracking-widest opacity-70">Növbədə</div>
          <div className="text-[10rem] leading-none font-black tabular-nums my-4">
            {current?.code ?? '—'}
          </div>
          <div className="text-2xl opacity-80">
            {current?.visitor_name ?? 'Xəstə/Müştəri nömrəsi'}
          </div>
          {current?.called_at && (
            <div className="mt-3 text-sm opacity-60">
              Çağırıldı:{' '}
              {new Date(current.called_at).toLocaleTimeString('az-AZ', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* Növbədə gözləyənlər */}
        <div className="flex flex-col rounded-3xl bg-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <span className="font-semibold text-white/70">Gözləyənlər</span>
            <span className="text-2xl font-black text-brand-400 tabular-nums">{waitingCount}</span>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {waiting.slice(0, 12).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
              >
                <span className="font-mono text-xl font-bold">{t.code}</span>
                <span className="text-sm text-white/40">
                  {new Date(t.joined_at).toLocaleTimeString('az-AZ', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
            {waiting.length === 0 && (
              <div className="text-center text-white/30 py-10">Növbə boşdur</div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-white/10 text-sm text-white/50 text-center">
            QR-u skan edib nömrə ala bilərsiniz
          </div>
        </div>
      </main>
    </div>
  )
}
