/** Tətbiqin hazırkı əsas ünvanı — harada host olunmasından asılı olmayaraq
 * (GitHub Pages /QR-n-vb-/ alt yolu, və ya kök domen qr.free.je) */
export function appUrl(): string {
  let p = window.location.pathname
  p = p.replace(/index\.html$/, '')
  if (!p.endsWith('/')) p += '/'
  return window.location.origin + p
}
