const FEATURES = [
  {
    icon: '📱',
    title: 'Tətbiq yükləmək lazım deyil',
    desc: 'Ziyarətçilər telefon kamerası ilə QR-u skan edir və dərhal növbəyə qoşulur.',
  },
  {
    icon: '⚡',
    title: 'Anlıq yeniləmə',
    desc: 'Nömrə çağırılanda ziyarətçinin telefonu avtomatik yenilənir — heç kim nömrəsini qaçırmır.',
  },
  {
    icon: '🖥',
    title: 'Gözləmə zalı ekranı',
    desc: 'Noutbuk və ya televizoru ekran kimi işlədin — xüsusi avadanlıq lazım deyil.',
  },
  {
    icon: '🏷',
    title: 'Brendinq',
    desc: 'Loqonuz, rəngləriniz və adınız ziyarətçilərin gördüyü bütün ekranlarda.',
  },
  {
    icon: '📊',
    title: 'Analitika',
    desc: 'Günlük ziyarət sayı, orta gözləmə vaxtı və xidmət payı — CSV ixracı ilə.',
  },
  {
    icon: '🗂',
    title: 'Çoxfiliallıq',
    desc: 'Bütün filiallarınızı vahid paneldən idarə edin, hər birinə ayrıca QR.',
  },
]

const STEPS = [
  { n: '1', t: 'Filial yaradın', d: 'Panel daxil olub filial və xidmətlərinizi qeyd edin.' },
  { n: '2', t: 'QR-u çap edin', d: 'Hər nöqtə üçün QR avtomatik yaranır — çap edib yerləşdirin.' },
  { n: '3', t: 'Növbəni idarə edin', d: 'Ziyarətçilər QR-u skan edir, siz «Növbəti» düyməsini basırsınız.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Nav */}
      <header className="border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-lg">
            <span className="w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">Q</span>
            Növbə
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#how" className="text-slate-500 dark:text-slate-400 hover:text-slate-800">Necə işləyir</a>
            <a href="#features" className="text-slate-500 dark:text-slate-400 hover:text-slate-800">Funksiyalar</a>
            <a href="#/panel" className="text-slate-500 dark:text-slate-400 hover:text-slate-800">Operator</a>
            <a
              href="#/auth"
              className="rounded-xl bg-brand-600 text-white px-4 py-2 font-semibold hover:bg-brand-700"
            >
              Başlayın
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block text-xs font-semibold bg-brand-50 dark:bg-slate-950 text-brand-700 rounded-full px-3 py-1 mb-5">
          QR növbə idarəetmə sistemi
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
          Növbədə gözləməyə <span className="text-brand-600">son</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Ziyarətçilər QR-u skan edib nömrə alır, gözləyərkən istədikləri yerdə vaxt keçirir,
          nömrə çağıran kimi telefonuna bildiriş alır.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="#/auth"
            className="rounded-xl bg-brand-600 text-white px-6 py-3 font-semibold hover:bg-brand-700 shadow-lg shadow-brand-600/20"
          >
            Pulsuz başlayın
          </a>
          <a
            href="#/panel"
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-6 py-3 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            Operator paneli
          </a>
        </div>

        {/* Mock ekran */}
        <div className="mt-14 rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-brand-50 to-white dark:from-slate-800 dark:to-slate-900 p-8 shadow-xl">
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
              <div className="text-xs text-slate-400 dark:text-slate-500">Ziyarətçi (telefon)</div>
              <div className="text-4xl font-black text-brand-600 mt-2">A-12</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Önünüzdə 3 nəfər • ~12 dəq</div>
            </div>
            <div className="rounded-2xl bg-slate-900 text-white p-5">
              <div className="text-xs text-white/50">Gözləmə zalı ekranı</div>
              <div className="text-4xl font-black mt-2 tabular-nums">A-09</div>
              <div className="text-xs text-white/50">Hazırda çağırılan</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
              <div className="text-xs text-slate-400 dark:text-slate-500">Operator</div>
              <div className="mt-3 rounded-xl bg-brand-600 text-white text-center py-3 font-bold">
                ▶ Növbəti
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">1 nəfər gözləyir</div>
            </div>
          </div>
        </div>
      </section>

      {/* Necə işləyir */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-black text-center">Necə işləyir</h2>
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center font-black">
                {s.n}
              </div>
              <div className="font-bold mt-4">{s.t}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Funksiyalar */}
      <section id="features" className="bg-slate-50 dark:bg-slate-800/40 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center">Hər şey növbə üçün</h2>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
                <div className="text-3xl">{f.icon}</div>
                <div className="font-bold mt-3">{f.title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-black">
          Bir neçə dəqiqəyə <span className="text-brand-600">başlayın</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-3">Pulsuz plan limitsiz ziyarətçi qeydiyyatı təqdim edir.</p>
        <a
          href="#/auth"
          className="inline-block mt-6 rounded-xl bg-brand-600 text-white px-8 py-3 font-semibold hover:bg-brand-700 shadow-lg shadow-brand-600/20"
        >
          Növbə yaradın
        </a>
      </section>

      <footer className="border-t border-slate-100 dark:border-slate-800 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} Növbə — QR növbə idarəetmə sistemi
      </footer>
    </div>
  )
}
