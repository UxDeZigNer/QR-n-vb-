# MASTER — QR Növbə (qr-novbe)

> Layihənin ümumi məqsədi, arxitekturası və vacib qaydaları. Dəyişiklik olanda yenilə.
> İş vəziyyəti → `PROGRESS.md` · Tarixçə → `SESSION_LOG.md`

## Məqsəd
QR növbə sistemi: ziyarətçi QR skan edir → nömrə alır → operator çağırır → gözləmə zalı ekranında görünür. Kiçik təşkilatlar (klinikalar, xidmət mərkəzləri) üçün sadə, ödənişsiz SaaS.

## Stack
- **Frontend:** Vite + React 19 + TypeScript + Tailwind 4, HashRouter (GH Pages-də server rewrite olmadan işləyir)
- **Backend:** Supabase (`evqzagjoztmybvwvrjca`) — auth (PKCE), Postgres, RLS, atomic RPC: `join_queue`, `call_next`, `reset_branch`
- **İkonlar:** Iconify lucide — **emoji yox** (standing qayda)
- **Brend:** `#1b6ef5`, Plus Jakarta Sans, glassmorphism (`.glass`, `.glass-card`)

## Səhifələr (route-lar)
| Route | Səhifə | Qeyd |
|-------|--------|------|
| `#/` | Landing | Demo panelə 4 link |
| `#/q/:slug` | Visitor | Ziyarətçi — nömrə almaq |
| `#/panel` | Operator | **Yalnız statik demo** (PanelDemo) — real data yox |
| `#/panel/:slug` | Operator | Real operator paneli |
| `#/display/:slug` | Display | Gözləmə zalı ekranı (TV) |
| `#/auth` | Auth | Giriş + qeydiyyat + "Şifrəni unutdum" |
| `#/reset-password` | ResetPassword | PKCE bərva linki |
| `#/dashboard/*` | Dashboard | Təşkilat idarəsi (glass restyle) |

## Arxitektura qaydaları
- **`#/panel` (slug-sız) heç vaxt real filial data göstərmir** — `Operator.tsx`-də `if (!slug) return <PanelDemo />`. Bütün başqa istifadəçilərin filialları sıralanması (BranchPicker) silinib — **məxfilik sızıntısı idi, geri qaytarmaq olmaz**.
- Landing-dəki demo linklər "Demo / Demo panel" adlanır — "Operator paneli" yalnız real `#/panel/:slug`-da.
- Demo data statikdir (düzgün — demo üçün nümunə), real data yalnız Supabase-dən.
- Hər widget yalnız real data göstərir; boş vəziyyətdə icon + izah yazısı olur (demo/yalan data yox).

## Deploy
- Repo: `UxDeZigNer/QR-n-vb-` → GitHub Actions (`.github/workflows/deploy.yml`)
- Push → build (`tsc -b` + `vite build`) → **GH Pages** + **FTP** (lftp `mirror -R --delete` → **yalnız** `/qr.free.je/htdocs/`)
- Canlı: `https://qr.free.je` (InfinityFree, `185.27.134.155`) + ehtiyat `https://uxdezigner.github.io/QR-n-vb-/`
- Push üçün: `git -c credential.helper=` + PAT (keychain-dəki `mahirvelizade` hesabı 403 verir) — PAT `SESSION_LOG.md`-də, iş bitəndə ləğv et

## Yoxlama (hər dəyişiklikdən sonra)
```bash
npx tsc -b && npx vite build && npx oxlint src/
```
- `oxlint`-də yalnız köhnə `Date()` + `off` reassign warning-ləri var — normaldır
- qr.free.je curl-ə AES bot-challenge verir (brauzer keçir) — Node script: `/private/var/folders/.../opencode/qr_fetch.js`
- FTP server sürətli əmrlərdə 421 timeout verir — deploy yalnız Actions üzərindən

## Vacib qaydalar (Mahir)
1. **Heç nə silmə, köçürmə, üstünə yazma** — əvvəlcə icazə al (fayl, qovluq, cədvəl, branch, temp — nə olursa).
2. **Hər şeyi `.md`-də saxla** — sessiya sonunda `PROGRESS.md` + lazım olsa `SESSION_LOG.md` yenilə.
3. **Azərbaycan dili, qısa konkret cavablar.**
4. **Emoji yox** — Iconify lucide.
5. Gizli açarlar yalnız `SESSION_LOG.md`-də (`.gitignore`-da) — repoya düşmür, iş bitəndə ləğv et.
