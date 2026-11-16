import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { subscribeBranch } from '../lib/queue'
import type { Branch, BranchLive, Operator, Service, Ticket } from '../lib/types'

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin + import.meta.env.BASE_URL

const queueUrl = (slug: string) => `${APP_URL}#/q/${slug}`
const panelUrl = (slug: string) => `${APP_URL}#/panel/${slug}`
const displayUrl = (slug: string) => `${APP_URL}#/display/${slug}`

export default function Dashboard() {
  const [ready, setReady] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<Branch | null>(null)

  // Filiala bağlı məlumatlar
  const [live, setLive] = useState<BranchLive | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [recent, setRecent] = useState<Ticket[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [avgWait, setAvgWait] = useState(0)
  const [qrDataUrl, setQrDataUrl] = useState('')

  // Formalar
  const [newBranch, setNewBranch] = useState('')
  const [newService, setNewService] = useState('')
  const [newServiceMin, setNewServiceMin] = useState(5)
  const [newOperator, setNewOperator] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  // ---- Filialların yüklənməsi ----
  const loadBranches = useCallback(async (org: string) => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('org_id', org)
      .order('created_at')
    setBranches((data ?? []) as Branch[])
    return (data ?? []) as Branch[]
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.hash = '/auth'
        return
      }
      const uid = data.session.user.id

      let { data: org } = await supabase.from('orgs').select('*').eq('owner_id', uid).maybeSingle()
      if (!org) {
        const { data: created } = await supabase
          .from('orgs')
          .insert({ owner_id: uid, name: 'Təşkilatım' })
          .select()
          .single()
        org = created
      }
      if (org) {
        const list = await loadBranches(org.id)
        if (list.length > 0) void openBranch(list[0])
      }
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Seçili filialın bütün məlumatları ----
  const loadDetail = useCallback(async (b: Branch) => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [liveRes, svcRes, opRes, recentRes, countRes] = await Promise.all([
      supabase.from('branch_live').select('*').eq('branch_id', b.id).maybeSingle(),
      supabase.from('services').select('*').eq('branch_id', b.id).order('sort_order'),
      supabase.from('operators').select('*').eq('branch_id', b.id).order('name'),
      supabase
        .from('tickets')
        .select('*')
        .eq('branch_id', b.id)
        .gte('joined_at', startOfDay.toISOString())
        .order('seq', { ascending: false })
        .limit(15),
      supabase
        .from('tickets')
        .select('joined_at, called_at, done_at', { count: 'exact', head: true })
        .eq('branch_id', b.id)
        .gte('joined_at', startOfDay.toISOString()),
    ])

    setLive(liveRes.data as BranchLive | null)
    setServices((svcRes.data ?? []) as Service[])
    setOperators((opRes.data ?? []) as Operator[])
    setRecent((recentRes.data ?? []) as Ticket[])
    setTodayCount(countRes.count ?? 0)

    // Orta gözləmə: joined -> called fərqi (çağırılmışlar üzərində)
    const rows = (recentRes.data ?? []) as Ticket[]
    const waits = rows
      .filter((t) => t.called_at)
      .map((t) => (new Date(t.called_at!).getTime() - new Date(t.joined_at).getTime()) / 60000)
    setAvgWait(waits.length ? Math.round(waits.reduce((a, b2) => a + b2, 0) / waits.length) : 0)

    QRCode.toDataURL(queueUrl(b.slug), { width: 600, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [])

  const openBranch = useCallback(
    (b: Branch) => {
      setSelected(b)
      void loadDetail(b)
    },
    [loadDetail],
  )

  // ---- Real-time ----
  useEffect(() => {
    if (!selected) return
    return subscribeBranch(selected.id, () => void loadDetail(selected))
  }, [selected, loadDetail])

  // ---- Əməliyyatlar ----
  async function createBranch() {
    if (!newBranch.trim()) return
    const base = newBranch.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filial'
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { data: org } = await supabase.from('orgs').select('id').limit(1).maybeSingle()
    if (!org) return flash('Təşkilat tapılmadı')
    const { data, error } = await supabase
      .from('branches')
      .insert({ org_id: org.id, name: newBranch.trim(), slug, prefix: 'A' })
      .select()
      .single()
    if (error) return flash(error.message)
    setNewBranch('')
    const list = await loadBranches(org.id)
    setBranches(list)
    openBranch(data as Branch)
    flash('Filial yaradıldı ✓')
  }

  async function addService() {
    if (!selected || !newService.trim()) return
    const { error } = await supabase.from('services').insert({
      branch_id: selected.id,
      name: newService.trim(),
      avg_minutes: newServiceMin,
      sort_order: services.length,
    })
    if (error) return flash(error.message)
    setNewService('')
    await loadDetail(selected)
    flash('Xidmət əlavə olundu ✓')
  }

  async function removeService(id: string) {
    await supabase.from('services').delete().eq('id', id)
    if (selected) await loadDetail(selected)
  }

  async function addOperator() {
    if (!selected || !newOperator.trim()) return
    const { error } = await supabase
      .from('operators')
      .insert({ branch_id: selected.id, name: newOperator.trim() })
    if (error) return flash(error.message)
    setNewOperator('')
    await loadDetail(selected)
    flash('Operator əlavə olundu ✓')
  }

  async function removeOperator(id: string) {
    await supabase.from('operators').delete().eq('id', id)
    if (selected) await loadDetail(selected)
  }

  function downloadQr() {
    if (!qrDataUrl || !selected) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${selected.slug}.png`
    a.click()
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.hash = '/'
  }

  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Yüklənir…</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Başlıq */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-black text-lg shrink-0">
            <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">Q</span>
            <span className="hidden sm:inline">Növbə</span>
          </div>

          {/* Filial seçimi */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={selected?.id ?? ''}
              onChange={(e) => {
                const b = branches.find((x) => x.id === e.target.value)
                if (b) openBranch(b)
              }}
              className="min-w-0 max-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 bg-white cursor-pointer"
            >
              {branches.length === 0 && <option value="">Filial yoxdur</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.id === selected?.id && live ? `(${live.waiting_count})` : ''}
                </option>
              ))}
            </select>

            {/* Yeni filial */}
            <input
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createBranch()}
              placeholder="Yeni filial"
              className="min-w-0 w-28 sm:w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button
              onClick={createBranch}
              className="shrink-0 rounded-xl bg-brand-600 text-white w-10 h-10 font-bold hover:bg-brand-700"
              title="Filial yarat"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
            <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
              Çıxış
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 min-w-0">

        {/* ---- Sağ: seçili filialın dashboard-u ---- */}
        <main className="space-y-4 min-w-0">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              Filial seçin →
            </div>
          ) : (
            <>
              {/* Başlıq + canlı status */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800">{selected.name}</h1>
                  <div className="text-sm text-slate-400">/{selected.slug} · prefiks {selected.prefix}</div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-full px-3 py-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Canlı
                  </span>
                  <span className="bg-slate-100 text-slate-600 rounded-full px-3 py-1.5">
                    {live?.waiting_count ?? 0} gözləyir
                  </span>
                </div>
              </div>

              {/* Statistika kartları */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat
                  label="Hazırda çağırılan"
                  value={live?.current_code ?? '—'}
                  accent
                />
                <Stat label="Gözləyən" value={`${live?.waiting_count ?? 0} nəfər`} />
                <Stat label="Bugünkü ziyarət" value={`${todayCount}`} />
                <Stat label="Orta gözləmə" value={avgWait ? `${avgWait} dəq` : '—'} />
              </div>

              {/* Sürətli keçidlər */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <QuickLink
                  href={queueUrl(selected.slug)}
                  icon="📱"
                  title="Ziyarətçi səhifəsi"
                  desc="QR skan → nömrə"
                  external
                />
                <QuickLink
                  href={panelUrl(selected.slug)}
                  icon="⚙"
                  title="Operator paneli"
                  desc="Növbəti / Geri çağır"
                  external
                />
                <QuickLink
                  href={displayUrl(selected.slug)}
                  icon="🖥"
                  title="Gözləmə zalı ekranı"
                  desc="TV / monitor üçün"
                  external
                />
                <button
                  onClick={downloadQr}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-brand-400 transition"
                >
                  <div className="text-2xl">⬇</div>
                  <div className="font-semibold text-slate-800 text-sm mt-1">QR yüklə</div>
                  <div className="text-xs text-slate-400">PNG, çap üçün hazır</div>
                </button>
              </div>

              {/* QR + xidmət/ziyarətçi linkləri */}
              <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col items-center">
                  <div className="w-44 h-44 rounded-xl border border-slate-100 p-2 grid place-items-center">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR" className="w-full h-full" />
                    ) : (
                      <span className="text-slate-300 text-sm">QR yaranır…</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-700 mt-3">Ziyarətçi QR kodu</div>
                  <div className="text-xs text-slate-400 text-center mt-1">
                    Skan → nömrə → real-time izləmə
                  </div>
                  <button
                    onClick={downloadQr}
                    className="mt-3 w-full rounded-xl bg-brand-600 text-white py-2 text-sm font-semibold hover:bg-brand-700"
                  >
                    PNG yüklə
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 min-w-0 overflow-hidden">
                  <h3 className="font-bold text-slate-800 text-sm">Xidmətlər</h3>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => (
                      <span
                        key={s.id}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-slate-100 pl-3 pr-2 py-1 text-sm text-slate-600"
                      >
                        {s.name}
                        <span className="text-slate-400 text-xs">~{s.avg_minutes}d</span>
                        <button
                          onClick={() => removeService(s.id)}
                          className="text-slate-400 hover:text-red-600 text-xs"
                          title="Sil"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {services.length === 0 && (
                      <span className="text-xs text-slate-400">
                        Yoxdur — ziyarətçi sadəcə nömrə alacaq
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addService()}
                      placeholder="Məs. Kassir, Həkim"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={newServiceMin}
                      onChange={(e) => setNewServiceMin(Number(e.target.value))}
                      className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand-500"
                      title="Orta dəqiqə"
                    />
                    <button
                      onClick={addService}
                      className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Operatorlar + son ziyarətlər */}
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-800 text-sm mb-3">Operatorlar</h3>
                  <div className="space-y-1.5">
                    {operators.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">{o.name}</span>
                        <button
                          onClick={() => removeOperator(o.id)}
                          className="text-slate-400 hover:text-red-600 text-xs"
                        >
                          sil
                        </button>
                      </div>
                    ))}
                    {operators.length === 0 && (
                      <div className="text-xs text-slate-400">Hələ operator yoxdur</div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      value={newOperator}
                      onChange={(e) => setNewOperator(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addOperator()}
                      placeholder="Operator adı"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                    <button
                      onClick={addOperator}
                      className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-800 text-sm mb-3">Bugünkü ziyarətlər</h3>
                  <div className="space-y-1 max-h-64 overflow-auto">
                    {recent.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-700">{t.code}</span>
                          {t.visitor_name && (
                            <span className="text-slate-400 text-xs">{t.visitor_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          <span className="text-xs text-slate-400 tabular-nums">
                            {new Date(t.joined_at).toLocaleTimeString('az-AZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {recent.length === 0 && (
                      <div className="text-xs text-slate-400 text-center py-6">
                        Bu gün hələ ziyarət yoxdur
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ---- Kiçik komponentlər ----

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`text-xs ${accent ? 'text-white/70' : 'text-slate-400'}`}>{label}</div>
      <div
        className={`text-2xl font-black tabular-nums mt-1 ${
          accent ? 'text-white' : 'text-slate-800'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  desc,
  external,
}: {
  href: string
  icon: string
  title: string
  desc: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-400 transition"
    >
      <div className="text-2xl">{icon}</div>
      <div className="font-semibold text-slate-800 text-sm mt-1">{title}</div>
      <div className="text-xs text-slate-400">{desc}</div>
    </a>
  )
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const map: Record<Ticket['status'], { t: string; c: string }> = {
    waiting: { t: 'gözləyir', c: 'bg-slate-100 text-slate-500' },
    called: { t: 'çağırıldı', c: 'bg-amber-100 text-amber-700' },
    serving: { t: 'xidmətdə', c: 'bg-blue-100 text-blue-700' },
    done: { t: 'bitdi', c: 'bg-emerald-100 text-emerald-700' },
    skipped: { t: 'buraxıldı', c: 'bg-red-100 text-red-600' },
  }
  const s = map[status]
  return <span className={`text-xs rounded-full px-2 py-0.5 ${s.c}`}>{s.t}</span>
}
