import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { finishTicket, getCurrent, subscribeBranch } from '../lib/queue'
import { getStoredTheme, toggleTheme, type Theme } from '../lib/theme'
import type { Branch, BranchLive, Operator, Service, Ticket } from '../lib/types'

import { appUrl } from '../lib/url'

const APP_URL = appUrl()
const queueUrl = (slug: string) => `${APP_URL}#/q/${slug}`
const panelUrl = (slug: string) => `${APP_URL}#/panel/${slug}`
const displayUrl = (slug: string) => `${APP_URL}#/display/${slug}`

type Section =
  | 'dashboard'
  | 'visitor'
  | 'operators'
  | 'display'
  | 'branches'
  | 'services'
  | 'history'
  | 'settings'

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'lucide:layout-dashboard' },
  { id: 'visitor', label: 'QR kodlar', icon: 'lucide:qr-code' },
  { id: 'operators', label: 'Operatorlar', icon: 'lucide:users' },
  { id: 'display', label: 'Gözləmə zalı ekranı', icon: 'lucide:monitor' },
  { id: 'branches', label: 'Filiallar', icon: 'lucide:building-2' },
  { id: 'services', label: 'Xidmətlər', icon: 'lucide:concierge-bell' },
  { id: 'history', label: 'Ziyarətçilər', icon: 'lucide:clipboard-list' },
]

const STATUS: Record<Ticket['status'], { t: string; c: string }> = {
  waiting: { t: 'gözləyir', c: 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400' },
  called: { t: 'çağırıldı', c: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  serving: { t: 'xidmətdə', c: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  done: { t: 'bitdi', c: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  skipped: { t: 'buraxıldı', c: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
}

const DOW = ['Baz', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cü', 'Şən']

const localDayStart = (dateStr: string) => new Date(`${dateStr}T00:00:00`)
const iso = (d: Date) => d.toISOString()
const dateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Dashboard() {
  // ---- Auth / org / filiallar ----
  const [ready, setReady] = useState(false)
  const [userEmail, setEmail] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<Branch | null>(null)

  // ---- UI ----
  const [section, setSection] = useState<Section>(() => {
    const m = window.location.hash.match(/\/dashboard\/([a-z]+)/)
    return (m?.[1] as Section) ?? 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [userName, setUserName] = useState('')
  const [accFirst, setAccFirst] = useState('')
  const [accLast, setAccLast] = useState('')
  const [accPhone, setAccPhone] = useState('')
  const [busyAcc, setBusyAcc] = useState(false)
  const [pwdOld, setPwdOld] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdNew2, setPwdNew2] = useState('')
  const [busyPwd, setBusyPwd] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'account' | 'password' | 'branch'>('account')

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  const go = (s: Section) => {
    setSection(s)
    setSidebarOpen(false)
    window.location.hash = s === 'dashboard' ? '/dashboard' : `/dashboard/${s}`
  }

  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/\/dashboard\/([a-z]+)/)
      setSection((m?.[1] as Section) ?? 'dashboard')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // ---- Filiala bağlı data ----
  const [live, setLive] = useState<BranchLive | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [recent, setRecent] = useState<Ticket[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [todayAll, setTodayAll] = useState<Pick<Ticket, 'service_id' | 'operator_id'>[]>([])
  const [avgWait, setAvgWait] = useState(0)
  const [week, setWeek] = useState<{ label: string; count: number }[]>([])
  const [qrDataUrl, setQrDataUrl] = useState('')

  // ---- Ziyarətçi tarixçəsi ----
  const todayStr = dateInput(new Date())
  const [from, setFrom] = useState(todayStr)
  const [to, setTo] = useState(todayStr)
  const [historyRows, setHistoryRows] = useState<Ticket[]>([])

  // ---- Tənzimləmələr ----
  const [cfgName, setCfgName] = useState('')
  const [cfgAddress, setCfgAddress] = useState('')
  const [cfgPrefix, setCfgPrefix] = useState('A')

  // ---------- Data yükləmə ----------
  const loadBranches = useCallback(async (org: string) => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('org_id', org)
      .order('created_at')
    setBranches((data ?? []) as Branch[])
    return (data ?? []) as Branch[]
  }, [])

  const loadDetail = useCallback(async (b: Branch) => {
    const dayStart = localDayStart(dateInput(new Date()))
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    const [liveRes, svcRes, opRes, todayRes, weekRes, dayRes] = await Promise.all([
      supabase.from('branch_live').select('*').eq('branch_id', b.id).maybeSingle(),
      supabase.from('services').select('*').eq('branch_id', b.id).order('sort_order'),
      supabase.from('operators').select('*').eq('branch_id', b.id).order('name'),
      supabase
        .from('tickets')
        .select('*')
        .eq('branch_id', b.id)
        .gte('joined_at', iso(dayStart))
        .order('seq', { ascending: false })
        .limit(10),
      supabase
        .from('tickets')
        .select('joined_at, called_at')
        .eq('branch_id', b.id)
        .gte('joined_at', iso(weekStart)),
      supabase
        .from('tickets')
        .select('service_id, operator_id')
        .eq('branch_id', b.id)
        .gte('joined_at', iso(dayStart))
        .limit(2000),
    ])

    setLive(liveRes.data as BranchLive | null)
    setServices((svcRes.data ?? []) as Service[])
    setOperators((opRes.data ?? []) as Operator[])
    setTodayAll((dayRes.data ?? []) as Pick<Ticket, 'service_id' | 'operator_id'>[])

    const todays = (todayRes.data ?? []) as Ticket[]
    setRecent(todays)
    setTodayCount(todays.length)

    const waits = todays
      .filter((t) => t.called_at)
      .map((t) => (new Date(t.called_at!).getTime() - new Date(t.joined_at).getTime()) / 60000)
    setAvgWait(waits.length ? Math.round(waits.reduce((a, b2) => a + b2, 0) / waits.length) : 0)

    // 7 günlük qrafik
    const counts = new Array(7).fill(0)
    for (const t of ((weekRes.data ?? []) as Ticket[])) {
      const d = new Date(t.joined_at)
      d.setHours(0, 0, 0, 0)
      const idx = Math.round((d.getTime() - weekStart.getTime()) / 86400000)
      if (idx >= 0 && idx < 7) counts[idx]++
    }
    setWeek(counts.map((count, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return { label: DOW[d.getDay()], count }
    }))

    QRCode.toDataURL(queueUrl(b.slug), { width: 600, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [])

  const openBranch = useCallback(
    (b: Branch) => {
      setSelected(b)
      localStorage.setItem('qrm_branch', b.id)
      setCfgName(b.name)
      setCfgAddress(b.address ?? '')
      setCfgPrefix(b.prefix)
      void loadDetail(b)
    },
    [loadDetail],
  )

  // Sessiya
  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.hash = '/auth'
        return
      }
      setEmail(data.session.user.email ?? '')
      const { data: ud } = await supabase.auth.getUser()
      const meta = (ud.user?.user_metadata ?? {}) as Record<string, string>
      const fn: string = meta.full_name || meta.name || ''
      setUserName(fn || (data.session.user.email ?? ''))
      const parts = fn.split(' ')
      setAccFirst(parts[0] ?? '')
      setAccLast(parts.slice(1).join(' '))
      setAccPhone(meta.phone ?? '')
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
        const savedId = localStorage.getItem('qrm_branch')
        const restore = list.find((b) => b.id === savedId) ?? list[0]
        if (restore) openBranch(restore)
      }
      setReady(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime
  useEffect(() => {
    if (!selected) return
    return subscribeBranch(selected.id, () => void loadDetail(selected))
  }, [selected, loadDetail])

  // Çağırılmış biletin xidmətini tamamla (widget-dakı ✓ düyməsi)
  async function finishCurrent() {
    if (!selected || !live?.current_code) return
    try {
      const cur = await getCurrent(selected.id)
      if (cur) {
        await finishTicket(cur.id)
        await loadDetail(selected)
      }
    } catch {
      /* RLS icazə verməsə — səssiz; panel tərəfində işləyəcək */
    }
  }

  // Ziyarətçi tarixçəsi
  useEffect(() => {
    if (!selected || section !== 'history') return
    const end = new Date(`${to}T23:59:59.999`)
    void supabase
      .from('tickets')
      .select('*')
      .eq('branch_id', selected.id)
      .gte('joined_at', iso(localDayStart(from)))
      .lte('joined_at', iso(end))
      .order('joined_at', { ascending: false })
      .limit(300)
      .then(({ data }) => setHistoryRows((data ?? []) as Ticket[]))
  }, [selected, section, from, to])

  // ---------- Əməliyyatlar ----------
  // ---- Filial modalı ----
  const [brModal, setBrModal] = useState(false)
  const [brEdit, setBrEdit] = useState<Branch | null>(null)
  const [brName, setBrName] = useState('')
  const [brAddress, setBrAddress] = useState('')
  const [brPrefix, setBrPrefix] = useState('A')
  const [busyBr, setBusyBr] = useState(false)

  function openBranchModal(b?: Branch) {
    setBrEdit(b ?? null)
    setBrName(b?.name ?? '')
    setBrAddress(b?.address ?? '')
    setBrPrefix(b?.prefix ?? 'A')
    setBrModal(true)
  }

  function closeBranchModal() {
    setBrModal(false)
    setBrEdit(null)
  }

  async function saveBranch() {
    if (!brName.trim()) return flash('Filial adı yazın')
    setBusyBr(true)
    const prefix = brPrefix.trim().toUpperCase().slice(0, 3) || 'A'
    if (brEdit) {
      const { data, error } = await supabase
        .from('branches')
        .update({ name: brName.trim(), address: brAddress.trim() || null, prefix })
        .eq('id', brEdit.id)
        .select()
        .single()
      setBusyBr(false)
      if (error) return flash(error.message)
      const updated = data as Branch
      setBranches((bs) => bs.map((b) => (b.id === updated.id ? updated : b)))
      if (selected?.id === updated.id) {
        setSelected(updated)
        setCfgName(updated.name)
        setCfgAddress(updated.address ?? '')
        setCfgPrefix(updated.prefix)
      }
      closeBranchModal()
      flash('Filial yeniləndi ✓')
      return
    }
    const base = brName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filial'
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { data: org } = await supabase.from('orgs').select('id').limit(1).maybeSingle()
    if (!org) {
      setBusyBr(false)
      return
    }
    const { data, error } = await supabase
      .from('branches')
      .insert({ org_id: org.id, name: brName.trim(), slug, prefix, address: brAddress.trim() || null })
      .select()
      .single()
    setBusyBr(false)
    if (error) return flash(error.message)
    closeBranchModal()
    openBranch(data as Branch)
    const list = await loadBranches(org.id)
    setBranches(list)
    flash('Filial yaradıldı ✓')
  }

  async function addService() {
    const name = prompt('Xidmət adı (məs. Kassir):')
    if (!name?.trim() || !selected) return
    const avg = Number(prompt('Orta vaxt (dəqiqə):', '5') ?? 5) || 5
    const { error } = await supabase.from('services').insert({
      branch_id: selected.id,
      name: name.trim(),
      avg_minutes: avg,
      sort_order: services.length,
    })
    if (error) return flash(error.message)
    await loadDetail(selected)
    flash('Xidmət əlavə olundu ✓')
  }

  async function removeService(id: string) {
    await supabase.from('services').delete().eq('id', id)
    if (selected) await loadDetail(selected)
  }

  async function addOperator() {
    const name = prompt('Operator adı:')
    if (!name?.trim() || !selected) return
    const { error } = await supabase
      .from('operators')
      .insert({ branch_id: selected.id, name: name.trim() })
    if (error) return flash(error.message)
    await loadDetail(selected)
    flash('Operator əlavə olundu ✓')
  }

  async function removeOperator(id: string) {
    await supabase.from('operators').delete().eq('id', id)
    if (selected) await loadDetail(selected)
  }

  async function resetBranchData(b: Branch) {
    if (!confirm(`"${b.name}" filialının bütün biletləri və növbə sayğacı silinəcək. Əminsiniz?`)) return
    const { error } = await supabase.rpc('reset_branch', { p_branch_id: b.id })
    if (error) {
      if (error.message.includes('reset_branch')) {
        return flash('Əvvəl supabase/005_reset_branch.sql-ı SQL editor-də işləyin')
      }
      return flash(error.message)
    }
    if (selected?.id === b.id) await loadDetail(b)
    flash('Datalar sıfırlandı ✓')
  }

  async function saveSettings() {
    if (!selected) return
    const { error } = await supabase
      .from('branches')
      .update({ name: cfgName, address: cfgAddress, prefix: cfgPrefix })
      .eq('id', selected.id)
    if (error) return flash(error.message)
    await loadBranches((await supabase.from('orgs').select('id').limit(1).maybeSingle()).data!.id)
    openBranch({ ...selected, name: cfgName, address: cfgAddress, prefix: cfgPrefix })
    flash('Saxlanıldı ✓')
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-${selected?.slug ?? 'novbe'}.png`
    a.click()
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => flash('Kopyalandı ✓'))
  }

  async function saveAccount() {
    setBusyAcc(true)
    const full = `${accFirst.trim()} ${accLast.trim()}`.trim()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: full, phone: accPhone.trim() },
    })
    setBusyAcc(false)
    if (error) return flash(error.message)
    setUserName(full || userEmail)
    flash('Hesab məlumatları saxlanıldı ✓')
  }

  async function savePassword() {
    if (pwdNew.length < 6) return flash('Yeni şifrə ən azı 6 simvol olmalıdır')
    if (pwdNew !== pwdNew2) return flash('Yeni şifrələr üst-üstə düşmür')
    setBusyPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    setBusyPwd(false)
    if (error) return flash(error.message)
    setPwdOld('')
    setPwdNew('')
    setPwdNew2('')
    flash('Şifrə yeniləndi ✓')
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.hash = '/'
  }

  function exportCsv() {
    const head = ['Kod', 'Ad', 'Status', 'Xidmət', 'Əməkdaş', 'Qoşuldu', 'Çağırıldı', 'Bitdi']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = historyRows.map((t) =>
      [
        t.code,
        t.visitor_name ?? '',
        STATUS[t.status].t,
        services.find((s) => s.id === t.service_id)?.name ?? '',
        operators.find((o) => o.id === t.operator_id)?.name ?? '',
        new Date(t.joined_at).toLocaleString('az-AZ'),
        t.called_at ? new Date(t.called_at).toLocaleString('az-AZ') : '',
        t.done_at ? new Date(t.done_at).toLocaleString('az-AZ') : '',
      ]
        .map(esc)
        .join(','),
    )
    const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ziyaretler-${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ---------- Render ----------
  if (!ready) {
    return <div className="min-h-screen grid place-items-center bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500">Yüklənir…</div>
  }

  return (
    <div className="relative min-h-screen bg-slate-100 dark:bg-slate-950 overflow-x-hidden">
      {/* ================= FON (landing ilə eyni naxış) ================= */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-70" />
        <div className="anim-drift absolute -left-32 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.22),transparent_65%)] blur-2xl" />
        <div className="anim-drift absolute -right-28 top-1/3 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.18),transparent_65%)] blur-2xl" />
        <div className="anim-drift absolute bottom-0 left-1/4 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,.18),transparent_65%)] blur-2xl" />
      </div>

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`glass-strong fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/70 dark:border-slate-800/80 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-100 dark:border-slate-800">
          <span className="w-8 h-8 rounded-lg bg-brand-600 grid place-items-center">
            <Icon icon="lucide:qr-code" className="w-5 h-5 text-white" />
          </span>
          <span className="font-black text-slate-800 dark:text-slate-100">QR Növbə</span>
        </div>

        {/* Filial seçimi */}
        <div className="px-3 pt-3">
          <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 mb-1">
            Filial
          </div>
          <select
            value={selected?.id ?? ''}
            onChange={(e) => {
              const b = branches.find((x) => x.id === e.target.value)
              if (b) openBranch(b)
            }}
            className="w-full rounded-xl border border-slate-200 py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
          >
            {branches.length === 0 && <option value="">Filial yoxdur</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Menyu */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                section === n.id
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon
                icon={n.icon}
                className={`w-[18px] h-[18px] shrink-0 ${
                  section === n.id ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              {n.label}
              {n.id === 'dashboard' && selected && (
                <span
                  className={`ml-auto text-xs rounded-full px-1.5 py-0.5 ${
                    section === n.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {live?.waiting_count ?? 0}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Filial yarat */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => openBranchModal()}
            className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 transition flex items-center justify-center gap-1.5"
          >
            <Icon icon="lucide:plus" className="w-4 h-4" />
            Filial yarat
          </button>
        </div>
      </aside>

      {/* Mobil pərdə */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= ƏSAS SÜTUN ================= */}
      <div className="relative z-10 md:pl-64 flex flex-col min-h-screen">
        {/* ---- HEADER ---- */}
        <header className="glass-strong sticky top-0 z-20 h-14 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-slate-500 dark:text-slate-400"
              aria-label="Menyu"
            >
              <Icon icon="lucide:menu" className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <span className="w-7 h-7 rounded-lg bg-brand-600 grid place-items-center">
                <Icon icon="lucide:qr-code" className="w-4 h-4 text-white" />
              </span>
              <span className="font-black text-slate-800 dark:text-slate-100">QR Növbə</span>
            </div>
            <span className="hidden md:block text-sm text-slate-400 dark:text-slate-500">
              {NAV.find((n) => n.id === section)?.label ?? 'Tənzimləmələr'}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {msg && <span className="text-xs text-emerald-600 mr-1 hidden sm:block">{msg}</span>}

            {/* İşıqlı/Qaranlıq rejim */}
            <button
              onClick={() => setTheme(toggleTheme())}
              className="w-9 h-9 rounded-full grid place-items-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={theme === 'dark' ? 'İşıqlı rejim' : 'Qaranlıq rejim'}
            >
              <Icon
                icon={theme === 'dark' ? 'lucide:sun' : 'lucide:moon'}
                className="w-5 h-5"
              />
            </button>

            {/* Bildirişlər */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen)
                  setUserMenu(false)
                }}
                className="relative w-9 h-9 rounded-full grid place-items-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Bildirişlər"
              >
                <Icon icon="lucide:bell" className="w-5 h-5" />
                {(live?.waiting_count ?? 0) > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
                    {Math.min(live?.waiting_count ?? 0, 9)}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 w-72 glass glass-card rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800">
                      Bugünkü ziyarətlər
                    </div>
                    {recent.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{t.code}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS[t.status].c}`}>
                          {STATUS[t.status].t}
                        </span>
                      </div>
                    ))}
                    {recent.length === 0 && (
                      <div className="flex flex-col items-center px-4 py-6 text-center">
                        <Icon
                          icon="lucide:bell-off"
                          className="h-5 w-5 text-slate-300 dark:text-slate-600"
                        />
                        <div className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Bugün ziyarət yoxdur
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          Yeni qeydlər burada görünəcək
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* İstifadəçi */}
            <div className="relative">
              <button
                onClick={() => {
                  setUserMenu(!userMenu)
                  setNotifOpen(false)
                }}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold grid place-items-center uppercase">
                  {(userName || userEmail).charAt(0)}
                </span>
                <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                  {userName || userEmail}
                </span>
                <Icon icon="lucide:chevron-down" className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-11 w-56 glass glass-card rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {userName || 'Ad yoxdur'}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{userEmail}</div>
                    </div>
                    <button
                      onClick={() => {
                        go('settings')
                        setUserMenu(false)
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
                    >
                      <Icon icon="lucide:settings" className="w-4 h-4" />
                      Tənzimləmələr
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                    >
                      <Icon icon="lucide:log-out" className="w-4 h-4" />
                      Hesabdan çıx
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ---- MƏZMUN ---- */}
        <main className="flex-1 p-4 sm:p-6 min-w-0 w-full max-w-5xl mx-auto">
          <div key={section} className="section-in">
          {!selected && section !== 'branches' ? (
            <div className="glass glass-card rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500">
              Sol menyu → Filial seçin (və ya «Filiallar» bölməsində yaradın)
            </div>
          ) : section === 'dashboard' ? (
            DashboardSection()
          ) : section === 'visitor' ? (
            VisitorSection()
          ) : section === 'operators' ? (
            OperatorsSection()
          ) : section === 'display' ? (
            DisplaySection()
          ) : section === 'branches' ? (
            BranchesSection()
          ) : section === 'services' ? (
            ServicesSection()
          ) : section === 'history' ? (
            HistorySection()
          ) : (
            SettingsSection()
          )}
          </div>
        </main>
      </div>

      {/* ================= FILIAL MODALI ================= */}
      {brModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={closeBranchModal}
        >
          <div
            className="w-full max-w-sm glass glass-card rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                {brEdit ? 'Filiala düzəliş' : 'Yeni filial'}
              </h3>
              <button
                onClick={closeBranchModal}
                className="w-8 h-8 rounded-full grid place-items-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Bağla"
              >
                <Icon icon="lucide:x" className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Filial adı</label>
                <input
                  value={brName}
                  onChange={(e) => setBrName(e.target.value)}
                  placeholder="Məs. Mərkəz filialı"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Ünvan</label>
                <input
                  value={brAddress}
                  onChange={(e) => setBrAddress(e.target.value)}
                  placeholder="Məs. Bakı, Nizami 1"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Nömrə prefiksi</label>
                <input
                  value={brPrefix}
                  onChange={(e) => setBrPrefix(e.target.value.toUpperCase().slice(0, 3))}
                  className="w-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Nömrələr: {brPrefix}-1, {brPrefix}-2 …
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={closeBranchModal}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                Ləğv et
              </button>
              <button
                onClick={saveBranch}
                disabled={busyBr}
                className="flex-1 btn-primary rounded-xl bg-brand-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busyBr ? 'Gözləyin…' : brEdit ? 'Yenilə' : 'Yarat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ================= BÖLMƏLƏR =================

  function DashboardSection() {
    const maxCount = Math.max(...week.map((w) => w.count), 1)

    const radarItems = services.map((s) => ({
      label: s.name,
      value: todayAll.filter((t) => t.service_id === s.id).length,
    }))
    return (
      <div className="space-y-4 max-w-5xl">
        {/* Stat kartları */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Hazırda çağırılan"
            value={live?.current_code ?? '—'}
            icon="lucide:bell-ring"
            hint={live?.current_code ? 'Növbədəki ziyarətçi' : 'Çağırış olanda görünəcək'}
            accent
            action={
              live?.current_code ? (
                <button
                  onClick={finishCurrent}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/15 py-1.5 text-xs font-bold text-white transition hover:bg-white/25"
                >
                  <Icon icon="lucide:check" className="h-3.5 w-3.5" />
                  Xidmət tamam
                </button>
              ) : undefined
            }
          />
          <StatCard
            label="Gözləyən"
            value={`${live?.waiting_count ?? 0} nəfər`}
            icon="lucide:users"
            hint={(live?.waiting_count ?? 0) > 0 ? 'Növbədə gözləyənlər' : 'Növbə boşdur — ziyarətçi gözlənilir'}
          />
          <StatCard
            label="Bugünkü ziyarət"
            value={`${todayCount}`}
            icon="lucide:calendar-check"
            hint={todayCount > 0 ? 'Bu gün qeydə alınan' : 'İlk ziyarətçi burada görünəcək'}
          />
          <StatCard
            label="Orta gözləmə"
            value={avgWait ? `${avgWait} dəq` : '—'}
            icon="lucide:clock"
            hint={avgWait ? 'Son ziyarətlərin ortası' : 'Məlumat toplanır'}
          />
        </div>

        {/* Sürətli keçidlər */}
        <div className="grid sm:grid-cols-3 gap-3">
          <QuickBtn href={panelUrl(selected!.slug)} icon="lucide:list-checks" title="Operator paneli" desc="Növbəti / Geri çağır" />
          <QuickBtn href={displayUrl(selected!.slug)} icon="lucide:monitor" title="Gözləmə ekranı" desc="TV üçün" external />
          <QuickBtn href={queueUrl(selected!.slug)} icon="lucide:qr-code" title="Skan səhifəsi" desc="QR oxuyanda açılan səhifə" external />
        </div>

        {/* 7 günlük qrafik */}
        <div className="grid lg:grid-cols-3 gap-3">
          <div className="glass glass-card rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-4">Son 7 gün</h3>
            <div className="space-y-2.5">
              {week.map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{w.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-500/90 transition-all"
                      style={{ width: `${Math.max(w.count ? (w.count / maxCount) * 100 : 0, w.count ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="w-5 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums text-right">
                    {w.count}
                  </span>
                </div>
              ))}
            </div>
            {week.every((w) => w.count === 0) && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-600/5 px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500">
                <Icon icon="lucide:info" className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                Həftəlik ziyarət qeydləri burada toplanır — ziyarətçi gəldikcə sütunlar böyüyəcək
              </div>
            )}
          </div>

          {/* Xidmət radarı */}
          <div className="glass glass-card rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2 flex items-center gap-1.5">
              <Icon icon="lucide:radar" className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Xidmətə gələnlər (bugün)
            </h3>
            <RadarChart items={radarItems} />
          </div>

          {/* Operator donut */}
          <div className="glass glass-card rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2 flex items-center gap-1.5">
              <Icon icon="lucide:chart-pie" className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Operatora müraciət (bugün)
            </h3>
            <DonutChart
              items={operators.map((o) => ({
                label: o.name,
                value: todayAll.filter((t) => t.operator_id === o.id).length,
              }))}
            />
          </div>
        </div>

        {/* Bugünkü ziyarətlər */}
        <div className="glass glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Bugünkü ziyarətlər</h3>
            <button
              onClick={() => go('history')}
              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
            >
              Bütün tarixçə
              <Icon icon="lucide:arrow-right" className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{t.code}</span>
                  {t.visitor_name && <span className="text-slate-400 dark:text-slate-500 text-xs truncate">{t.visitor_name}</span>}
                  {t.operator_id && (
                    <span className="text-xs text-brand-600">
                      {operators.find((o) => o.id === t.operator_id)?.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {new Date(t.joined_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <Icon icon="lucide:inbox" className="h-5 w-5" />
                </span>
                <div className="mt-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">Bu gün hələ ziyarət yoxdur</div>
                <div className="mt-1 max-w-[280px] text-xs text-slate-400 dark:text-slate-500">
                  Ziyarətçi QR-u skan edib nömrə alanda ilk qeyd burada görünəcək
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  function VisitorSection() {
    return (
      <Card title="QR kodlar">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          QR-u çap edib masaya yerləşdirin. Ziyarətçilər skan edir → nömrə alır → real-time izləyir.
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-48 h-48 rounded-xl border border-slate-100 dark:border-slate-800 p-2 grid place-items-center bg-white dark:bg-slate-900 shrink-0">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="w-full h-full" /> : <span className="text-slate-300">…</span>}
          </div>
          <div className="space-y-3 min-w-0">
            <code className="block break-all bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              {queueUrl(selected!.slug)}
            </code>
            <div className="flex flex-wrap gap-2">
              <a
                href={queueUrl(selected!.slug)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 flex items-center gap-1.5"
              >
                Aç
                <Icon icon="lucide:arrow-right" className="w-4 h-4" />
              </a>
              <button
                onClick={() => copy(queueUrl(selected!.slug))}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                Linki kopyala
              </button>
              <button
                onClick={downloadQr}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-1.5"
              >
                <Icon icon="lucide:download" className="w-4 h-4" />
                PNG yüklə
              </button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  function OperatorsSection() {
    return (
      <Card title={`Operatorlar (${operators.length})`} action={<AddBtn onClick={addOperator} label="Operator əlavə et" />}>
        <div className="space-y-2">
          {operators.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 grid place-items-center text-sm font-bold">
                  {o.name.charAt(0)}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{o.name}</span>
              </div>
              <button onClick={() => removeOperator(o.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600">
                sil
              </button>
            </div>
          ))}
          {operators.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon icon="lucide:user-plus" className="h-5 w-5" />
              </span>
              <div className="mt-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">Hələ operator yoxdur</div>
              <div className="mt-1 max-w-[280px] text-xs text-slate-400 dark:text-slate-500">
                Operator əlavə edin — panelə daxil olan kimi öz adını seçə bilər
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
          Operatorlar <code className="bg-slate-100 dark:bg-slate-800/60 px-1 rounded">#/panel/{selected?.slug}</code> ünvanından
          işləyir, «Mən kiməm» seçərək növbəni idarə edirlər.
        </p>
      </Card>
    )
  }

  function DisplaySection() {
    return (
      <Card title="Gözləmə zalı ekranı">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Bu linki noutbuk və ya televizorda açın — tam ekran rejimində növbə göstərilir. Real-time yenilənir.
        </p>
        <code className="block break-all bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300 mb-4">
          {displayUrl(selected!.slug)}
        </code>
        <div className="flex flex-wrap gap-2">
          <a
            href={displayUrl(selected!.slug)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
          >
              <Icon icon="lucide:monitor" className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              Ekranı aç
          </a>
          <button
            onClick={() => copy(displayUrl(selected!.slug))}
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            Linki kopyala
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center gap-1.5">
          <Icon icon="lucide:info" className="w-4 h-4 shrink-0" />
          Tam ekran üçün: F11 (Windows) / ⌃⌘F (Mac)
        </p>
      </Card>
    )
  }

  function BranchesSection() {
    return (
      <Card title={`Filiallar (${branches.length})`} action={<AddBtn onClick={() => openBranchModal()} label="Filial yarat" />}>
        <div className="grid sm:grid-cols-2 gap-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl border p-4 transition ${
                selected?.id === b.id ? 'border-brand-500 bg-brand-50 dark:bg-slate-950/50' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100">{b.name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">/{b.slug}</div>
                  {b.address && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{b.address}</div>}
                </div>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 shrink-0 ${
                    b.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {b.is_active ? 'aktiv' : 'deaktiv'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                {selected?.id !== b.id && (
                  <button
                    onClick={() => openBranch(b)}
                    className="btn-primary rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-700"
                  >
                    Seç
                  </button>
                )}
                <button
                  onClick={() => openBranchModal(b)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 flex items-center gap-1"
                >
                  <Icon icon="lucide:pencil" className="w-3.5 h-3.5" />
                  Düzəliş
                </button>
                <button
                  onClick={() => resetBranchData(b)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1"
                  title="Bütün biletləri və sayğacı sil"
                >
                  <Icon icon="lucide:rotate-ccw" className="w-3.5 h-3.5" />
                  Datanı sıfırla
                </button>
                {selected?.id === b.id && (
                  <span className="text-xs text-brand-700 dark:text-brand-300 font-semibold px-2 py-1.5 flex items-center gap-1">
                    <Icon icon="lucide:check" className="w-3.5 h-3.5" />
                    Seçilib
                  </span>
                )}
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-8 sm:col-span-2">
              İlk filialınızı yaradın
            </div>
          )}
        </div>
      </Card>
    )
  }

  function ServicesSection() {
    return (
      <Card title={`Xidmətlər (${services.length})`} action={<AddBtn onClick={addService} label="Xidmət əlavə et" />}>
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{s.name}</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5">
                  ~{s.avg_minutes} dəq
                </span>
              </div>
              <button onClick={() => removeService(s.id)} className="text-xs text-slate-400 dark:text-slate-500 hover:text-red-600">
                sil
              </button>
            </div>
          ))}
          {services.length === 0 && (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
              <Icon icon="lucide:info" className="h-4 w-4 shrink-0 text-brand-500" />
              Xidmət yoxdur — ziyarətçi birbaşa nömrə alır. Xidmət əlavə etsəniz, seçim siyahısı görünəcək
            </div>
          )}
        </div>
      </Card>
    )
  }

  function HistorySection() {
    return (
      <Card title={`Ziyarətçilər (${historyRows.length})`}>
        {/* Tarix seçimi */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Başlanğıc</label>
            <input
              type="date"
              value={from}
              max={todayStr}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Bitmə</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <button
            onClick={exportCsv}
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <Icon icon="lucide:download" className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            CSV yüklə
          </button>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2 px-2 font-medium">Kod</th>
                <th className="py-2 px-2 font-medium">Ad</th>
                <th className="py-2 px-2 font-medium">Xidmət</th>
                <th className="py-2 px-2 font-medium">Əməkdaş</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium">Qoşuldu</th>
                <th className="py-2 px-2 font-medium">Çağırıldı</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="py-2 px-2 font-mono font-semibold text-slate-700 dark:text-slate-200">{t.code}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{t.visitor_name ?? '—'}</td>
                  <td className="py-2 px-2 text-slate-500 dark:text-slate-400 text-xs">
                    {services.find((s) => s.id === t.service_id)?.name ?? '—'}
                  </td>
                  <td className="py-2 px-2 text-slate-500 dark:text-slate-400 text-xs">
                    {operators.find((o) => o.id === t.operator_id)?.name ?? '—'}
                  </td>
                  <td className="py-2 px-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {new Date(t.joined_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {t.called_at
                      ? new Date(t.called_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {historyRows.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Icon icon="lucide:calendar-x" className="h-6 w-6" />
              </span>
              <div className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Bu tarixlərdə ziyarət yoxdur
              </div>
              <div className="mt-1 max-w-[300px] text-xs text-slate-400 dark:text-slate-500">
                Tarix aralığını dəyişin və ya ziyarətçi QR-u skan edib nömrə alanda burada görünəcək
              </div>
            </div>
          )}
        </div>
      </Card>
    )
  }

  function SettingsSection() {
    const TABS: { id: typeof settingsTab; label: string; icon: string }[] = [
      { id: 'account', label: 'Hesab', icon: 'lucide:user' },
      { id: 'password', label: 'Şifrə', icon: 'lucide:key-round' },
      { id: 'branch', label: 'Filial', icon: 'lucide:building-2' },
    ]
    const inputCls =
      'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-brand-500'
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Tablar */}
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSettingsTab(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition flex items-center gap-1.5 ${
                settingsTab === t.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400'
              }`}
            >
              <Icon icon={t.icon} className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Hesab */}
        {settingsTab === 'account' && (
          <Card title="Hesab">
            <div className="space-y-4 max-w-md">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Ad</label>
                  <input
                    value={accFirst}
                    onChange={(e) => setAccFirst(e.target.value)}
                    placeholder="Məs. Əli"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Soyad</label>
                  <input
                    value={accLast}
                    onChange={(e) => setAccLast(e.target.value)}
                    placeholder="Məs. Məmmədov"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">E-poçt</label>
                <input
                  value={userEmail}
                  readOnly
                  className={`${inputCls} opacity-60 cursor-not-allowed`}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">E-poçt daxil olma ünvanıdır — dəyişmir.</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Mobil nömrə</label>
                <input
                  value={accPhone}
                  onChange={(e) => setAccPhone(e.target.value)}
                  placeholder="Məs. +994 50 123 45 67"
                  className={inputCls}
                />
              </div>
              <button
                onClick={saveAccount}
                disabled={busyAcc}
                className="btn-primary rounded-xl bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busyAcc ? 'Gözləyin…' : 'Saxla'}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">Ad Soyad header-də və dropdown-da göstərilir.</p>
            </div>
          </Card>
        )}

        {/* Şifrə */}
        {settingsTab === 'password' && (
          <Card title="Şifrəni dəyiş">
            <div className="space-y-4 max-w-md">
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Köhnə şifrə</label>
                <input
                  type="password"
                  value={pwdOld}
                  onChange={(e) => setPwdOld(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Yeni şifrə</label>
                <input
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder="Ən azı 6 simvol"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Yeni şifrə (təkrar)</label>
                <input
                  type="password"
                  value={pwdNew2}
                  onChange={(e) => setPwdNew2(e.target.value)}
                  placeholder="Yeni şifrəni yenidən yazın"
                  className={inputCls}
                />
              </div>
              <button
                onClick={savePassword}
                disabled={busyPwd}
                className="btn-primary rounded-xl bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busyPwd ? 'Gözləyin…' : 'Şifrəni yenilə'}
              </button>
            </div>
          </Card>
        )}

        {/* Filial */}
        {settingsTab === 'branch' && (
          <Card title="Filial tənzimləmələri">
            <div className="space-y-4 max-w-md">
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Filial adı</label>
            <input
              value={cfgName}
              onChange={(e) => setCfgName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Ünvan</label>
            <input
              value={cfgAddress}
              onChange={(e) => setCfgAddress(e.target.value)}
              placeholder="Məs. Bakı, Nizami 1"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Nömrə prefiksi</label>
            <input
              value={cfgPrefix}
              onChange={(e) => setCfgPrefix(e.target.value.toUpperCase().slice(0, 3))}
              className={`${inputCls} w-24`}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Nömrələr bu şəkildə olacaq: {cfgPrefix}-1, {cfgPrefix}-2 …</p>
          </div>
          <button
            onClick={saveSettings}
            className="btn-primary rounded-xl bg-brand-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-brand-700"
          >
            Saxla
          </button>
            </div>
          </Card>
        )}
      </div>
    )
  }

}

// ================= Köməkçi komponentlər =================

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="glass glass-card rounded-2xl p-5 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="btn-primary rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700 shrink-0"
    >
      + {label}
    </button>
  )
}

function StatCard({
  label,
  value,
  icon,
  hint,
  accent,
  action,
}: {
  label: string
  value: string
  icon?: string
  hint?: string
  accent?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'bg-brand-600 border-brand-600 text-white' : 'glass glass-card border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`text-xs ${accent ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{label}</div>
        {icon && (
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
              accent
                ? 'bg-white/15'
                : 'bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
            }`}
          >
            <Icon icon={icon} className={`h-4 w-4 ${accent ? 'text-white' : ''}`} />
          </span>
        )}
      </div>
      <div className={`text-2xl font-black tabular-nums mt-1 ${accent ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
        {value}
      </div>
      {hint && (
        <div
          className={`mt-1 flex items-center gap-1 text-[11px] leading-tight ${
            accent ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {hint}
        </div>
      )}
      {action}
    </div>
  )
}

function QuickBtn({
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
      className="glass glass-card rounded-2xl p-4 card-hover hover:border-brand-400/60 transition"
    >
      <Icon icon={icon} className="w-6 h-6 text-brand-600 dark:text-brand-400" />
      <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm mt-2">{title}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{desc}</div>
    </a>
  )
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const s = STATUS[status]
  return <span className={`text-xs rounded-full px-2 py-0.5 ${s.c}`}>{s.t}</span>
}

// ================= Qrafiklər =================

function EmptyChart({ icon = 'lucide:bar-chart-3', hint }: { icon?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <Icon icon={icon} className="h-6 w-6" />
      </span>
      <div className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Bu gün hələ məlumat yoxdur</div>
      <div className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {hint ?? 'Ziyarətçi QR-u skan edib nömrə alanda bu qrafik dolacaq'}
      </div>
    </div>
  )
}

/** Radar — xidmətə gələnlər */
function RadarChart({ items }: { items: { label: string; value: number }[] }) {
  const n = items.length
  if (n < 3 || items.every((i) => i.value === 0))
    return <EmptyChart icon="lucide:radar" hint="Xidmət yaradıb ziyarətçi qəbul etdikcə bu qrafik dolacaq" />
  const C = 130
  const R = 88
  const max = Math.max(...items.map((i) => i.value), 1)
  const pt = (i: number, f: number): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]
  }
  const ring = (f: number) => items.map((_, i) => pt(i, f).join(',')).join(' ')
  const dataPoly = items.map((it, i) => pt(i, Math.max(it.value / max, 0.06)).join(',')).join(' ')
  return (
    <svg viewBox="0 0 260 260" className="w-full max-w-xs mx-auto">
      {[1 / 3, 2 / 3, 1].map((f, i) => (
        <polygon
          key={i}
          points={ring(f)}
          fill="none"
          className="stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="1"
        />
      ))}
      {items.map((_, i) => {
        const [x, y] = pt(i, 1)
        return (
          <line
            key={i}
            x1={C}
            y1={C}
            x2={x}
            y2={y}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="1"
          />
        )
      })}
      <polygon points={dataPoly} className="fill-brand-600/25 stroke-brand-600" strokeWidth="2" />
      {items.map((it, i) => {
        const [x, y] = pt(i, Math.max(it.value / max, 0.06))
        return <circle key={i} cx={x} cy={y} r="3.5" className="fill-brand-600" />
      })}
      {items.map((it, i) => {
        const [x, y] = pt(i, 1.22)
        return (
          <text key={i} x={x} y={y} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400">
            <tspan className="text-[10px] font-medium">{it.label}</tspan>
            <tspan x={x} dy="12" className="text-[11px] font-bold fill-slate-700 dark:fill-slate-200">
              {it.value}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}

/** Donut — operatorlara müraciət (monoton mavi, hover-da ad+pay) */
function DonutChart({ items }: { items: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const rows = items.filter((i) => i.value > 0)
  const total = rows.reduce((a, b) => a + b.value, 0)
  if (total === 0)
    return <EmptyChart icon="lucide:user-round-check" hint="Operatora müraciət yox — ziyarətçi nömrə aldıqca bölünür" />
  const CX = 90
  const R = 64
  const CIRC = 2 * Math.PI * R
  // Monoton mavi palitra — eyni ton, açıqdan tündə
  const mono = (i: number) => `hsl(215 90% ${Math.round(62 - (i * 34) / Math.max(rows.length - 1, 1))}%)`
  let off = 0
  const segs = rows.map((it, i) => {
    const len = (it.value / total) * CIRC
    const seg = { ...it, len, off, color: mono(i) }
    off += len
    return seg
  })
  const h = hover != null ? segs[hover] : null
  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 180 180" className="w-56 h-56 max-w-full">
        <g transform={`rotate(-90 ${CX} ${CX})`}>
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            strokeWidth="24"
            className="stroke-slate-100 dark:stroke-slate-800"
          />
          {segs.map((s, i) => {
            const adj = Math.max(s.len - 1.5, 0.5)
            return (
              <circle
                key={i}
                cx={CX}
                cy={CX}
                r={R}
                fill="none"
                strokeWidth={hover === i ? 30 : 24}
                stroke={s.color}
                strokeDasharray={`${adj} ${CIRC - adj}`}
                strokeDashoffset={-s.off}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </g>
        {h ? (
          <>
            <text x={CX} y="76" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-semibold">
              {h.label.length > 14 ? `${h.label.slice(0, 13)}…` : h.label}
            </text>
            <text x={CX} y="102" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-3xl font-black tabular-nums">
              {h.value}
            </text>
            <text x={CX} y="120" textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px]">
              {Math.round((h.value / total) * 100)}% pay
            </text>
          </>
        ) : (
          <>
            <text x={CX} y="88" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-3xl font-black tabular-nums">
              {total}
            </text>
            <text x={CX} y="107" textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px]">
              müraciət
            </text>
          </>
        )}
      </svg>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-4">
        Dilimlərin üzərinə gəl — ad, say və pay görünür
      </p>
    </div>
  )
}
