# Buludu qoşmaq (Supabase)

Bu addımlar bir dəfə edilir. Pulsuz Supabase planı başlanğıc üçün kifayətdir.

## 1. Layihə yaratmaq
1. https://supabase.com saytında qeydiyyatdan keçin, **New project** basın.
2. Region: **Frankfurt (eu-central-1)**. Azərbaycana ən yaxın regiondur.
3. Database şifrəsini təhlükəsiz yerdə saxlayın.

## 2. Verilənlər bazasını qurmaq
1. Sol menyu: **SQL Editor** → **New query**.
2. `supabase/migrations/0001_init.sql` faylının məzmununu tam kopyalayıb yapışdırın, **Run** basın.

## 3. E-poçt kodu ilə giriş
1. **Authentication → Providers → Email**: aktiv olsun.
2. **Authentication → Email Templates → Magic Link**: mətndə `{{ .Token }}` olsun (6 rəqəmli kod göndərilir).
3. Real istifadə üçün **Authentication → SMTP** bölməsində öz e-poçt servisinizi qoşun. Supabase-in daxili e-poçtu saatda bir neçə məktubla məhdudlaşır.

## 4. Tətbiqə qoşmaq
1. **Project Settings → API**: `Project URL` və `anon public` açarını kopyalayın.
2. Layihə qovluğunda `.env.example` faylını `.env` adı ilə kopyalayın və dəyərləri yazın.
3. `booking-page/config.js` faylına eyni iki dəyəri yazın.

`anon` açarı ictimai açardır, gizli saxlamaq lazım deyil. Qoruma verilənlər bazasındakı RLS qaydaları ilə təmin olunur. `service_role` açarını isə heç vaxt tətbiqə və ya sayta qoymayın.

## 5. Sifariş səhifəsini yerləşdirmək
`booking-page/` qovluğu iki fayldan ibarət statik saytdır. Onu Netlify, Vercel, GitHub Pages və ya öz domeninizdə yerləşdirə bilərsiniz. Ünvanı `.env` faylında `EXPO_PUBLIC_BOOKING_PAGE_URL` dəyərinə yazın.

Sənətçinin linki: `https://SİZİN-ÜNVAN/?a=sənətçi-adı`

## Yoxlama
```bash
bash tests/db/run.sh
```
Bu test sxemi lokal PostgreSQL-də yoxlayır: müğənnilərin bir-birinin məlumatını görməməsi, rolları, kart qadağası və sifariş limiti.
