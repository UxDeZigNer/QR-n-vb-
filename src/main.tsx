import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// InfinityFree bot-challenge ilk açılışda `location.href="/?i=1"` edərək
// hash-i (#/q/slug) itirir. `?i=1` yalnız bu challenge tərəfindən verilir;
// cookie artıq qoyulduğuna görə history.back() QR səhifəsini düzgün qaytarır.
//
// Guardlar (əvvəlki `history.length > 1` bypass-ı işləmirdi):
// - `history.length` yoxlanılmır — bəzi skaner/in-app WebView-lərdə
//   (WhatsApp, kamera, Instagram) həmişə 1 göstərir, back() heç
//   çağırılmırdı. Back() length==1 olsa zərərsizdir.
// - DOMContentLoaded-dək gözlənir — bəzi brauzerlərdə module top-level
//   navigation ignored olunur; lazım gələrsə 500ms × 5 retry.
// - 4s loop-guard — əgər challenge cookie-ni qəbul etməyib yenidən
//   `/?i=1` qaytarsa, sonsuz back() döngəsinə düşmürük.
const QR_LOOP_KEY = 'qr_i1_last_attempt'

const qrBypass = () => {
  if (!/[?&]i=1/.test(location.search) || location.hash) return

  const now = Date.now()
  let last = 0
  try {
    last = Number(sessionStorage.getItem(QR_LOOP_KEY) || 0)
  } catch {
    /* storage yoxdur — keç */
  }
  if (now - last < 4000) return // yaxın zamanda artıq cəhd olunub — loop deyil
  try {
    sessionStorage.setItem(QR_LOOP_KEY, String(now))
  } catch {
    /* keç */
  }

  history.back()
  // Back() ignored olunarsa (load zamanı navigator restriction) — yoxla,
  // hələ də `?i=1`-dədirsək yenidən cəhd et. Uğurlu olsa səhifə
  // unload olur və interval öz-özünə silinir.
  let tries = 0
  const t = window.setInterval(() => {
    if (!/[?&]i=1/.test(location.search) || location.hash || ++tries > 5) {
      window.clearInterval(t)
    } else {
      history.back()
    }
  }, 500)
}

// Sync script execution zamanı navigation bəzi brauzerlərdə ignored
// oluna bilər — növbəti task-a keçirik (paint-dən əvvəl).
setTimeout(qrBypass, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
