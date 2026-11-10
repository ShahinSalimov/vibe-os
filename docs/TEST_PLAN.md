# VIBE OS — real telefonda test planı

Hər addımda "Gözlənilən nəticə" ilə müqayisə et. Uyğun gəlməyəndə səhifənin sonundakı şablonla yaz.

## Hazırlıq: tətbiqi telefona necə qurmaq olar

| Yol | Nə lazımdır | Nə yoxlanır | Vaxt |
|---|---|---|---|
| **A. Expo Go** (tövsiyə, ilk test) | Kompüter (Windows/Mac) + Node.js, telefonda Expo Go | Səs tanımadan başqa hər şey | 15 dəq |
| **B. Android development build** | Pulsuz Expo hesabı | Hər şey, səs tanıma daxil | ~30 dəq (bulud yığımı) |
| **C. iPhone development build** | Apple Developer hesabı (illik 99 $) | Hər şey | 1 gün (Apple qeydiyyatı) |

### Yol A (Expo Go)
1. Kompüterə Node.js qur (nodejs.org, LTS versiya).
2. Telefona **Expo Go** yüklə (App Store / Google Play).
3. Kompüterdə:
   ```bash
   git clone https://github.com/ShahinSalimov/vibe-os.git
   ```
   ```bash
   cd vibe-os
   ```
   ```bash
   npm install
   ```
   ```bash
   npx expo start --go
   ```
4. Ekrana çıxan QR kodu telefonla skan et (iPhone: kamera, Android: Expo Go içində).
5. Telefon və kompüter eyni Wi-Fi şəbəkəsində olmalıdır. Olmursa, `npx expo start --go --tunnel` yoxla.

### Windows-da `npm install` xəta verərsə (EPERM / spawn cmd.exe ENOENT)
Səbəb: quraşdırma zamanı faylları başqa proqram tutur (Windows Defender, VS Code, başqa terminal).
1. VS Code-u və `vibe-os` qovluğunda açıq olan bütün terminalları bağla.
2. PowerShell-i yenidən aç və `vibe-os` qovluğuna keç.
3. Yarımçıq qovluğu sil (alınmasa, kompüteri yenidən başlat və təkrarla):
   ```bash
   Remove-Item -Recurse -Force node_modules
   ```
4. Kilid faylına uyğun, əlavə skriptlər olmadan quraşdır:
   ```bash
   npm ci --ignore-scripts
   ```
5. Sonra həmişəki kimi:
   ```bash
   npx expo start --go
   ```
6. `npx` "spawn cmd.exe ENOENT" xətası versə (antivirus Node-un cmd.exe açmasını bloklayır), Expo-nu birbaşa işə sal:
   ```bash
   node node_modules/expo/bin/cli start --go
   ```

### Yol B (Android, səs tanıma ilə)
```bash
npm install -g eas-cli
```
```bash
eas login
```
```bash
eas build --profile development --platform android
```
Hazır olanda verilən linkdən APK-nı telefona yüklə, sonra `npx expo start --dev-client`.

---

## 1. Qeydiyyat və dil
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 1.1 | Tətbiqi ilk dəfə aç | Dil seçimi ekranı, telefonun dili seçilmiş |
| 1.2 | Русский seç | Bütün mətnlər dərhal rus dilinə keçir |
| 1.3 | Azərbaycanca seç → Davam | "Addım 1 / 3" |
| 1.4 | Profil şəklinə toxun, şəkil seç | Qalereya açılır, şəkli kvadrat kəsmək olur, şəkil dairədə görünür |
| 1.5 | Adı yaz → peşə → valyuta → Başla | Əsas ekran, yuxarıda öz şəklin |

## 2. Tədbirlər və maliyyə
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 2.1 | Əsas → Tədbir: 2 həftə sonraya toy, qonorar 3000, avans 1000 | Saxlanır, "Qalıq: 2 000 ₼" |
| 2.2 | Eyni günə ikinci tədbir yaz | Sarı xəbərdarlıq: "Bu gün artıq tədbiriniz var" |
| 2.3 | Maliyyə | Gəlir qeydi "Qismən ödənilib", "Kim kimə borcludur"da təşkilatçı |
| 2.4 | Xərc əlavə et, qeydə `4111 1111 1111 1111` yaz | Saxlanmır: "Kart və ya bank nömrəsi aşkarlandı" |
| 2.5 | Tətbiqi tam bağla, yenidən aç | Bütün məlumatlar yerindədir |

## 3. Səs (Yol A-da klaviaturanın mikrofonu ilə)
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 3.1 | "Səslə əlavə et" | Yol A: "klaviaturadakı mikrofondan istifadə edin" mesajı. Yol B: dinləmə ekranı |
| 3.2 | (Yol B) "15 dekabr Bakıda toy, 3000 manat, avans 1000" de | Tədbir forması dolu açılır, yuxarıda "Səslə dolduruldu" |
| 3.3 | (Yol B) Rus dilində: "Получил 500 манат от Рауфа" | Gəlir forması, "Рауф", 500 |
| 3.4 | İstənilən qeyd sahəsində mikrofon düyməsi | Diktə edilən mətn sahəyə əlavə olunur |

## 4. Sifarişlər
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 4.1 | Sifarişlər → + → zəng edən təşkilatçı (ad, telefon `050 123 45 67`) | Detal ekranı, "Zəng et" və "WhatsApp" düymələri |
| 4.2 | WhatsApp düyməsi | WhatsApp `+994 50 123 45 67` söhbəti ilə açılır |
| 4.3 | "Təsdiqlə və tədbir yarat" | Tədbir açılır; Maliyyədə gözlənilən gəlir; Kontaktlarda təşkilatçı |

## 5. Studiya
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 5.1 | Digər → Studiya → Yeni mahnı, mərhələ "Aranjiman" | Mərhələ zolağı rənglənir |
| 5.2 | "İdeya yaz" → icazə ver → 5 saniyə zümzümə et → Dayandır | "İdeya 1" yaranır, "Dinlə" düyməsi ilə səslənir |
| 5.3 | "Fayl əlavə et" → telefondakı mp3/m4a | Fayl siyahıda, dinlənir, müddəti görünür |
| 5.4 | Telefonu səssiz rejimə qoy, dinlə | Səs yenə gəlir (iPhone) |
| 5.5 | Setlist yarat, 2 mahnı, sırasını dəyiş → Səhnə rejimi | Qara ekran, iri yazı; 2 dəqiqə toxunma — ekran sönmür |

## 6. Sənədlər
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 6.1 | Tədbir → "Müqavilə +" → "Şablondan doldur" | Mətn tədbirin məlumatları ilə dolur |
| 6.2 | Dili Русский et → yenidən doldur | Rus dilində müqavilə, tətbiq Azərbaycan dilində qalır |
| 6.3 | "PDF paylaş" | Paylaşma pəncərəsi; WhatsApp-a göndər, PDF-i aç, mətn səliqəli |
| 6.4 | Rider → Texniki → Yarat → sətir dəyiş → PDF | PDF-də dəyişiklik var |
| 6.5 | Şəxsi → pasport, bitmə tarixi 40 gün sonra | Əsas ekranda "1 sənədin vaxtı 60 gün içində bitir" |

## 7. Təhlükəsizlik və xatırlatmalar
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 7.1 | Digər → Tətbiq kilidi aç | Face ID / barmaq izi soruşulur |
| 7.2 | Tətbiqi arxa plana göndər, geri qayıt | Kilid ekranı, öz şəklin, Face ID ilə açılır |
| 7.3 | Digər → Xatırlatmalar aç | Bildiriş icazəsi soruşulur |
| 7.4 | Sabaha tədbir yaz (bu gün saat 10:00-dan əvvəl) | Sabah 10:00-da yox, **bu gün** 10:00-da "Sabah: ..." bildirişi |

## 8. Bulud (Supabase qoşulandan sonra)
| # | Addım | Gözlənilən nəticə |
|---|---|---|
| 8.1 | Digər → Hesab və bulud → e-poçt → kod | 6 rəqəmli kod gəlir, giriş olur |
| 8.2 | Sifarişlər → sifariş linkini kopyala, başqa telefonda aç | Sənin adınla sifariş səhifəsi |
| 8.3 | Formu doldur, göndər | 1 dəqiqə ərzində tətbiqdə "Yeni" sifariş, menyuda nişan |
| 8.4 | İkinci telefonda eyni e-poçtla daxil ol | Bütün tədbirlər, mahnılar, müqavilələr görünür |

---

## Problem tapanda belə yaz
```
Bölmə / addım: (məs. 5.2)
Telefon: (məs. iPhone 13, iOS 18 / Samsung A54, Android 14)
Nə etdim:
Nə gözləyirdim:
Nə oldu:
Ekran şəkli: (varsa)
```
