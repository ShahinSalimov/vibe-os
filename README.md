# VIBE OS

Müğənnilər, musiqiçilər və onların komandaları üçün mobil idarəetmə tətbiqi (iOS + Android).
Dillər: Azərbaycan, rus, ingilis.

## Phase 1 — hazır olanlar

| Hissə | Vəziyyət |
|---|---|
| 3 dil (AZ / RU / EN), dil istənilən an 1 kliklə dəyişir | hazır |
| Onboarding: dil seçimi + 3 addım (ad, peşə/janr, valyuta) | hazır |
| Dizayn sistemi (tünd "səhnə" teması, böyük düymələr) | hazır |
| Əsas ekran: gündəlik brifinq, sürətli əlavə, aylıq maliyyə | hazır |
| Tədbirlər: 9 növ (toy, konsert, korporativ...), təqvim, eyni günə düşən tədbir xəbərdarlığı | hazır |
| Maliyyə (yalnız qeyd): gəlir/xərc, status, qismən ödəniş, "Kim kimə borcludur" | hazır |
| Kart nömrəsi / IBAN bloku (bütün mətn sahələrində) | hazır |
| Tətbiq kilidi (Face ID / barmaq izi / PIN) | hazır (yalnız real telefonda) |
| Məlumatlar telefonda saxlanır, tətbiq bağlananda itmir | hazır |

## Phase 2 — hazır olanlar

| Hissə | Vəziyyət |
|---|---|
| Hesab: e-poçt kodu ilə giriş (şifrəsiz) | hazır, Supabase qoşulanda işləyir |
| Bulud sinxronizasiyası (bir neçə telefon, oflayn işləyir, son dəyişiklik qalib gəlir) | hazır |
| Server təhlükəsizliyi: hər müğənninin məlumatı ayrı (RLS), rollar, kart/IBAN qadağası | hazır, real PostgreSQL-də test olunub |
| İctimai sifariş səhifəsi (`booking-page/`), 3 dil, limit: saatda 30 sorğu | hazır |
| Sifarişlər bölməsi: status, zəng/WhatsApp, bir kliklə tədbirə çevirmək | hazır |
| Kontaktlar (təşkilatçı sifariş təsdiqlənəndə avtomatik əlavə olunur) | hazır |

Buludu qoşmaq üçün: [docs/SETUP_CLOUD.md](docs/SETUP_CLOUD.md)

## Səslə daxiletmə

| Hissə | Vəziyyət |
|---|---|
| "Səslə əlavə et": bir cümlə → tədbir, gəlir və ya xərc forması avtomatik dolur | hazır |
| Cümlə təhlili AZ / RU / EN: tarix, saat, növ, şəhər, məbləğ, avans, valyuta, ad | hazır, 17 real cümlə ilə test olunub |
| Mətn sahələrində mikrofon düyməsi (diktə) | hazır |
| Səslə deyilən heç nə özbaşına yadda saxlanmır, istifadəçi yoxlayıb təsdiqləyir | hazır |

Qeyd: səs modulu Expo Go-da işləmir, development build tələb edir (`npx expo run:android` / `run:ios` və ya EAS Build). Expo Go-da tətbiq səs düyməsi əvəzinə klaviaturanın mikrofonunu təklif edir.
Azərbaycan dilində tanıma Android-də (Google) dəstəklənir. iOS-da Azərbaycan dilinin dəstəyi real cihazda yoxlanmalıdır.

## Studiya

| Hissə | Vəziyyət |
|---|---|
| Mahnı kartı: mərhələ (ideya → buraxılış), tonallıq, BPM, müddət, müəlliflər, sözlər | hazır |
| İdeya yazmaq (mikrofon), aranjimançının demo/final faylını əlavə etmək, dinləmək | hazır, fayllar yalnız telefonda |
| Setlist: mahnı seçmək, sıralamaq, tədbirə bağlamaq, ümumi müddət | hazır |
| Səhnə rejimi: iri yazı, sözlər, ekran sönmür | hazır |
| Bulud: mahnılar və setlistlər sinxronlaşır, musiqiçilər görür, yalnız sahib/menecer dəyişir | hazır (`0002_studio.sql`) |

AI ilə musiqi yaratmaq istifadəçinin qərarı ilə hələlik saxlanılıb.

## Profil şəkli

Qeydiyyatda (istəyə bağlı) və "Digər" bölməsində seçilir. Əsas ekranda, profil kartında və kilid ekranında göstərilir.
Telefonun ana ekranındakı tətbiq ikonu hər istifadəçi üçün dəyişdirilə bilmir (iOS və Android məhdudiyyəti).

## Növbəti mərhələlər

Müqavilələr, komanda və rollar (dəvət), texniki rider, səs fayllarının buluda yüklənməsi, AI köməkçi.

## İşə salmaq

```bash
npm install
```

```bash
npx expo start
```

Telefonda **Expo Go** tətbiqini yükləyin (App Store / Google Play) və ekrandakı QR kodu skan edin.

## Yoxlamalar

```bash
npm run typecheck
```

```bash
npm test
```

```bash
bash tests/db/run.sh
```

## Struktur

```
App.tsx                    kilid, dil, yükləmə
src/i18n/locales/          az.ts, ru.ts, en.ts
src/lib/sensitive.ts       kart/IBAN detektoru (Luhn + mod-97)
src/lib/finance.ts         balans, borclar, status
src/lib/format.ts          pul/tarix formatı hər dil üçün
src/store/useAppStore.ts   məlumat anbarı
src/screens/               ekranlar
src/components/            UI komponentləri, təqvim
tests/                     13 test (məntiq + 3 dilin tamlığı)
```
