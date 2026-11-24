import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { Icon } from '@iconify/react'
import { getStoredTheme, toggleTheme, type Theme } from '../lib/theme'

/* Scroll-reveal atributları — gecikmə ilə (stagger) */
type RevealAttrs = { 'data-reveal': boolean; style: CSSProperties }
const rv = (delay = 0): RevealAttrs => ({
  'data-reveal': true,
  style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
})

const FEATURES = [
  {
    icon: 'lucide:monitor',
    title: 'Gözləmə zalı ekranı',
    desc: 'Noutbuk və ya televizoru ekran kimi işlədin — xüsusi avadanlıq lazım deyil.',
    size: 'wide' as const,
  },
  {
    icon: 'lucide:smartphone',
    title: 'Tətbiq yükləmək lazım deyil',
    desc: 'Ziyarətçilər telefon kamerası ilə QR-u skan edir və dərhal növbəyə qoşulur.',
    size: 'normal' as const,
  },
  {
    icon: 'lucide:zap',
    title: 'Anlıq yeniləmə',
    desc: 'Nömrə çağırılanda ziyarətçinin telefonu avtomatik yenilənir — heç kim nömrəsini qaçırmır.',
    size: 'normal' as const,
  },
  {
    icon: 'lucide:tag',
    title: 'Brendinq',
    desc: 'Loqonuz, rəngləriniz və adınız ziyarətçilərin gördüyü bütün ekranlarda.',
    size: 'normal' as const,
  },
  {
    icon: 'lucide:trending-up',
    title: 'Analitika',
    desc: 'Günlük ziyarət sayı, orta gözləmə vaxtı və xidmət payı — CSV ixracı ilə.',
    size: 'normal' as const,
  },
  {
    icon: 'lucide:building-2',
    title: 'Çoxfiliallıq',
    desc: 'Bütün filiallarınızı vahid paneldən idarə edin, hər birinə ayrıca QR.',
    size: 'full' as const,
  },
]

const STEPS = [
  {
    n: '01',
    icon: 'lucide:layout-dashboard',
    t: 'Filial yaradın',
    d: 'Panel daxil olub filial və xidmətlərinizi qeyd edin.',
  },
  { n: '02', icon: 'lucide:qr-code', t: 'QR-u çap edin', d: 'Hər nöqtə üçün QR avtomatik yaranır — çap edib yerləşdirin.' },
  {
    n: '03',
    icon: 'lucide:mouse-pointer-click',
    t: 'Növbəni idarə edin',
    d: 'Ziyarətçilər QR-u skan edir, siz «Növbəti» düyməsini basırsınız.',
  },
]

const CHIPS = [
  { icon: 'lucide:smartphone', text: 'Tətbiq yükləmək lazım deyil' },
  { icon: 'lucide:badge-check', text: 'Pulsuz plan' },
  { icon: 'lucide:clock-3', text: 'Bir neçə dəqiqəyə qurulum' },
]

function scrollTo(id: string) {
  return (e: MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
}

function LiveDot({ className = 'bg-emerald-400' }: { className?: string }) {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className={`anim-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${className}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${className}`} />
    </span>
  )
}

/* Mini gözləmə zalı ekranı — funksiya kartının vizualı */
function MiniDisplay() {
  return (
    <div
      className="w-full max-w-[240px] shrink-0 rounded-2xl border border-white/10 bg-slate-950 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_20px_40px_-24px_rgba(2,6,23,.8)]"
      aria-hidden
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-white/40">
        <span>Gözləmə zalı</span>
        <span className="flex items-center gap-1.5 text-emerald-400">
          <LiveDot />
          Canlı
        </span>
      </div>
      <div className="mt-2 text-4xl font-extrabold tabular-nums">A-09</div>
      <div className="mt-1 text-xs text-white/40">Hazırda çağırılan</div>
      <div className="mt-3 flex gap-1.5">
        {['A-10', 'A-11', 'A-12'].map((n) => (
          <span key={n} className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold tabular-nums text-white/70">
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  /* Header — skroll edəndə glass keçidi */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Görünən elementləri reveal et */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] font-sans antialiased text-slate-800 selection:bg-brand-500/20 dark:bg-slate-950 dark:text-slate-100">
      {/* ===== Fon qatları: gradient orbs + şəbəkə ===== */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[920px] overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div className="anim-drift absolute -left-40 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.35),transparent_65%)] opacity-90 blur-2xl dark:opacity-70" />
        <div
          className="anim-drift absolute -right-32 top-8 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,.32),transparent_65%)] opacity-90 blur-2xl dark:opacity-70"
          style={{ animationDelay: '-8s' }}
        />
        <div
          className="anim-drift absolute left-1/3 top-64 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.26),transparent_65%)] opacity-90 blur-2xl dark:opacity-70"
          style={{ animationDelay: '-16s' }}
        />
      </div>

      <div className="relative">
        {/* ===== Nav ===== */}
        <header
          className={`sticky top-0 z-50 transition-all duration-300 ${
            scrolled
              ? 'glass-strong border-b border-slate-200/70 shadow-[0_8px_30px_-14px_rgba(15,23,42,.3)] dark:border-slate-800/80'
              : 'border-b border-transparent bg-transparent'
          }`}
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <a href="#/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30">
                <Icon icon="lucide:qr-code" className="h-5 w-5" />
              </span>
              QR Növbə
            </a>

            <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
              <a
                href="#how"
                onClick={scrollTo('how')}
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Necə işləyir
              </a>
              <a
                href="#features"
                onClick={scrollTo('features')}
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Funksiyalar
              </a>
              <a
                href="#/panel"
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Demo
              </a>
            </nav>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setTheme(toggleTheme())}
                aria-label={theme === 'dark' ? 'Ağ rejimə keç' : 'Qaranlıq rejimə keç'}
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-slate-200/80 text-slate-500 transition-all duration-200 hover:border-brand-500/40 hover:text-brand-600 dark:border-slate-700/80 dark:text-slate-400 dark:hover:text-brand-400"
              >
                <Icon icon={theme === 'dark' ? 'lucide:sun' : 'lucide:moon'} className="h-4.5 w-4.5" />
              </button>
              <a
                href="#/auth"
                className="btn-sheen inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40"
              >
                Başlayın
                <Icon icon="lucide:arrow-right" className="h-4 w-4" />
              </a>
            </div>
          </div>
        </header>

        <main>
          {/* ===== Hero ===== */}
          <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center md:pb-28 md:pt-24">
            <div
              className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm dark:text-brand-300"
              {...rv(0)}
            >
              <LiveDot className="bg-brand-500" />
              QR növbə idarəetmə sistemi
            </div>

            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl">
              <span className="inline-block" {...rv(60)}>
                Növbədə
              </span>{' '}
              <span className="inline-block" {...rv(140)}>
                gözləməyə
              </span>{' '}
              <span className="text-gradient inline-block" {...rv(220)}>
                son
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 dark:text-slate-400" {...rv(300)}>
              Ziyarətçilər QR-u skan edib nömrə alır, gözləyərkən istədikləri yerdə vaxt keçirir, nömrə çağıran kimi
              telefonuna bildiriş alır.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3" {...rv(380)}>
              <a
                href="#/auth"
                className="btn-sheen group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-7 py-3.5 font-semibold text-white shadow-xl shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-brand-600/45"
              >
                Pulsuz başlayın
                <Icon icon="lucide:arrow-right" className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <a
                href="#/panel"
                className="glass inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
              >
                <Icon icon="lucide:monitor-play" className="h-5 w-5" />
                Demo panel
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-sm text-slate-500 dark:text-slate-400" {...rv(440)}>
              {CHIPS.map((c) => (
                <span key={c.text} className="flex items-center gap-1.5">
                  <Icon icon={c.icon} className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
                  {c.text}
                </span>
              ))}
            </div>

            {/* Mock ekranlar */}
            <div className="relative mt-14 md:mt-16" {...rv(520)}>
              <div
                aria-hidden
                className="absolute -inset-x-4 -top-4 bottom-4 rounded-[2.5rem] bg-gradient-to-r from-brand-500/15 via-sky-400/15 to-violet-500/15 blur-2xl"
              />
              <div className="glass relative rounded-[2rem] p-4 shadow-[0_40px_80px_-40px_rgba(15,23,42,.4)] md:p-7">
                <div className="grid gap-4 text-left md:grid-cols-3">
                  {/* Ziyarətçi — telefon */}
                  <div className="anim-float rounded-2xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/85">
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <Icon icon="lucide:smartphone" className="h-3.5 w-3.5" aria-hidden />
                      Ziyarətçi (telefon)
                    </div>
                    <div className="mt-2 text-4xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">A-12</div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-brand-500 to-sky-400" />
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Önünüzdə 3 nəfər • ~12 dəq</div>
                  </div>

                  {/* Gözləmə zalı ekranı */}
                  <div
                    className="anim-float rounded-2xl bg-slate-950 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                    style={{ animationDelay: '1.2s' }}
                  >
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>Gözləmə zalı ekranı</span>
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <LiveDot />
                        Canlı
                      </span>
                    </div>
                    <div className="mt-2 text-4xl font-extrabold tabular-nums">A-09</div>
                    <div className="mt-3 text-xs text-white/50">Hazırda çağırılan</div>
                  </div>

                  {/* Operator */}
                  <div
                    className="anim-float rounded-2xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/85"
                    style={{ animationDelay: '2.4s' }}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <Icon icon="lucide:layout-dashboard" className="h-3.5 w-3.5" aria-hidden />
                      Operator
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 font-bold text-white shadow-lg shadow-brand-600/30">
                      <Icon icon="lucide:play" className="h-4 w-4" aria-hidden />
                      Növbəti
                    </div>
                    <div className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">1 nəfər gözləyir</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Necə işləyir ===== */}
          <section id="how" className="relative scroll-mt-20 py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-6">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" {...rv(0)}>
                  Necə işləyir
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400" {...rv(80)}>
                  Üç addım — paneli açın, QR-u çap edin, növbəni idarə edin.
                </p>
              </div>

              <div className="relative mt-12">
                <div
                  aria-hidden
                  className="absolute left-[16%] right-[16%] top-12 hidden border-t border-dashed border-slate-300 dark:border-slate-700 lg:block"
                />
                <div className="grid gap-6 md:grid-cols-3">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.n}
                      className="glass glass-card card-hover relative rounded-3xl p-6 text-center"
                      {...rv(i * 90)}
                    >
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-white shadow-lg shadow-brand-600/30">
                        {s.n}
                      </div>
                      <div className="mt-4 flex items-center justify-center gap-2 font-bold">
                        <Icon icon={s.icon} className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" aria-hidden />
                        {s.t}
                      </div>
                      <div className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ===== Funksiyalar ===== */}
          <section
            id="features"
            className="relative scroll-mt-20 border-y border-slate-200/70 bg-slate-100/60 py-16 dark:border-slate-800/70 dark:bg-slate-900/40 md:py-24"
          >
            <div className="mx-auto max-w-6xl px-6">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl" {...rv(0)}>
                  Hər şey <span className="text-gradient">növbə üçün</span>
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-slate-500 dark:text-slate-400" {...rv(80)}>
                  Ziyarətçi, operator və ekran — növbənin bütün tərəfləri üçün hazırlanmış alətlər.
                </p>
              </div>

              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {FEATURES.map((f, i) => {
                  const sizeCls =
                    f.size === 'wide' ? 'md:col-span-2' : f.size === 'full' ? 'md:col-span-3' : ''
                  const isShowcase = f.size === 'wide'

                  const body = (
                    <>
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/15 to-violet-500/15 text-brand-600 dark:text-brand-300">
                        <Icon icon={f.icon} className="h-6 w-6" />
                      </div>
                      <div className="mt-4 text-lg font-bold">{f.title}</div>
                      <div className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</div>
                    </>
                  )

                  return (
                    <div
                      key={f.title}
                      className={`glass glass-card card-hover rounded-3xl p-6 ${sizeCls}`}
                      {...rv(i * 70)}
                    >
                      {isShowcase ? (
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                          <div className="max-w-sm">{body}</div>
                          <MiniDisplay />
                        </div>
                      ) : f.size === 'full' ? (
                        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                          <div className="max-w-lg">{body}</div>
                          <div className="flex gap-3" aria-hidden>
                            {['from-brand-500/70', 'from-sky-400/70', 'from-violet-500/70'].map((c, j) => (
                              <div
                                key={j}
                                className="glass relative grid h-12 w-14 place-items-center overflow-hidden rounded-2xl text-brand-600 shadow-sm dark:text-brand-300"
                              >
                                <Icon icon="lucide:qr-code" className="h-6 w-6" />
                                <span className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${c}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        body
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ===== CTA ===== */}
          <section className="relative overflow-hidden py-20 md:py-28">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="anim-drift absolute left-1/4 top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(27,110,245,.28),transparent_65%)] blur-2xl" />
              <div
                className="anim-drift absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,.24),transparent_65%)] blur-2xl"
                style={{ animationDelay: '-12s' }}
              />
            </div>

            <div className="relative mx-auto max-w-4xl px-6 text-center">
              <div className="glass rounded-[2.5rem] px-8 py-14 shadow-[0_40px_80px_-40px_rgba(15,23,42,.4)] md:px-14" {...rv(0)}>
                <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl" {...rv(60)}>
                  Bir neçə dəqiqəyə <span className="text-gradient">başlayın</span>
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-slate-500 dark:text-slate-400" {...rv(120)}>
                  Pulsuz plan limitsiz ziyarətçi qeydiyyatı təqdim edir.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3" {...rv(180)}>
                  <a
                    href="#/auth"
                    className="btn-sheen inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-8 py-3.5 font-semibold text-white shadow-xl shadow-brand-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-brand-600/45"
                  >
                    Növbə yaradın
                    <Icon icon="lucide:arrow-right" className="h-5 w-5" />
                  </a>
                  <a
                    href="#/panel"
                    className="rounded-xl border border-slate-200/80 px-8 py-3.5 font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:text-brand-600 dark:border-slate-700/80 dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    Demo paneli gör
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ===== Footer ===== */}
        <footer className="border-t border-slate-200/80 py-10 dark:border-slate-800/80">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 md:flex-row">
            <a href="#/" className="flex items-center gap-2 font-extrabold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Icon icon="lucide:qr-code" className="h-4.5 w-4.5" />
              </span>
              QR Növbə
            </a>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <a
                href="#how"
                onClick={scrollTo('how')}
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Necə işləyir
              </a>
              <a
                href="#features"
                onClick={scrollTo('features')}
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Funksiyalar
              </a>
              <a
                href="#/panel"
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Demo
              </a>
              <a
                href="#/auth"
                className="text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
              >
                Başlayın
              </a>
            </nav>
          </div>
          <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} QR Növbə — QR növbə idarəetmə sistemi
          </div>
        </footer>
      </div>
    </div>
  )
}
