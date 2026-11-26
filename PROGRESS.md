# PROGRESS — QR Növbə (qr-novbe)

> İndiyə qədər görülən iş, cari mərhələ, dəyişdirilmiş fayllar, növbəti addımlar.
> Hər əsas tapşırıqdan sonra yenilə. Arxitektura → `MASTER.md` · Tarixçə → `SESSION_LOG.md`

## Cari vəziyyət (2026-11-26)
- **Son commit:** `96c2ebf` → Actions #35 **success** (yalnız `PROGRESS.md` — kod dəyişməyib)
- **Mərhələ:** Yeni iş yoxdur — Demo panel (`e6afa7b`) + bütün sonrakı commit-lər canlıda. İstifadəçi rəyi gözlənilir.

### 2026-11-26
- Sessiya yoxlama sessiyası idi: `MASTER.md` + `PROGRESS.md` oxundu, Demo panel işi (`e6afa7b`, Actions #28) təsdiqləndi — canlıda, kod dəyişikliyi olmadı.
- `PROGRESS.md` commit olunmamış dəyişikliyi saxlanıldı → `96c2ebf` (Actions #35 ✓).

### 2026-11-25
- **Commit `d91e705` (Actions #34 ✓)** — **QR ilk açılış problemi:** InfinityFree bot-challenge ilk açılışda `location.href="/?i=1"` edib hash-i (`#/q/slug`) itirir → Landing açılır. Həll: `main.tsx`-də bypass — `?i=1` + hash yox → `history.back()` (cookie challenge-dan sonra qoyulub, əvvəlki URL QR səhifəsidir → düzgün load olunur). Challenge free hesabda mandatory, söndürülmür.
- **Commit `82596cc` (Actions #31 ✓)** — Selectlərə sağ padding (arrow küncə yapışmırdı): Operator "Mən kiməm" select + Dashboard filial select → `pr-9`.
- **Commit `abd519b` (Actions #32 ✓) + `0c685eb` (#33, retry)** — **Bitməmiş bilet problemi:** A-1 `called`-da qalırdı (gözləyən yox olanda `call_next` exception + rollback). Həll:
  - **"Xidmət tamam ✓" düyməsi** — Operator paneli çağırılan kartında (yaşıl, canlıda təsdiqləndi ✓) + Dashboard "Hazırda çağırılan" widget-ında
  - `queue.ts` → `finishTicket()`: əvvəl `finish_ticket` RPC, xəta olsa RLS fallback (birbaşa update, org sahibi üçün)
- **Diaqnoz: qr.free.je "köhnə" görünürdü = Chrome cache** (deyil FTP). Düzgün yoxlama: FTP-ə birbaşa → hər şey yenidir (`index-Qy9jsWAF.js` + yeni `index.html`) · DNS `185.27.134.155` ✓ · təmiz Chrome profil → yeni bundle ✓
- **Yeni SQL faylları (dashboard-da Run gözləyir — token lazım deyil):**
  - `supabase/finish_ticket.sql` — `finish_ticket(uuid)` security definer + grant → **login-siz hər kəs üçün** işləyəcək
  - `supabase/call_next_update.sql` — `call_next` gözləyən yox olanda exception əvəzinə cari biletə `done` verib `null` qaytarır (frontend `callNext` artıq `null` dəstəkləyir)
- **Növbəti addım:** Supabase Dashboard → SQL Editor → hər iki faylı Run et. Sonra hər kəs (login-siz) "Xidmət tamam" + "Növbəti" ilə bileti bitirə biləcək.

### 2026-11-25 (əvvəlki)
- **Commit `b66fb26` (Actions #30 ✓)** — Operator paneli + Skan restyle:
  - **Operator.tsx (real panel):** bg-grid + drift orbs fon, glass-strong sticky header (logo + filial + gözləyən badge), çağırılan kartı gradient + anim-ping canlı nöqtə + icon-lı meta (istifadəçi/xidmət/operator), **"Mən kiməm" select əməliyyatlar blokuna köçürüldü** (header-da sıxılırdı), Növbəti btn-primary + gözləyən sayı badge-i, glass modal, Gözləyənlər boş vəziyyət icon+hint, xəta bannerı icon-lı
  - **Visitor.tsx (Skan):** bg-grid + orb, glass-strong header, çağırılan nömrə kartı (glass + canlı pill), qoşulma kartı (icon başlıq, xidmət düymələri icon + "~X dəq gözləmə" + seçildikdə brend fill, input icon-lı, btn-primary, "printer lazım deyil" qeydi), nömrə kartı gradient + status iconları, təxmini gözləmə kartı (icon + qeyd), status sətirləri `InfoRow` (icon + etiket + dəyər)
  - **Yoxlama:** `tsc` ✓ `vite build` ✓ · lokal preview + headless Chrome screenshot (panel + skan) ✓ · canlı qr.free.je + GH Pages hər ikisi `index-CUCw6fIw.js`, yeni stringlər bundle-da ✓, canlıdan screenshot hər iki səhifə ✓
  - **Tapıntı:** headless Chrome `--window-size=430` belə **500px** viewport saxlayır (minimum) — şəkil kəsilməsi test aləti idi, layout düzgün

## Tamamlanmış (son 4 sessiya)

### 2026-11-24
1. **InfinityFree qəzası diaqnostika + bərpa** — 24 IP qəzası (03:12 UTC), `185.27.134.155` qəzada idi; sayt və FTP öz-özünə bərpa oldu, silinmə yox idi.
2. **Commit `e6afa7b` (Actions #28 ✓)** — Landing 4 link "Operator paneli"→**"Demo / Demo panel / Demo paneli gör"**; `Operator.tsx` PanelDemo restyle: browser çərçivəsi (URL bar + DEMO nişanı), mini sidebar, stat kartlar, "Bu demo-dur — real panel üçün qeydiyyatdan keçin ↓", qeydiyyat təşviqi kartı.
3. **Commit `419a58c` (Actions #29 ✓)** — Dashboard boş-widgetlar zənginləşdi:
   - `StatCard` + `icon`/`hint` (4 kart: bell-ring, users, calendar-check, clock — boş/dolu mətn fərqli)
   - `EmptyChart` icon + başlıq + izah (radar / user-round-check)
   - Boş siyahılar: inbox, bell-off, calendar-x, user-plus, info banner; "Son 7 gün" info banner

### 2026-11-23 (`b7e987d`, Actions #27 ✓)
- **Məxfilik sızıntısı bağlandı:** `BranchPicker` (hər kəsin filialları hamıya sıralanırdı) silindi → `PanelDemo`.
- Dashboard glass restyle tamamlandı (bg-grid + orb, glass sidebar/header/kartlar, `btn-primary`, `section-in`).

### 2026-11-20 (`09a64d2`, Actions #26 ✓)
- Landing yenidən yazıldı (glassmorphism, scroll-reveal, Plus Jakarta Sans, bento grid). Light-də glass sərhədi pixel-scan ilə düzəldildi.
- ScanQueue araşdırıldı → istifadəçi **rədd etdi** ("sadəlikdən çıxır") — heç bir funksiya əlavə olunmadı.

### 2026-11-19 (`57f961b`, Actions #25 ✓)
- "Şifrəni unutdum" + `ResetPassword.tsx`; `flowType: 'pkce'` açıldı (HashRouter-lə stabil).

## Dəyişdirilmiş fayllar (cari — hamısı canlıda)
| Fayl | Vəziyyət |
|------|----------|
| `src/pages/Landing.tsx` | Demo linkləri (4 × `#/panel`) |
| `src/pages/Operator.tsx` | `PanelDemo` browser-frame + `if (!slug) return <PanelDemo />`; BranchPicker silinib |
| `src/pages/Dashboard.tsx` | Glass restyle + StatCard icon/hint + EmptyChart + boş vəziyyətlər |
| `src/index.css` | `.glass*`, `btn-primary`, `section-in`, animasiyalar |
| `src/pages/Auth.tsx` / `ResetPassword.tsx` | Forgot-password + PKCE |
| `src/App.tsx` | Route-lar (temp `/widget-preview` silindi, geri qaytarıldı) |
| `SESSION_LOG.md` | 2026-11-24 qeydləri (gitignored) |

## Növbəti konkret addımlar
1. **Supabase Dashboard → SQL Editor → Run:** `supabase/finish_ticket.sql` + `supabase/call_next_update.sql` (token lazım deyil) → login-siz bitirmə həlli aktiv olacaq
2. **İstifadəçi rəyi** — yeni operator paneli + Skan səhifəsi (glass), "Xidmət tamam" düyməsi, select padding: bəyənmə/yenidən düzəliş.
2. **Test:** `qr.free.je/#/auth` → "Şifrəni unutdum" → e-poçt çatırmı? (SMTP hələ qurulmayıb — çatmasa variantlar: A) Gmail app password, B) Brevo; `supabase/EMAIL_SETUP.md` Addım 1).
3. Təsdiq olanda → dashboard-a real girişlə vizual test (giriş hesabı yoxdur — test hesabı yaratmaq lazım ola bilər).

## Həll olunmamış problemlər
- **SMTP/Confirm email:** Supabase pulsuz plan + default provider → `entitlement_required`. SMTP qurulmayıb (istifadəçi saxladı: "qalsın hələlik").
- **PinClick 16 itkin şəkil** (404) — mənbə tapılmadı; Mahirdən backup (köhnə disk/Drive/iCloud) soruşulacaq.
- **OFFLINE sualı** — tam offline mümkün deyil; PWA/hibrid variantları sonra.
- **Temp fayllar silinməsi — İCAZƏ GÖZLƏYİR** (heç nə silinməyib): opencode temp-də `qr_*.png`, `new_*.png`, `live_*.png`, `final_live_*.png`, `verify*.png`, `dist-light/`, `frametest/`, `chrome-profile*` + FTP-də `_probe.txt`, `/_ziptest/`, `peek_*.php`, `mahirvelizade.space` test txt-ləri.
- **Gizli açarlar ləğv olunmayıb:** GitHub PAT `ghp_…` + Supabase token `sbp_…` (hər ikisi `SESSION_LOG.md`-də) → iş bitəndə ləğv et.
- `oxlint` köhnə warning-ləri: `Date()` yoxlanışı + `Dashboard.tsx` `off` reassign — düzəlməyib, low-priority.

## Vacib texniki qərarlar
- **`#/panel` slug-sız = statik demo** — məxfilik sızıntısının həlli; geri qaytarmaq olmaz.
- **HashRouter** — GH Pages rewrite olmadan işləyir; naviqasiya `scrollIntoView` ilə (`#how` router-i pozurdu).
- **PKCE** — bərva linki eyni brauzerdə açılmalıdır.
- **Deploy yalnız Actions üzərindən** — FTP 421 timeout verir; hədəf dəqiq `/qr.free.je/htdocs/` (`mirror --delete` + `/` kökü = kütləvi itki).
- **qr.free.je AES challenge** — curl ilə yoxlanılmır; Node vm script (`qr_fetch.js`) real HTML verir.
- **E-poçt brendi:** `no-reply@free.je` (Supabase-dən yox) — hazır template: `supabase/email-template-confirm.html`.
- **ScanQueue funksiyaları rədd edildi** — sistemin sadəliyi qorunur.
