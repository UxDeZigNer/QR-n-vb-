import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// InfinityFree bot-challenge ilk açılışda `location.href="/?i=1"` edərək
// hash-i (#/q/slug) itirir. `?i=1` yalnız bu challenge tərəfindən verilir;
// cookie artıq qoyulduğuna görə history.back() QR səhifəsini düzgün qaytarır.
if (/[?&]i=1/.test(location.search) && !location.hash && history.length > 1) {
  history.back()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
