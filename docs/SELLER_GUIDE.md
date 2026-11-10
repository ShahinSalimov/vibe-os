# VIBE OS — satıcı təlimatı

Sıfırdan ilk satışa qədər. Addımları sıra ilə et; hər biri bir dəfə edilir.

## Demo linki (müştəriyə göndərmək üçün)

Müştəriyə əvvəlcə **yalnız demo** versiyanı göndərirsən: brauzerdə açılır, heç nə quraşdırmaq lazım deyil, real istifadə üçün "Tam versiya — satıcıya yazın" deyir. Demo versiyanı yenidən yığmaq (əlaqə linkin ilə):

```bash
python3 scripts/build_web_demo.py demo-web https://instagram.com/SƏNİN-SƏHİFƏN
```

`demo-web` qovluğunu Netlify-ə yüklə, linki müştərilərə göndər.

## Satış necə işləyir

1. Instagram / TikTok-da müğənniyə təqdimat mətni və demo linki göndərirsən.
2. Müğənni tətbiqi quraşdırır və **"Demonu aç"** ilə dolu nümunəyə baxır.
3. Bəyənsə, öz profilini qurur: **3 gün pulsuz** hər şey işləyir.
4. Ödənişi səninlə birbaşa edir (tətbiqdə ödəniş yoxdur).
5. Sən təsdiqləyirsən — iki yoldan biri:
   - **Ən sadə:** admin paneldə müştərinin sətrində **"Aktivləşdir"** düyməsi. Müştəriyə heç nə göndərmək lazım deyil, tətbiqi növbəti açanda aktiv olur.
   - **Kodla:** admin paneldə kod yaradırsan, hazır mesajı göndərirsən; müğənni **Digər → Lisenziya** bölməsində daxil edir.
6. Tətbiq həmişəlik açılır (birdəfəlik ödəniş).

Vacib: müştəri sınağın ilk günündən **e-poçtla daxil olsun** (Digər → Hesab və bulud). Yalnız daxil olan müştəri admin paneldə görünür və "Aktivləşdir" düyməsi ilə təsdiqlənə bilər. Sınaq tətbiqin ilk açıldığı gündən sayılır.

Sınaq bitib almayanlar admin paneldə **"Sınağı bitib, almayıb"** siyahısındadır: ən isti satış siyahın.

---

## 1. Server (Supabase) — 15 dəq

1. https://supabase.com → qeydiyyat → **New project**. Region: **Frankfurt**.
2. **SQL Editor → New query**. `supabase/setup_all.sql` faylını tam kopyala, yapışdır, **Run** bas. (Bütün qurulum bir fayldadır, bir dəfə işə salınır.)
3. **Authentication → Providers → Email**: aktiv.
4. **Authentication → Email Templates → Magic Link**: mətndə `{{ .Token }}` olsun (6 rəqəmli kod).
5. Müştərilər çoxalanda **Authentication → SMTP** bölməsində öz e-poçt servisini qoş (Supabase-in daxili poçtu saatda bir neçə məktubla məhduddur).

## 2. Özünü admin et

1. **Authentication → Users → Add user → Create new user**: öz e-poçtunu yaz, istənilən şifrə, **Auto Confirm User** işarəli olsun.
2. **SQL Editor**-da bu sətri işə sal (e-poçtu öz e-poçtunla əvəz et):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'sənin@email.az';
```

## 3. Açarlar

**Project Settings → API**: `Project URL` və `anon public` açarını kopyala.

- Layihədə `.env.example` faylını `.env` adı ilə kopyala və doldur:
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_BOOKING_PAGE_URL` — sifariş səhifəsinin ünvanı (5-ci addım)
  - `EXPO_PUBLIC_SELLER_CONTACT_URL` — sənin Instagram linkin (Lisenziya ekranında "Satıcı ilə əlaqə")
- `booking-page/config.js` və `admin/config.js` fayllarına eyni URL və anon açarı yaz.

`anon` açarı ictimaidir, qoruma serverdədir. **`service_role` açarını heç vaxt heç yerə qoyma.**

## 4. Admin panel

`admin/` qovluğunu (2 fayl) istənilən statik hostinqə yüklə. Ən sadəsi: https://app.netlify.com/drop — qovluğu sürüşdürüb burax, link alırsan. Linki heç kimlə paylaşma (paylaşsan belə, admin olmayan heç nə görə bilməz).

## 5. Sifariş səhifəsi

`booking-page/` qovluğunu eyni üsulla ayrıca yüklə. Ünvanı `.env`-də `EXPO_PUBLIC_BOOKING_PAGE_URL`-ə yaz. Hər müğənninin linki: `https://SƏNİN-ÜNVAN/?a=müğənni-adı` (tətbiqdə Sifarişlər bölməsində özü görünür).

## 6. Android tətbiqi (APK)

Pulsuz Expo hesabı lazımdır (https://expo.dev). Kompüterdə, layihə qovluğunda:

```bash
npm install -g eas-cli
```

```bash
eas login
```

```bash
eas build --profile preview --platform android
```

Bitəndə APK linki verilir. Bu linki müştərilərə göndərirsən: açır, "naməlum mənbələrdən quraşdırma"ya icazə verir, quraşdırır. Bu versiyada **səslə daxiletmə** də işləyir.

## 7. iPhone

iPhone App Store-dan kənar quraşdırmaya icazə vermir. İki yol:

| Yol | Nə lazımdır | Qeyd |
|---|---|---|
| **Veb versiya** | Hostinq (Netlify) | Safari → Paylaş → "Ana ekrana əlavə et". Səs tanıma və barmaq izi kilidi məhduddur |
| **App Store** | Apple Developer (illik 99 $) | Tam versiya; Apple yoxlaması və qaydaları |

Veb versiyanı yığmaq:

```bash
npx expo export --platform web --output-dir web-build
```

`web-build` qovluğunu Netlify-ə yüklə.

## 8. Yeniləmələr

Kodda dəyişiklik olanda yeni APK yığırsan. Android-də müştəri yenisini köhnənin üstünə quraşdırır; məlumatlar qalır (telefonda və buludda).

## Yoxlama siyahısı (ilk satışdan əvvəl)

- [ ] `setup_all.sql` işə salınıb (xətasız "Success")
- [ ] Özünü admin etmisən, admin paneldə statistikanı görürsən
- [ ] Test kodu yaratdın, ikinci telefonda tətbiqdə aktivləşdirdin, paneldə "İstifadə olunub" göründü
- [ ] Sifariş səhifəsindən test sorğusu göndərdin, tətbiqə düşdü
- [ ] APK-nı başqa Android telefonda quraşdırıb "Demonu aç" ilə yoxladın
