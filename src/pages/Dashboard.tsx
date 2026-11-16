import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import type { Branch, Operator, Service } from '../lib/types'

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin + import.meta.env.BASE_URL

function queueUrl(slug: string) {
  return `${APP_URL}#/q/${slug}`
}
function panelUrl(slug: string) {
  return `${APP_URL}#/panel/${slug}`
}

export default function Dashboard() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<Branch | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [newBranch, setNewBranch] = useState('')
  const [newService, setNewService] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  // Sessiya yoxla
  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.hash = '/auth'
        return
      }
      setAuthed(true)
      const uid = data.session.user.id

      // Org varsa al, yoxsa yarat
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
        setOrgId(org.id)
        await loadBranches(org.id)
      }
      setReady(true)
    })
  }, [])

  async function loadBranches(org: string) {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('org_id', org)
      .order('created_at')
    setBranches((data ?? []) as Branch[])
  }

  async function loadDetail(b: Branch) {
    setSelected(b)
    const [s, o] = await Promise.all([
      supabase.from('services').select('*').eq('branch_id', b.id).order('sort_order'),
      supabase.from('operators').select('*').eq('branch_id', b.id),
    ])
    setServices((s.data ?? []) as Service[])
    setOperators((o.data ?? []) as Operator[])
    const url = await QRCode.toDataURL(queueUrl(b.slug), { width: 600, margin: 2 })
    setQrDataUrl(url)
  }

  async function createBranch() {
    if (!orgId || !newBranch.trim()) return
    const slug = `${newBranch.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await supabase
      .from('branches')
      .insert({ org_id: orgId, name: newBranch.trim(), slug, prefix: 'A' })
      .select()
      .single()
    if (error) return setMsg(error.message)
    setNewBranch('')
    await loadBranches(orgId)
    await loadDetail(data as Branch)
    setMsg('Filial yaradıldı ✓')
  }

  async function addService() {
    if (!selected || !newService.trim()) return
    await supabase.from('services').insert({
      branch_id: selected.id,
      name: newService.trim(),
      avg_minutes: 5,
      sort_order: services.length,
    })
    setNewService('')
    await loadDetail(selected)
  }

  async function downloadQr() {
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

  if (!ready || !authed) {
    return <div className="min-h-screen grid place-items-center text-slate-400">Yüklənir…</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-lg">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">Q</span>
          Növbə — İdarəetmə
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">
          Çıxış
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid md:grid-cols-3 gap-6">
        {/* Filiallar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-3">Filiallar</h2>
            <div className="flex gap-2">
              <input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createBranch()}
                placeholder="Yeni filial adı"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button
                onClick={createBranch}
                className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
              >
                +
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => loadDetail(b)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition ${
                    selected?.id === b.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-800">{b.name}</div>
                  <div className="text-xs text-slate-400">/q/{b.slug}</div>
                </button>
              ))}
              {branches.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-4">
                  İlk filialınızı yaradın
                </div>
              )}
            </div>
          </div>

          {msg && <div className="text-sm text-emerald-600">{msg}</div>}
        </div>

        {/* Təfərrüat */}
        <div className="md:col-span-2 space-y-4">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
              Filial seçin →
            </div>
          ) : (
            <>
              {/* QR */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-6 items-center">
                <div className="w-48 h-48 rounded-xl border border-slate-100 p-2 bg-white shrink-0 grid place-items-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR" className="w-full h-full" />
                  ) : (
                    <span className="text-slate-300">QR…</span>
                  )}
                </div>
                <div className="text-center md:text-left">
                  <h2 className="font-bold text-slate-800 text-lg">{selected.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Ziyarətçi QR-u skan edir → <code className="bg-slate-100 px-1 rounded">nömrə alır</code>
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-slate-500 break-all">
                    <div>QR linki: {queueUrl(selected.slug)}</div>
                    <div>Panel: {panelUrl(selected.slug)}</div>
                    <div>Ekran: {`${APP_URL}#/display/${selected.slug}`}</div>
                  </div>
                  <div className="mt-4 flex gap-2 justify-center md:justify-start">
                    <button
                      onClick={downloadQr}
                      className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
                    >
                      ⬇ QR yüklə (PNG)
                    </button>
                    <a
                      href={`#/display/${selected.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      🖥 Ekran
                    </a>
                    <a
                      href={`#/panel/${selected.slug}`}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                    >
                      ⚙ Panel
                    </a>
                  </div>
                </div>
              </div>

              {/* Xidmətlər */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-800 mb-3">Xidmətlər</h3>
                <div className="flex gap-2">
                  <input
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addService()}
                    placeholder="Məs. Kassir, Həkim, Mütəxəssis"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={addService}
                    className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                    >
                      {s.name} <span className="text-slate-400">~{s.avg_minutes}d</span>
                    </span>
                  ))}
                  {services.length === 0 && (
                    <span className="text-xs text-slate-400">Hələ xidmət yoxdur — ziyarətçi sadəcə nömrə alacaq</span>
                  )}
                </div>
              </div>

              {/* Operatorlar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-800 mb-3">Operatorlar</h3>
                <div className="flex flex-wrap gap-2">
                  {operators.map((o) => (
                    <span key={o.id} className="rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-sm">
                      {o.name}
                    </span>
                  ))}
                  {operators.length === 0 && (
                    <span className="text-xs text-slate-400">Hələ operator əlavə olunmayıb</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
