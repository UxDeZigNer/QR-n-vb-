# QR Növbə Sistemi

QR skan → ziyarətçi nömrə alır → real-time izləyir → operator «Növbəti» basır → gözləmə zalı ekranında görünür.

## Texnologiyalar

- **Frontend:** Vite + React + TypeScript + Tailwind CSS 4 (SPA)
- **Backend:** Supabase (PostgreSQL + Realtime + Auth)
- **Hosting:** GitHub Pages (push = avtomatik deploy)

## Səhifələr

| Route | Nədir |
|---|---|
| `#/` | Landing (təqdimat) |
| `#/q/<slug>` | Ziyarətçi — QR-skan → nömrə |
| `#/panel/<slug>` | Operator paneli |
| `#/display/<slug>` | Gözləmə zalı ekranı (TV) |
| `#/auth` | Giriş / qeydiyyat |
| `#/dashboard` | İdarəetmə (filial, xidmət, QR yükləmə) |

## Quraşdırma

```bash
npm install
cp .env.example .env    # Supabase URL + anon key doldur
npm run dev
```

## Veritabanı

`supabase/schema.sql` faylını Supabase **SQL Editor**-də bir dəfə işə salın.
Sxemə daxildir: cədvəllər, RLS siyasətləri, atomik `join_queue` / `call_next` RPC.

## Deploy

`.github/workflows/deploy.yml` → push `main`-ə → GitHub Pages-ə avtomatik çıxır.
Repo ayarlarında: **Settings → Pages → Source: GitHub Actions**.

Environment dəyərləri (Settings → Secrets and variables → Actions → Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
