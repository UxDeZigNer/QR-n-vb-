# E-poçt Təsdiqi Qurulması — Addım-addım

> **Məqsəd:** «Confirm your email address» e-poçtu Supabase-dən yox, **QR Növbə brendi ilə**
> və **sənin domenindən** (no-reply@free.je) gəlsin.
>
> Fayllar: bu fayl + `email-template-confirm.html` (hazır template).

---

## Ümumi mənzərə

| Hissə | Harada dəyişilir | Kim edir |
|-------|------------------|----------|
| 1. Poçt hesabı (SMTP göndərəni) | InfinityFree Panel | Sən (2 dəq) |
| 2. Site URL + Redirect URLs | Supabase Dashboard | Mən (token versən) və ya sən |
| 3. SMTP tənzimləməsi | Supabase Dashboard | Mən (token versən) və ya sən |
| 4. Email template (dizayn + dil) | Supabase Dashboard | Mən (token versən) və ya sən |

---

## Addım 1 — SMTP göndərəni seç

> ⚠️ **Düzəliş (2026-11-18):** InfinityFree **pulsuz** planda email hesabı **vermir**
> (rəsmi: "No E-mail Accounts", `mail()` də bloklanır). Paneldeki "Manage Email Address"
> yalnız profil e-poçtudur. Ona görə **xarici SMTP** lazımdır.

### Variant A — Gmail (ən sürətli, ~5 dəq)
Göndərən: `QR Növbə <mahirveliyev@gmail.com>` — artıq Supabase-dən fərqlidir.

1. Google Hesab → **2FA (Two-step verification)** aktiv et
2. <https://myaccount.google.com/apppasswords> → yeni app password yarat (ad: `supabase`)
3. 16 simvolu saxla → Addım 3-də istifadə et:
   - **Host:** `smtp.gmail.com` · **Port:** `587` · **User:** gmail ünvanın · **Pass:** app password

### Variant B — Brevo (peşəkar, `no-reply@free.je`, ~15 dəq)
Göndərən: `QR Növbə <no-reply@free.je>` — tam sənin domenindən.

1. <https://app.brevo.com> → qeydiyyat (pulsuz, 300 e-mail/gün)
2. **Senders & Domains** → **Add a sender** → `no-reply@free.je`
3. DNS doğrulama: Brevo SPF/DKIM TXT qeydlərini **InfinityFree Panel → DNS Records**-a əlavə et
4. Doğrulama gözlə → Addım 3-də:
   - **Host:** `smtp-relay.brevo.com` · **Port:** `587` · **User:** Brevo-login · **Pass:** Brevo SMTP-klucz

---

## Addım 2 — Supabase: URL tənzimləməsi

**Dashboard** → `evqzagjoztmybvwvrjca` → **Project Settings** → **Authentication** → **URL Configuration**

- **Site URL:** `https://qr.free.je/`
- **Redirect URLs** (əlavə et):
  ```
  https://qr.free.je/*
  https://uxdezigner.github.io/QR-n-vb-/*
  http://localhost:5173/*
  ```
- **Save** et

> `emailRedirectTo` artıq kodda düzgündür (`${appUrl()}#/dashboard`) —
> problem yalnız allow listdədir, bu addım onu həll edir.

---

## Addım 3 — Supabase: SMTP

**Dashboard** → **Project Settings** → **Authentication** → **Emails** → **SMTP Settings**

- **Enable SMTP** ✓
- **Sender email:** `noreply@free.je`
- **Sender name:** `QR Növbə`
- **Host:** `mail.free.je`
- **Port:** `465`
- **User:** `noreply@free.je`
- **Password:** (Addım 1-də yaratdığın parol)
- **Save** et

---

## Addım 4 — Supabase: Email template

**Dashboard** → **Authentication** → **Emails** → **Confirm signup** → **Edit template**

1. Bütün mövcud mətni sil
2. `supabase/email-template-confirm.html` faylının **mətnini** tam kopyala-şəkil et
3. **Save** et

Template xüsusiyyətləri:
- Azərbaycan dili
- Brend rəngi `#1b6ef5` (logo kvadratı, düymə)
- **Emoji yox**, Iconify-ə uyğun minimalist dizayn
- `{% raw %}{{ .ConfirmationURL }}{% endraw %}` və `{% raw %}{{ .Email }}{% endraw %}` — Supabase dəyişənləri toxunulmaz qalmalıdır

---

## Test

1. Saytı aç → **Qeydiyyat** → Ad Soyad + email + şifrə
2. E-poçt gəlməlidir:
   - **From:** `QR Növbə <noreply@free.je>` ← Supabase-dən yox, sənəndən
   - **Subject:** default qala bilər, istəyirsən dəyiş (Addım 4-də subject sahəsi ayrıca var)
   - Dizayn: mavi başlıqlı QR Növbə kartı
3. «E-poçtu təsdiqlə» → `https://qr.free.je/#/dashboard` açılır ✓
4. Xəta olarsa: Supabase **Logs** → **Auth** bölməsində səbəbi görünür

---

## Mənə nə lazımdır (özüm edim deyirsənsə)

1. **Supabase Access Token** → <https://supabase.com/dashboard/account/tokens> → *Generate new token*
   (yalnız mənə ver, sonra ləğv edə bilərsən)
2. **Addım 1-i sən et** (InfinityFree paneldə poçt hesabı — mənim panel girişi yoxdur)
3. Token + SMTP parolunu ver → Addım 2, 3, 4-ü API ilə özüm quraram

---

## Tez-tez olan xətalar

| Xəta | Səbəb |
|------|-------|
| `redirect_to is not allowed` | Addım 2 — Redirect URLs listinə əlavə etməmisən |
| E-poçt gəlmir | SMTP parol/PORT səhv və ya spam qovluğuna düşüb |
| Spam qovluğu | SPF/DKIM — `mail.free.je` ilə avtomatik həll olur (eyni domen) |
| Template dəyişmədi | «Confirm signup» yox, «Magic Link» səhv düyməni seçmisən |
