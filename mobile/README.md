# ACB Atölyesi — mobil uygulama

**26 Ekim kaynak kodu güncellemesi:** Olay Örgüsü haritadan açılır; ayrı sahne detayı, cihaz taslağıyla düzenleme, perde/sıra taşıma, yönlü bağlantılar ve gerçek `world.structure` seçimi eklendi. Kullanım, değişen dosyalar, test sonuçları ve cihazda deneme: [PLOT-MAP-2026-10-26.md](PLOT-MAP-2026-10-26.md). Backend güncellemesi gerekir; yeni APK bu çalışma kapsamında üretilmedi.

**24 Ekim kaynak kodu güncellemesi:** Karakterler artık aramalı liste → ayrı detay → düzenleme/ilişki formu akışını kullanır. Kapsam, dosyalar, güncel test sonuçları ve özel türlerin localStorage kısıtı: [CHARACTERS-2026-10-24.md](CHARACTERS-2026-10-24.md). Bu değişiklik için APK yeniden üretilmedi; aşağıdaki 1.0.5 bilgisi önceki APK sürümüne aittir.

**Güncel sürüm 1.0.5 (23 Ekim):** Karakteri merkeze alan ilişki yerleşimi, yakın çevre odağı, karakter/rol arama, tek yönlü veya karşılıklı bağ kurma ve bağlantısız sahneleri bulma. Kullanım, kontroller ve açık sınırlar: [PLOT-MAP-2026-10-23.md](PLOT-MAP-2026-10-23.md). Önceki genel tasarım değişiklikleri: [DESIGN-2026-10-23.md](DESIGN-2026-10-23.md). Aşağıdaki 20 Ekim paragrafı önceki sürümün kaydıdır.

20 Ekim yeniden tasarımı, sürüm **1.0.2**: kâğıt–mürekkep ve yeşil/teal görsel dil, kalıcı açık/koyu/sistem teması, kapsamlı profil, ayrı günlük paylaşımı ve tablette iki alanlı Atölye/profil. Ana gezinme Akış · Keşfet · Atölye · Kütüphane · Profil şeklindedir. Mobil koç özellikleri kaldırılmıştır. Eşleşme ve doğrulama sınırları [REDESIGN-2026-10-20.md](REDESIGN-2026-10-20.md) içinde; önizleme aracı kontrollü test verisiyle çalışır, native uygulama gerçek API'yi kullanır. Önceki tasarım raporu tarihsel kayıttır.

Bağımsız React Native uygulaması. Expo SDK 55, React 19.2.0, React Native 0.83.10 ve Expo Router kullanır. Uygulama siteyi açmaz; ekranlar, alt menü, okuma görünümü ve bileşenler mobil projeye aittir. Yalnızca HTML içerik formatını düzenleyen, ağ erişimi kapalı yerel editör belgesi `react-native-webview` içinde çalışır. Okuma metni yerel React Native bileşenlerine dönüştürülür. 18 Ekim'deki ayrı kullanıcı talebiyle web profil tamamlama ekranında Google kullanıcı adı seçimi de düzeltildi.

## Kurulum

### Telefona doğrudan kurulabilen deneme APK'sı

```powershell
cd Z:\acbAstra\mobile
npm.cmd run android:preview
```

Bu komut ARM64 Android telefonlar için `artifacts/acb-atolyesi-preview.apk` ve SHA-256 dosyası üretir. JavaScript/Hermes kodu ve görseller APK'nın içindedir; **Metro veya QR kodu gerekmez**. Yerel Gradle release varyantı, Expo şablonunun geliştirme anahtarıyla imzalanır; bu paket kişisel cihaz testi içindir. Mağaza dağıtımı için EAS production ve kalıcı size ait imza kullanılmalıdır. `android:apk` ise Metro'ya bağlanan ayrı geliştirme paketini üretir.

Hazır APK'yı USB/Drive ile telefona aktarın ve dosya yöneticisinden açıp kurun; Android isterse dosyayı açtığınız uygulama için kurulum izni verin. Önceden farklı imzalı aynı uygulama kuruluysa üzerine kurulamaz; uygulamayı kaldırmak cihaz taslaklarını siler. Yazılarınızı sunucuyla eşitlemeden eski uygulamayı kaldırmayın.

Bu bilgisayardaki deneme yapılandırması `http://192.168.1.128:5000/api` adresini kullanır. Backend'i aşağıdaki komutla çalıştırın, telefon ve bilgisayarı aynı Wi-Fi'a bağlayın. Telefonda tarayıcıdan `http://192.168.1.128:5000/api/mobile/config` açılarak sunucu erişimi kontrol edilebilir. Erişilemiyorsa Windows güvenlik duvarında Node/5000 için özel ağ erişimini kontrol edin. Bilgisayarın IP'si değişirse `.env` içindeki `EXPO_PUBLIC_API_URL` değerini düzeltip APK'yı yeniden üretin. İlk açılış/giriş ve sunucu verileri internet/API bağlantısı ister; Metro gerekmemesi sunucunun gerekmemesi anlamına gelmez.

Sırasıyla giriş → akış → eser → okuma; ardından Atölyem → eser/bölüm oluştur → yaz → kaydet → yeniden aç akışlarını deneyin. Daha sonra uçak modunda yazın, uygulamayı kapatıp açın ve Atölyem'deki cihaz kopyasını kontrol edin. Yeniden bağlanıp eşitleyin. E-posta değişikliği, 100 sahneyle arama/bağlantı/sıralama, klavye ve büyük sistem yazısı için ayrıntılı kabul listesi [VALIDATION.md](VALIDATION.md) içindedir.

`npx.cmd` tek başına yazılınca npm bir komut kabuğu açar; uygulamayı başlatmaz. Açılan kabuktan `exit` ile çıkıp aşağıdaki tam komutları PowerShell'de kullanın. Mobil uygulama bilgisayarda bir tarayıcı penceresi olarak açılmaz: geliştirme sunucusu ile telefona kurulmuş geliştirme uygulaması birlikte kullanılır.

Mevcut bilgisayarda bağımlılıklar kuruluysa başlangıç:

```powershell
cd Z:\acbAstra\mobile
npm.cmd run android:doctor
# Android telefon USB ile bağlı ve USB hata ayıklama izni verilmişse:
npm.cmd run android -- --device
# Yalnızca telefona aktarılacak geliştirme APK'sı oluşturmak için:
npm.cmd run android:apk
```

Windows Android yardımcı komutu SDK'nın standart ve iç içe `Android/Android/Sdk` yollarını, Android Studio'nun kayıt defterindeki konumunu ve beraberindeki Java'yı otomatik bulur. Makinenin kalıcı ortam değişkenlerini değiştirmez. SDK 36 / build tools eksikse Android Studio SDK Manager'dan kurulmalıdır; mevcut kabul edilmiş lisanslar uygunsa Gradle da eksik SDK bileşenlerini indirebilir. `android:apk` arm64 telefonlar ve x86_64 emülatörler için debug APK üretir.

Node.js 22 LTS kullanın. Komutları `mobile/` içinde çalıştırın; kök veya frontend bağımlılıklarıyla karıştırmayın. Windows PowerShell betik yürütme kısıtlıysa `npm` yerine `npm.cmd`, `npx` yerine `npx.cmd` kullanın.

`npm ci` sonrasında `scripts/patch-gradle.cjs`, React Native 0.83'ün Foojay resolver sürümünü 0.5.0'dan 1.0.0'a yükseltir. Bu, Gradle 9'da kaldırılmış `IBM_SEMERU` alanından kaynaklanan native derleme hatası için [resmi uyumluluk düzeltmesidir](https://github.com/gradle/foojay-toolchains/blob/main/CHANGELOG.md#100---2025-05-19). Android yardımcı komutları da düzeltmenin uygulandığını kontrol eder; native platform sürümleri düşürülmez.

```powershell
cd Z:\acbAstra\mobile
npm.cmd ci
Copy-Item .env.example .env
# .env içindeki API adresini kendi cihazınıza göre düzenleyin.
npx.cmd expo prebuild --platform android --no-install
npm.cmd run android
npm.cmd start
```

macOS üzerinde iOS için:

```sh
cd mobile
npm ci
cp .env.example .env
npm run ios
npm start
```

Geliştirme istemcisi kullanılır. Google giriş ve uzaktan push için Expo Go yeterli değildir. `npm start` Metro sunucusunu açar; Android/iOS geliştirme paketi cihaza ayrıca kurulmalıdır. Yerel Android için Android Studio, SDK/platform tools, emülatör veya USB hata ayıklaması açık telefon ve uygun JDK gerekir. iOS yerel derleme için macOS/Xcode ve CocoaPods gerekir.

### QR kodu göründükten sonra

`Using development build` ve `exp+acb-atolyesi://...` çıktısı Metro'nun hazır olduğunu gösterir. QR kodu ACB geliştirme uygulamasını açar; uygulama telefona henüz kurulmadıysa tek başına QR taratmak yeterli değildir.

Android için `npm.cmd run android:apk` tamamlandıktan sonra `android/app/build/outputs/apk/debug/app-debug.apk` dosyasını telefona aktarın, açıp yükleyin. Android, dosyayı açtığınız uygulama için kurulum izni isteyebilir. ACB Atölyesi uygulamasını açın; telefon ve bilgisayar aynı Wi-Fi ağındayken açık Metro terminalindeki QR kodunu geliştirme istemcisinin tarayıcısıyla okutun. Bu debug paketi Metro açıkken çalışır.

`Failed to download the latest version of React Native DevTools. Using a fallback version instead` uyarısı bir hata ayıklama aracı indirmesine ilişkindir; Metro QR kodu ve adresi üretmişse sunucu çalışmaya devam eder. Telefon bağlanamıyorsa önce ACB paketinin kurulu olduğunu, aynı ağı ve bilgisayarın 8081/5000 portlarına erişimi kontrol edin. iPhone için Android APK kullanılamaz; macOS veya EAS ile ayrı iOS geliştirme paketi gerekir.

Native paket eklendiğinde ya da scheme/izin/HTTP yapılandırması değiştiğinde `npx expo prebuild --no-install` çalıştırıp geliştirme paketini yeniden derleyin. `android/` ve `ios/` üretilen dizinlerdir; kaynak yapılandırma `app.config.ts` içindedir.

## Backend ve bağlantı

Mevcut Express/Mongoose backend ortak veri kaynağıdır. Backend'in kendi `.env` dosyasını ve README/kurulum yönergelerini kullanın; mobil `.env` sunucu sırlarını içermez.

```powershell
cd Z:\acbAstra\backend
npm.cmd ci
npm.cmd run dev
```

Bölüm kaydı ve geçmiş işlemleri MongoDB transaction kullanır: geliştirme veritabanı da replica set olmalıdır. Tek başına çalışan standalone MongoDB yeterli değildir. Üretim veritabanı yapılandırmasını bu testler için değiştirmeyin.

| Deneme ortamı | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android Studio emülatörü | `http://10.0.2.2:5000/api` |
| iOS simülatörü, aynı Mac'te backend | `http://127.0.0.1:5000/api` |
| Fiziksel telefon | `http://BILGISAYARIN_LAN_IP_ADRESI:5000/api` |
| Önizleme / üretim paketi | `https://API_HOST/api` |

Fiziksel telefon ve bilgisayar aynı yerel ağda olmalı; backend `0.0.0.0` üzerinden erişilebilir olmalı ve güvenlik duvarı geliştirme portuna izin vermeli. Telefonun `localhost` adresi bilgisayara işaret etmez. Metro için LAN bağlantısı gerekir; `npx expo start --dev-client --tunnel` yalnızca Metro'yu tüneller, backend'i tünellemez. Android USB bağlantısında `adb reverse tcp:5000 tcp:5000` ile telefondan `127.0.0.1:5000` kullanılabilir.

Yerel HTTP için `.env` içinde `ACB_ALLOW_HTTP=1` ve yeniden native derleme gerekir. Bu seçenek iOS ATS ve Android cleartext iznini yalnızca geliştirme amacıyla açar. Üretimde `ACB_ALLOW_HTTP=0` ve HTTPS kullanın. `EXPO_PUBLIC_*` değişkenleri uygulama paketine gömülür; JWT sırrı, veritabanı URI'si, Google secret, SMTP/Resend, Gemini/OpenAI veya Expo sunucu erişim anahtarı burada bulunmamalı.

## Ekranlar ve API sözleşmesi

Ana menü beş sekmedir: **Akış, Keşfet, Kütüphane, Atölyem, Profil**. Eser stüdyosu ve yazı masası stack ekranlarıdır; geri dönmek sekme geçmişini korur.

| Mobil akış | Backend |
| --- | --- |
| Kayıt, giriş, OTP, profil tamamlama, sözleşme kabulü | `/auth/*`, `client: native` |
| Günlük / takip akışı, beğeni, sohbet | `/feed`, `/logs`, `/chapters/:id/like`, `/comments/*` |
| Pasajı seçerek paragraf yorumlama, düzenleme, bildirme | `/inline-comments` |
| Keşfet rafları, türler, sayfalı eser/yazar arama | `/works/discover?sort=updated`, `/works/genres`, `/search/works`, `/search/users`, `/feed/needs-review`, `/feed/writers`, `/feed/top-logs` |
| Eser, bölüm, hassas içerik onayı | `/public/works/:id/*` |
| Kütüphane, okuma listeleri, alıntılar | `/library`, `/reading-lists`, `/quotes` |
| Okuma ilerlemesi | `/reading-progress`, yüzde **0–100** |
| Eser / bölüm oluşturma ve kaydetme | `/works`, `/chapters`, `expectedRevision` |
| Not defterleri, karakterler, ilişkiler | `/notes`, `/works/:id/notes`, `/characters`, `/relationships` |
| Sahne listesi, bağlantılar, dünya | `/plots`, `/world`, `/mobile/plots/:id/order` |
| Metin yorumu, AI sohbeti, gelişim | `/ai/review`, `/ai/chat`, `/chapters/development/*` |
| Profil, görseller, hesap ayarları | `/user/*`, `/upload` |
| Bildirimler ve push cihazı | `/notifications`, `/mobile/push-device` |
| Bildirim / başvuru / itiraz | `/reports` |
| Mobil sürüm / hukuki metinler / özellik bayrakları | `/mobile/config` |

Sahne tuvalinin mobil karşılığı perde filtreli sahne kartlarıdır. Yukarı/aşağı kontrolleri, durum/amaç düzenleme, karakter seçimi ve hedef sahneye dokunarak nedensellik bağlantısı kurma vardır. Sıralama eserin sahipliğini ve sunucudaki `updatedAt` değerini atomik kontrol eder; eski sıra isteği 409 döner.

İçerik backend'in `p/div/br/span`, kalın/italik/alt çizgi/üst çizgi, h1–h3, liste ve alıntı HTML biçimiyle uyumludur. Geçerli hizalama ve yazı stilleri korunur. Script, URL, iframe ve olay çalıştıran öznitelikler editöre alınmaz. Yazı masası klavye yanında kalın/italik/liste/başlık/hizalama/geri al kontrolleri sunar.

Oturum tokenı SecureStore'dadır; Bearer istekleri `credentials: omit` kullanır. Backend native oturumu 12 saat geçerli, sunucuda iptal edilebilir bir oturumdur. Otomatik refresh token yoktur: 401 yeniden girişe yönlendirir, cihazdaki yazı taslaklarını silmez. Bağlantı yokken güvenli saklanmış kullanıcı kimliği yalnızca kendi cihaz taslaklarını açmak için kullanılabilir; yeniden bağlanınca sunucu yetki kontrolünü tekrar uygular.

## Taslak ve eşitleme

- Atölyem'deki **Bu cihazdaki bölümler** alanı eşitlenmiş, eşitleme bekleyen ve çakışan bütün yerel bölüm kopyalarını eser bazında gösterir. Daha önce yazı masasında açılan bölümler uygulama çevrimdışı yeniden açıldığında buradan doğrudan düzenlenebilir. Eser adları hesaba özel önbelleğe alınır; eski kayıtlarda eser adı olmasa da bölüm açılabilir. Sunucudan hiç açılmamış bölümler ve çevrimdışı yeni eser/bölüm oluşturma bu kapsama dahil değildir.
- Her editör değişikliği hesap/bölüm anahtarıyla AsyncStorage'a sıralı yazılır; ardından 1,4 saniye duraklamada sunucu kaydı denenir.
- Cihaz kaydı ve sunucu kaydı ayrı görünür. Yerel yazma hatasında kayıt başarılı gösterilmez; geri çıkış engellenir ve metni koruma uyarısı verilir.
- Ön planda yeniden bağlantıda, uygulama yeniden açıldığında ve 30 saniyelik denemelerde bekleyen bölüm taslakları eşitlenir. İşletim sisteminin uygulamayı kapattığı sürede arka planda sürekli senkronizasyon iddiası yoktur.
- Eşitleme hataları bölüm/okuma kaydı bazında tutulur; silinmiş veya erişilemeyen bir kayıt sağlam kayıtları durdurmaz. Hatalı bölüm Atölyem'de, okuma hataları Kütüphane'de görünür. Başarısız kayıt cihazda bekler; sonraki denemede başarılı olursa hata temizlenir. Oturumun bitmesi, hesap değişimi, profil/sözleşme gerekliliği veya doğrulanmış bağlantı kesintisi o turu durdurur. Cihaz bağlıyken tek bir isteğin yanıt kaybı diğer kayıtları engellemez.
- Kaydetme sürüm numarasıyla yapılır. Sunucu 409 dönerse otomatik eşitleme durur; yerel ve uzak metin görünür. Kullanıcı uzak metin, yerel metin veya düzenlediği birleşimi seçer. Seçim öncesi her iki sürümün cihaz yedeği alınır.
- Bir ağ isteği sürerken yazılan yeni cümleler eski yanıtla değiştirilmez. Yanıt kaybolduğu halde sunucu kaydettiyse aynı metin güvenle kabul edilir.
- Yapıştırılan/import edilen metin organik yazma artışına dahil edilmez. Yayındaki bölüm düzenlenirken backend'in özel taslak/yayın ayrımı korunur; yeni metin açık yayın eylemine kadar okurlara gösterilmez.
- Okuma tercihleri ve bekleyen ilerleme kaydı da hesaba göre cihazda tutulur. Eserlerin tamamını çevrimdışı indirme bulunmaz; bölüm metni sunucudan alınır.
- Kişisel notlar, eser notları, karakterler, sahneler ve dünya kayıtları her kayıt için ayrı, hesaba özel `form-draft:` cihaz taslağı tutar. Her değişiklik sıralı yazılır; kayıtlar arasında geçiş önce önceki cihaz kaydını tamamlar. Yeniden açılışta “Cihaz kaydını aç” ile metne dönülür. Eski `tool-form:` kayıtları metinleri korunarak taşınır. Cihaz yazma hatası görünür; hata çözülmeden kayıt değiştirme/geri çıkış engellenir.
- Kişisel notlarda yerel kayda ek olarak başlık girildiğinde ve bağlantı varken 1,4 saniyelik duraklamada sunucu kaydı denenir. Diğer hikâye araçlarında Kaydet manuel sunucu güncellemesidir. Her mobil kayıt sunucudan alınan sürümle gönderilir; eski sürüm 409 ve güncel metni döndürür. İki sürüm görünür, açık seçimden önce cihaz yedeği alınır. Kaybolan oluşturma yanıtının tekrarında sabit taslak kimliği aynı sunucu kaydını bulur; yinelenen kayıt oluşturmaz.
- Mobil not editörü zengin metin kullanır. Ortak `Note.content` ve `WorkNote.body` alanları web'in düz metin alanlarıyla uyumlu kalır; mobil biçimlendirme `mobileRichContent` / `mobileRichBody` içinde düz metin kaynağıyla birlikte saklanır. Web metni değiştiğinde eski mobil biçimlendirme uygulanmaz; yeni metin, satır sonları ve özel karakterleri korunarak açılır. Ek alanlar isteğe bağlıdır; eski kayıtları dönüştüren bir veritabanı işlemi gerekmez.
- Kayıt kontrolü için `GET /mobile/tools/:kind/:recordId`, sürümlü/idempotent kayıt için `POST /mobile/tools/:kind` kullanılır (`personal`, `notes`, `characters`, `scenes`, `world`). Yeni uçlar mevcut web uçlarına eklenir; eski web istemcisinin kendi kayıt istekleri sürüm göndermediğinden, mobil uçların çakışma koruması eski web isteğine geriye dönük eklenmiş olmaz. Web değişikliği mobil kayıttan önce tamamlandığında eski mobil sürüm reddedilir.
- Yerel taslaklar işletim sistemi uygulama sandbox'ında, **şifrelenmemiş** içerik saklama alanındadır. Oturum sırları buraya yazılmaz. Ayarlardaki açık silme eylemi bölüm/araç taslaklarını ve yedeklerini kaldırır. Bir not/araç kaydının açık silme eylemi o kaydın cihaz kopyasını da temizler.

## E-posta ve deep link

Hesap adresi değiştirme ayrı bir onay akışıdır: `PATCH /user/change-email` (202) yeni adrese kod ve bağlantı gönderir, **eski adresi ve doğrulanmış durumunu değiştirmez**. `GET /user/email-change` bekleyen adres/süreyi getirir; `POST /user/email-change/verify { otp }` doğrulayıp adresi devralır; `DELETE /user/email-change` iptal eder. Mobil Ayarlar ekranı bekleyen isteği yeniden açılışta yükler, 60 saniye sonra yeni kod isteyebilir. Kod 15 dakika/5 deneme geçerlidir; saatlik hesap limiti vardır. Kodun HMAC'i ve yüksek entropili link tokenının hash'i ayrı koleksiyonda tutulur, profil yanıtlarına girmez. E-posta servisi başarısızsa mevcut adres korunur ve hata görünür. `EmailChange` koleksiyonu benzersiz kullanıcı ve TTL indeksleriyle otomatik oluşur; veri taşıma işlemi gerekmez.

E-posta değişikliği için web ayarlarındaki istek de yeni adrese onay e-postası gönderir; e-postadaki `/api/user/email-change/confirm` sayfasında düğmeye basarak tamamlanabilir. Linkin GET isteği hesap değiştirmez. Web'in eski başarı metni yeni doğrulama metnini henüz göstermez; onaya kadar giriş adresi eski adrestir. Yerel ağda bağlantının telefondan açılması için backend `API_URL=http://192.168.1.128:5000/api`; canlıda gerçek HTTPS API adresi olmalıdır. Kodun mobilde elle girilmesi bu bağlantı host'undan bağımsızdır. Google hesabında ilk şifre belirleme Ayarlar'da sunulur; şifre işlemi sonrası oturum iptal edildiğinden yeniden giriş gerekir.

Kayıt ve yeniden doğrulama istekleri native istemcide `client: native` gönderir. Web'in mevcut e-posta hedefi değişmez. Mobil e-postalar sunucunun `MOBILE_LINK_BASE` değerine göre link üretir; doğrulama `/mobile/verify-email` ile, şifre sıfırlama mevcut OTP uçlarıyla yapılır. Gönderim başarısızsa hesap oluşturuldu bilgisi kaybolmaz; tekrar kod/link gönderme vardır.

Başlangıç scheme'i: `acbatolyesi://mobile-link/verify?token=...` ve `acbatolyesi://mobile-link/reset?email=...&otp=...`. Gerçek kodları loglara, ekran görüntülerine veya hata raporlarına koymayın.

Doğrulanmış HTTPS bağlantıları için **mevcut web sitesi yerine API domain'i** kullanılabilir:

1. Mobil `.env`: `EXPO_PUBLIC_APP_LINK_HOST=api.ornek.com`.
2. Backend `.env`: `MOBILE_LINK_BASE=https://api.ornek.com/mobile-link`.
3. Backend `MOBILE_APPLE_TEAM_ID` ve `MOBILE_ANDROID_CERT_SHA256` değişkenlerini gerçek Apple team ID ve imza sertifikasının SHA-256 parmak iziyle doldurun. Birden fazla Android izi virgülle ayrılır; Play App Signing izi dağıtımda farklı olabilir.
4. API host'unda `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` ve `/mobile-link/*` backend'e yönlendirilmeli. Uçlar JSON association dosyalarını ve uygulamayı açma fallback sayfasını hazır sunar. Eksik kimliklerde association uçları açıkça 503 döner.
5. Native paketi yeniden üretin. Scheme testi için `npx uri-scheme open "acbatolyesi://mobile-link/reset" --android` veya `--ios` kullanın; boş bağlantı bir hesap işlemi yapmaz. HTTPS association cihazda gerçek domain/imza ile ayrıca doğrulanmalıdır.

## Google ile giriş

E-posta/şifre/OTP dış hesap ayarı olmadan uygulama tarafında hazırdır; e-posta gönderimi backend'in posta sağlayıcısına bağlıdır. Google giriş butonu sadece `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` sağlanırsa görünür. Bu public ID backend'in `GOOGLE_CLIENT_ID` audience değeriyle aynı olmalı. Google Console'da Android package `com.acbatolyesi.mobile` ve ilgili SHA-1 imzası; iOS bundle `com.acbatolyesi.mobile` için OAuth istemcileri oluşturulmalı. iOS public client ID'sini `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` olarak ekleyin. iOS URL scheme'i bu ID'den türetilir. Native paketi yeniden derleyin. Client secret uygulamaya konmaz; ID token mevcut `/auth/google/mobile` üzerinde doğrulanır. Bu harici hesap/imza kurulumu bu ortamda yapılmadı.

## Push bildirimleri

Uygulama içi bildirim ekranı mevcut backend'den gerçek veriyi okur ve okundu işlemlerini uygular. Push kullanımı ayrı, isteğe bağlı kurulumdur:

1. Expo/EAS projesi oluşturun, UUID'yi `EXPO_PUBLIC_EAS_PROJECT_ID` olarak sağlayın.
2. Android için Firebase projesi, Android uygulaması ve FCM v1 yapılandırması gerekir. `GOOGLE_SERVICES_JSON` ile Firebase client config dosyasının yolunu verin; EAS'ta file environment variable kullanılabilir. FCM hizmet hesabı özel anahtarını **yalnızca EAS credentials** üzerinden sağlayın; uygulamaya veya repoya koymayın.
3. iOS için Apple Developer hesabı, push capability, APNs anahtarı/provisioning ve EAS credentials gerekir.
4. Fiziksel cihaza development/preview build kurun. Ayarlar'dan açıkça bildirim izni verin; token `/mobile/push-device` üzerinden mevcut hesaba/iptal edilebilir oturuma bağlanır.
5. Backend ortamında **tek** worker başlatın:

```sh
cd backend
node scripts/mobile-push-worker.mjs
# Tek tur kontrol: node scripts/mobile-push-worker.mjs --once
```

Worker yeni inbox kayıtlarını kalıcı `PushDelivery` kuyruğuna alır. Ticket ve receipt durumlarını işler, geçici istek hatalarını yeniden dener, DeviceNotRegistered tokenlarını ve sona ermiş/iptal edilmiş oturumları temizler. Yalnızca kayıt sonrası bildirimler gönderilir; geç gelen kayıtlara karşı 5 dakikalık örtüşmeli tarama kullanılır. Uzun kesinti sonrası kuyruk kaldığı yerden sürer. Ağ yanıtının kaybolduğu belirsiz gönderimlerde push servisi seviyesinde tam bir “exactly once” garantisi yoktur; inbox esas kayıttır. Çok büyük cihaz/sahne hacmi için worker'ı sayfalı dağıtık işleyiciye taşımak gerekir. Mevcut worker tek süreç ve tarama başına 10.000 cihaz sınırı içindir.

Kilit ekranına özel metin veya moderasyon ayrıntısı gönderilmez. Push'a dokunmak bildirim ekranını açar. İstenirse Expo Enhanced Push Security açıp `EXPO_ACCESS_TOKEN` değerini **backend worker ortamına** ekleyin. Bu ortamda gerçek Expo/FCM/APNs hesabı ve fiziksel cihaz olmadığından gerçek push teslimi denenmedi; ticket/receipt akışı kontrollü sağlayıcı yanıtlarıyla test edildi.

## EAS ile paketleme

```sh
cd mobile
npx eas-cli login
npx eas-cli init
# Proje UUID'sini .env/EAS ortamında EXPO_PUBLIC_EAS_PROJECT_ID olarak sağlayın.
npx eas-cli build --profile development --platform android
npx eas-cli build --profile simulator --platform ios
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform all
```

`development` geliştirme istemcisi, `simulator` iOS simulator paketi, `preview` Android APK, `production` mağaza Android AAB/iOS IPA üretir. iOS cihaz dağıtımı provisioning ve cihaz kaydı gerektirebilir. EAS ortamındaki API/public kimlik değişkenlerini build öncesinde sağlayın; production HTTPS olmalı. Native configuration dosyaları yoksa EAS prebuild yapar. 18 Ekim 2026'da **yerel ARM64 deneme APK'sı üretildi**; EAS bulut derlemesi, mağaza imzası/AAB, IPA ve mağaza gönderimi bu ortamda yapılmadı.

Hazır paket için kullanıcı hesabınıza uygun submit yapılandırması tamamlandıktan sonra `npx eas-cli submit --platform android` / `--platform ios` kullanılabilir. Mağaza adı, açıklama, gizlilik beyanı, ekran görüntüleri ve gerçek cihaz kabul testleri yayımdan önce tamamlanmalı.

## Doğrulama

```powershell
cd mobile
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
# İsteğe bağlı gerçek motorla yerel editör testi (Windows'ta yüklü Edge):
$env:MOBILE_EDITOR_BROWSER = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm.cmd test
# Diğer sistemlerde Playwright Chromium'u kurup MOBILE_EDITOR_BROWSER=chromium kullanabilirsiniz.
npm.cmd run export
```

Backend entegrasyon testi kendi geçici MongoDB replica set'ini açar; üretim verisine dokunmaz. Mevcut `mongod` ikilisini kullanmak indirmeyi önler:

```powershell
cd backend
$env:MONGOMS_SYSTEM_BINARY = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'
$env:MONGOMS_SYSTEM_BINARY_VERSION_CHECK = 'false'
npm.cmd test -- --reporter=dot mobile.test.js mobileFlow.integration.test.js
npm.cmd test -- --reporter=dot
# Opt-in güvenlik/yayın/export senaryolarını da geçici MongoDB ile çalıştır:
npm.cmd run test:all -- --reporter=dot
```

Web profil adı regresyonu için ayrı terminalde `frontend/` içinde `npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort`, ardından `mobile/` içinde `node scripts/check-profile-browser.cjs` çalıştırın. Varsayılan tarayıcı Windows Edge'dir; `MOBILE_EDITOR_BROWSER` ile başka Chromium ikilisi yolu, `PROFILE_TEST_URL` ile yerel frontend adresi verilebilir. Bu kontrol API yanıtlarını taklit eder; gerçek Google hesabı veya posta kullanmaz. Sonuç ve açık güvenlik işleri [güvenlik raporunda](../SECURITY_REVIEW_2026-10-18.md).

Alternatif olarak `MONGOMS_DOWNLOAD_DIR` ile yazılabilir bir test cache klasörü belirleyin. Yeni integration test uygulamanın `.env` dosyasını yüklemez, rastgele test veritabanı kullanır ve e-posta/AI/push dış servislerini gerçek hesaplara göndermez.

18 Ekim 2026'ya kadar doğrulama sonuçları ve cihazda kalan kabul senaryoları [VALIDATION.md](VALIDATION.md) içindedir. Hukuki metinler frontend'deki mevcut kaynaklardan salt okunur aktarılmıştır; değiştiklerinde `node mobile/scripts/sync-legal.cjs` ile backend mobil snapshot'ını güncelleyin. Test snapshot'ın kaynaklarla aynı olduğunu kontrol eder.

Gelişim Koçu, bölüm geçmişi arayüzü ve bazı sahne AI/çizim araçları mevcut `shared/features.js` içinde kapalıdır. Mobil bu bayrakları `/mobile/config` üzerinden izler; kapalı özellikleri çalışıyormuş gibi sunmaz. Metin değerlendirmesi ve sohbet gerçek mevcut AI uçlarına bağlıdır; backend sağlayıcı anahtarı/kotası yoksa hata gösterir. Mobil projesi bu ürün bayraklarını veya web ekranlarını değiştirmez.

Expo SDK 55 uyumluluk kontrolü geçti. `npm audit` mevcut kilitte 14 moderate / 22 high geçişli uyarı bildiriyor (çoğu Expo/Metro/Jest/Xcode geliştirme zinciri). Bazı advisories için npm'de yayınlanmış uyumlu düzeltme yok; `audit fix --force` SDK'yı uygunsuz biçimde düşürüyor. Bu sonuç temiz güvenlik denetimi olarak sunulmaz; mağaza yayını öncesinde SDK'nın desteklenen yamaları ve bağımlılık denetimi yeniden ele alınmalı. `react-native-render-html` sürümü de artık eski paket adına ait; bakımı sürdürülen ardılına geçiş ayrı cihaz regresyonuyla yapılmalı.

Resmi başvuru kaynakları: [Expo Router](https://docs.expo.dev/versions/v55.0.0/sdk/router/), [SecureStore](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [push kurulum](https://docs.expo.dev/push-notifications/push-notifications-setup/), [EAS Build](https://docs.expo.dev/build/introduction/), [app links](https://docs.expo.dev/linking/overview/).
