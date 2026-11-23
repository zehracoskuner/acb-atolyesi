# Doğrulama

> **24 Ekim 2026 — Karakterler liste/detay kaynak güncellemesi:** TypeScript başarılı; karakter testleri 4/4 ve izole MongoDB/Express mobil entegrasyonu 5/5 geçti. Karakter arayüzü CRUD, kayıt hatası, çift gönderim, geri çıkış uyarısı, ilişki yönü, eser ayrımı, boş/hata/arama durumları ve küçük/büyük telefon/tablet düzen kontrolleri başarılı. Android/iOS Hermes export başarılı. Son genel mobil test çalıştırması 52 başarılı, editör/çevrimdışı akışlarda 14 başarısız; aşağıdaki önceki 66/66 veya 62/62 sonuçları güncel genel kabul sonucu değildir. Lint 0 hata, bölüm editöründe 2 uyarı. Fiziksel cihaz testi ve yeni APK yok. [Dosyalar, kapsam ve sınırlamalar](CHARACTERS-2026-10-24.md).

> **23 Ekim 2026 — 1.0.5 / versionCode 6:** Karakter odak/çevre yerleşimi, Türkçe karakter arama, karşılıklı ilişki kaydı ve bağlantısız sahne incelemesi. TypeScript, lint, 62/62 test ve izole harita tarayıcı kontrolleri geçti. Android release derlemesi 1 dk 12 sn; iOS Hermes export başarılı. Native cihaz çalıştırması ve canlı backend uçtan uca testi yapılmadı. APK: `artifacts/acb-atolyesi-1.0.5.apk`; SHA-256 `adaf872f30fc94212fc037a48a2b5dc5b6c232983cbc222b4f2006d3586ef441`. ARM64 paket ve v2 imza doğrulandı. Kullanım ve kalan kapsam `PLOT-MAP-2026-10-23.md` içinde.

> **23 Ekim 2026 — 1.0.4 / versionCode 5:** Olay örgüsü ve karakter ilişki haritaları. TypeScript/lint temiz; 59/59 mobil test başarılı. İzole RN Web bileşen kontrollerinde 320/430/1024 px düzen, dokunarak sürükleme, iki parmakla yakınlaştırma, tür seçerek bağlantı kaydı, hata/yeniden deneme, düzenleme callback'i ve karakter ilişkisi ekleme geçti. Android son release derlemesi 54 sn; ARM64/API 24+, v2 imza doğrulandı. `artifacts/acb-atolyesi-1.0.4.apk`: 41.846.550 bayt; SHA-256 `8a9fd679c120634304e348b1f0ba8a0fbf354259a68ec1a9c5223e0954d716da`. Üretim bundle'ında SceneMap var, QA/PlotPreview yok. iOS Hermes export başarılı; native iOS derlemesi yapılmadı. ADB bağlı cihaz göstermedi; fiziksel cihaz kabul testi yapılmadı. Yerel API yanıt vermedi; bu tur canlı hesap/backend uçtan uca akışı doğrulanmadı ve backend testleri yeniden çalıştırılmadı. [Kapsam ve açık sınırlar](PLOT-MAP-2026-10-23.md).

> **23 Ekim 2026 — 1.0.3 / versionCode 4:** TypeScript/lint temiz, Edge editör senaryoları dahil 55/55 mobil test geçti. Kontrollü veriyle 16 ekran × 320/390/430/1024 px = 64 açık düzen ve 18 koyu düzen kontrol edildi; arama/tür/sıralama, Atölye filtresi ve bölüm açma, profil düzenleme istek gövdesi, tema kalıcılığı, günlük taslağı yeniden açılışı geçti. Backend test paketi bu turda yeniden çalıştırılmadı. Android release build 3 dk 33 sn; iOS Hermes export başarılı (iOS native çalıştırması değil). APK 41.823.522 bayt, ARM64/API 24+, v2 imza doğrulandı; SHA-256 `2c5e7abcfb9196ba8cef2f37c674d485af388b4007abf50b8e78d09237d1a51a`. Sürüm adlı kopya: `artifacts/acb-atolyesi-1.0.3.apk`. Üretim bundle'ında QA verisi yok. Fiziksel cihaz testi yapılmadı. Ayarlı yerel API bağlantısı yanıt vermedi; sunucunun ayrıca çalıştırılması gerekiyor. [Değişiklikler](DESIGN-2026-10-23.md).

> **20 Ekim 2026 — sürüm 1.0.2 / versionCode 3:** TypeScript ve lint temiz; gerçek Edge editör testleri dahil **55/55 mobil test** geçti. İzole gerçek MongoDB/Express üzerinde **4/4 mobil entegrasyon testi** geçti: giriş, akış, oluşturma, biçimli bölüm kaydı, yeniden açma, çakışma, yayın, okuma/ilerleme, dokunmatik sahne sıralaması; ayrıca özel taslak/günlük/liste erişimi, takip, kütüphane, listeye ekleme ve alıntı. Tüm backend test paketi bu turda yeniden çalıştırılmadı. RN Web üzerinden **45 açık tema görünümü (15 ekran × 320/390/1024 px)** ve **15 koyu tema görünümü (5 ekran × 320/430/1024 px)** taşma kontrolünden geçti. Arama, tür filtresi, editör, okuma tercihleri, uzun ad/1,6× tarayıcı metni, profilin altı sekmesi, tema kalıcılığı/sistem değişimi ve günlük taslağı yeniden açılışı kontrol edildi. Görseller kontrollü test verisi kullanır; cihaz kabul testi değildir. Android native release derlemesi başarılı (son derleme 51 saniye); iOS Hermes export başarılı, Xcode derlemesi yapılmadı. APK **41.815.622 bayt**, SHA-256 `4a8ed8ef306f835aaf2926c03a8e6a47aa0cbdc76941327ed2cccbac9141ed6c`, ARM64, min API 24, target 36; v2 imza doğrulandı. Native sourcemap'te QA modülü ve koç rotası bulunmuyor. Fiziksel Android bağlı değil, AVD yok; native klavye, gerçek galeri/banner yüklemesi ve iOS cihaz testi bekliyor. [Kapsam ve eşleşme](REDESIGN-2026-10-20.md). Aşağıdaki “son durum” ifadeleri kendi tarihlerine ait tarihsel kayıtlardır.

> **18 Ekim 2026 — web ile aynı görsel dil, sürüm 1.0.1 (son durum):** Kâğıt/kiremit paleti, paketlenmiş Playfair/DM Sans/Lora yazıları, yeni akış/keşfet/raf/profil, karşılama ve okuma/yazma düzenleri tamamlandı. Web ACB vektöründen native ikon üretildi. Bu tasarım çalışmasında web/backend kodu değişmedi. TypeScript, lint ve **55/55 mobil test** geçti; `expo install --check` uyumlu. Ayrı QA aracında gerçek ekranlar, kontrollü veri/oturum adaptörleriyle Edge'de **15 ekran × 320/390 px = 30 görünüm** için taşma kontrolünü geçti. Arama/temizle/tür filtresi, gerçek yerel editörde yazma/kontrollü kaydetme, gece okuma ve uzun kullanıcı adı/1,6× tarayıcı metni kontrolü geçti. Android ve iOS Hermes export başarılı. Native Android release derlemesi **2 dk 41 sn**, çıkış kodu 0. Güncel `artifacts/acb-atolyesi-preview.apk`: **41.810.074 bayt**, Android **1.0.1 / versionCode 2**, ARM64, min API 24, target API 36. SHA-256: `579f412f056c901fb4548504425ed5dabd956dd50d6144bcdcc576e5730a761f`. V2 imza doğrulandı; önceki APK ile aynı geliştirme sertifikası (`fac61745…`). Gömülü Hermes kodu 2.836.512 bayt; native sourcemap'te QA örnek verisi modülü yok. Yerel HTTP API aynı; Metro gerekmez. Gerçek telefon, AVD/iOS simülatörü ve native klavye/erişilebilirlik kabul testi yapılmadı. Tasarım kanıtları ve tekrar komutları: [DESIGN-2026-10-18.md](DESIGN-2026-10-18.md). Aşağıdaki derleme özetleri önceki kaynakların tarihsel kaydıdır.

> **18 Ekim 2026 — profil adı düzeltmesi ve güvenlik incelemesi (son durum):** Yeni Google hesabı web/mobil profil tamamlamada kendi kullanıcı adını seçiyor; mevcut tamamlanmış hesabın adı korunuyor. Backend `canChooseUsername` alanı ve ilgili regresyon kontrolleri eklendi. Web lint/build, mobil TypeScript/lint ve **55/55 mobil test** geçti. `npm.cmd run test:all -- --reporter=dot` ile opt-in testler dahil **76 dosyada 815/815 backend testi** geçti; atlanan yok. Gerçek Edge'deki iki profil senaryosu `scripts/check-profile-browser.cjs` ile geçti; API yanıtları kontrollü, gerçek Google OAuth değil. APK yeniden üretildi: **41.457.925 bayt**, SHA-256 `1ef47f82e9ef8d611abaea7b9e85b09bbd0d4f46f54b14c1f1e3ab05d669b052`; release derlemesi 55 saniye, v2 imza doğrulaması başarılı. Önceki APK özeti aşağıda tarihsel kayıt olarak duruyor. Yeni APK da aynı yerel HTTP API'sini ve geliştirme sertifikasını kullanır. Fiziksel cihaz/iOS doğrulaması yapılmadı. Ayrıntılar: [güvenlik raporu](../SECURITY_REVIEW_2026-10-18.md).

> **18 Ekim 2026 — 5 ve 6. bulgu düzeltmeleri:** Eski adresi onay öncesi koruyan e-posta değişikliği, bekleyen isteği yeniden yükleme, kod/onay bağlantısı, yeniden gönderme/iptal ve Google ilk şifre akışı eklendi. Gerçek Express/geçici MongoDB üzerinde 11 yeni test; kod sınırı/süre/tekrar kullanım, eşzamanlı onay/yeni kod, benzersizlik yarışı, şifre değişikliği sonrası eski linkin reddi, sağlayıcı hatası, Google ve mevcut web link akışını doğruladı. Sahne ekranı FlatList ve tek aramalı bağlantı paneline taşındı; teknik perde kimliği alanı kaldırıldı. 100 sahne, Türkçe arama, filtre, özel perde ve kontrollü görünür alan render kontrolü için 5 yeni mobil test eklendi. **55/55 mobil test**, TypeScript ve lint geçti. Tam backend regresyonu **756 geçti, 59 opt-in test atlandı**. Posta gönderimi kontrollü adaptörle; native görünüm testleri kontrollü bileşen adaptörleriyle yapıldı. Fiziksel Android/iOS klavye, e-posta ve performans kabul testleri henüz yapılmadı. Aşağıdaki tarihli sonuçlar önceki denemelerin kaydıdır.

> **18 Ekim 2026 — gerçek Android APK:** `npm.cmd run android:preview` ile `:app:assembleRelease` başarıyla tamamlandı; son tekrar 57 saniye sürdü ve sıfır çıkış koduyla döndü. `artifacts/acb-atolyesi-preview.apk`: **41.457.381 bayt**, ARM64, minimum Android 7 / API 24, hedef API 36, paket `com.acbatolyesi.mobile` / 1.0.0. `apksigner verify --verbose --print-certs` v2 imzayı doğruladı; sertifika Android Debug, mağaza imzası değildir. İçeride 2.816.608 bayt Hermes bytecode, yeni e-posta uçları ve sahne paneli doğrulandı; Metro gerekmez. APK'nın SHA-256 özeti: `8ddc877ad7256548a74fedd87b0057ac1dcd6a24daad3b9d9ac2c4a4bd088f21`. API: `http://192.168.1.128:5000/api`. `adb devices` boştu; bu nedenle APK'nın gerçek telefonda açılması henüz doğrulanmadı. iOS için Hermes export başarılı; native iOS derleme/çalıştırma Windows'ta yapılmadı.

> **18 Ekim 2026 — 4. bulgu düzeltmesi:** Kişisel/eser notları, sahneler, karakterler ve dünya kayıtları kayıt başına ayrı cihaz taslağı kullanıyor. Kayıt geçişi önce cihaz yazısını tamamlıyor; hata görünür ve geri çıkış korunuyor. Kişisel notlarda zengin metin editörü, yerel otomatik kayıt ve bağlantı varken gecikmeli sunucu kaydı var. Eski ortak araç taslakları taşınıyor. Yeni mobil API, sahiplik kontrolü ve atomik sürüm koşuluyla kayıt yapıyor; iki eşzamanlı farklı yazıdan biri 409 alıyor, iki metin görünür ve seçim öncesi yedekleniyor. Oluşturma yanıtı kaybolursa aynı taslak kimliği ikinci sunucu kaydı oluşturmuyor. Notların web düz metni ve mobil biçimi ayrı tutuluyor; eski düz metin satır sonları/özel karakterleri kayıpsız gidip geliyor. **50/50 mobil test**, TypeScript ve lint geçti. Gerçek Express/MongoDB üzerinde 13 yeni araç testi dahil tam backend regresyonunda **745 geçti, 59 opt-in test atlandı**. İstemci testlerinde depolama/ağ adaptörleri kontrollü; backend testlerinde geçici gerçek MongoDB ve gerçek Express route'ları kullanıldı. Android/iOS Hermes paketleri üretildi. Gerçek telefon klavyesi, zorla kapatma ve yeniden açma kabul testi henüz yapılmadı.

> **15 Ekim 2026 — 3. bulgu düzeltmesi:** Bölüm ve okuma eşitlemesi kayıt bazında hata topluyor; HTTP 403/404/422/500 alan bir bölüm ve kaldırılmış bir okuma kaydı, sonraki sağlam kayıtları durdurmuyor. Hata ilgili bölüm kartında veya Kütüphane'de görünür; başarısız yerel metin/ilerleme silinmez. 401, hesap değişimi, profil/sözleşme gerekliliği ve cihazın bağlantısının kesildiğinin doğrulanması kuyruğu durdurur. Cihaz çevrimiçiyken tek isteğin yanıt kaybında diğer kayıtlar devam eder. On bir yeni test; ardışık deneme, başarılı kayıtların tekrar gönderilmemesi, hata sonrası düzelme, yetki/oturum sınırı, hesap ayrımı ve bozuk okuma kaydının izolasyonunu doğruluyor. Depolama/ağ adaptörleri kontrollü; gerçek API istemcisi, taslak motoru ve kuyruk kodu çalıştırıldı. **34/34 mobil test**, TypeScript ve lint geçti. Fiziksel cihazda kabul testi bekliyor.

> **15 Ekim 2026 — 2. bulgu düzeltmesi:** Atölyem artık eşitlenmiş bölümler dahil tüm cihaz kopyalarını eser bazında gösteriyor. Eser adları hesaba özel saklanıyor; yerel liste API yanıtını beklemeden yükleniyor ve ekrana dönüşte yenileniyor. Dört yeni test; sunucuyla eşitleme sonrası modül belleğinin sıfırlanması, çevrimdışı listeleme/açma/yazma/yeniden açma, kayıt durumları, hesap ayrımı, eksik/bozuk eser adı önbelleği ve hesaba özel temizliği kontrol ediyor. Storage, ağ durumu ve native görünüm adaptörleri bu testlerde kontrollü; taslak motoru, yerel kayıt okuma ve açma akışı gerçek kod. **23/23 mobil test**, TypeScript ve lint geçti. Fiziksel cihazda uçak modu/uygulamayı zorla kapatma testi henüz yapılmadı.

> **15 Ekim 2026 — 1. bulgu düzeltmesi:** Editör komutu, eski seçim önbelleği yerine odak editördeyken güncel DOM seçimini kullanıyor; odak kaybında seçim eşzamanlı saklanıyor ve ardışık komutlardan sonra yenileniyor. Eski/yeni seçim yarışı, güncel imleçte yazma ve araç çubuğuna odak geçişi için üç regresyon testi eklendi. Düzeltme öncesinde bu senaryolar başarısızdı; düzeltme sonrasında gerçek Edge motoru dahil **19/19 mobil test**, TypeScript ve lint geçti. Android/iOS WebView ve gerçek klavye kabul testi henüz yapılmadı.

> **15 Ekim 2026 yeniden inceleme:** TypeScript/lint ve backend mobil 8 test geçti. Mobil testlerde 15 geçti, editörün seçime biçimlendirme uygulama testi başarısız oldu; ayrı tekrar da aynı hatayı verdi. Aşağıdaki 16/16 sonucu önceki çalıştırmanın kaydıdır, güncel kabul sonucu değildir. Android APK henüz tamamlanmadı. Güncel bulgular: [REVIEW-2026-10-15.md](./REVIEW-2026-10-15.md).

Bu rapor JavaScript paket üretimi, gerçek API entegrasyonu, yerel editör motoru testleri ve telefon üzerinde test edilen durumları ayrı belirtir.

## Tamamlanan kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npm ci --ignore-scripts` | Kilit dosyasından peer override / legacy flag olmadan temiz kurulum geçti |
| `expo install --check` | SDK 55 native sürümleri uyumlu |
| TypeScript | Geçti |
| ESLint | Geçti, uyarı yok |
| Mobil birim / yerel editör testleri | 55 test geçti; Edge ile editör testleri dahil |
| Backend mobil güvenlik / API testleri | Yeni e-posta 11, yardımcı araçlar 13 ve mevcut mobil akış testleri geçti |
| Backend regresyon | Son `test:all` çalıştırmasında 815 test geçti, atlanan yok |
| Android / iOS Hermes export | Son kaynakla her iki platform paketi üretildi: Android 4,3 MB, iOS 4,2 MB |
| Android native prebuild | Android proje/manifest üretimi geçti |
| Android native APK | SDK 36 / NDK 27.1 / Gradle 9 ile release deneme APK'sı üretildi, imzası ve gömülü kodu doğrulandı |
| Android uygulamasını başlatma | Bağlı fiziksel cihaz yok; native açılış/klavye/performans testi henüz yapılmadı |
| iOS uygulamasını başlatma | Windows'ta Xcode/iOS simülatörü olmadığı için çalıştırılamadı |
| EAS/mağaza paketleri | Harici hesap ve imza kimlikleri olmadığı için oluşturulmadı |

## Çalıştırma desteğinde doğrulananlar

- Kullanıcının paylaştığı `npx.cmd` çıktısı bir hata değildir; argümansız npx npm komut kabuğunu açar.
- `mobile/.env` mevcut bilgisayarın LAN adresiyle oluşturuldu; sunucu sırları bu dosyaya aktarılmadı.
- Gerçek backend başlatıldı; `/api/health` ve LAN üzerinden `/api/mobile/config` 200 döndü.
- `.env` ile Metro başlatıldı ve geliştirme paketi QR kodunu üretti. Kullanıcının kendi terminalinde 8081 portunu kullanabilmesi için bu tanılama Metro süreci kapatıldı.
- `android:doctor`, SDK ve Android Studio içindeki Java'yı otomatik buluyor. İlk indirmeler tamamlandı; `android:preview` ile gömülü kod içeren gerçek ARM64 APK üretildi. `android:apk` Metro gerektiren geliştirme paketini üretmeye devam eder.

## Gerçek API ile geçen akışlar

Express route'ları ve geçici MongoDB replica set üzerinde:

- Native giriş → Bearer oturumu → kimlik → günlük paylaşımı → akış.
- Eser oluştur → bölüm oluştur → Türkçe/HTML biçimlendirmeli metni sürümlü kaydet → yeniden aç.
- Eski sürümle kayıt → 409, sunucudaki metin korunur.
- Bölümü yayınla → public eser/bölüm listesinden aç → tam metni oku → yüzde 63 ilerleme kaydet/oku.
- Çıkış → eski tokenla kimlik isteği 401.
- Sahne oluştur → dokunmatik sıra isteğini kaydet → eski timestamp ile sırayı değiştirme isteği 409.
- Push cihazını oturuma bağla → inbox'tan kalıcı kuyruk → sağlayıcı ticket → receipt → sent → oturumu iptal et → cihazı temizle. Bu testte yalnızca dış push sağlayıcısının HTTP yanıtı kontrollüdür; MongoDB, route ve oturumlar gerçektir.

## Editör ve çevrimdışı kayıt testleri

- Türkçe karakter, başlık, liste, alıntı, kalın/italik/alt çizgi, hizalama korunur.
- Kaydetme yanıtı beklenirken yazılan yeni metin kaybolmaz.
- Bağlantı hatasından sonra disk kaydı yeniden açılıp eşitlenir.
- Çakışmada iki sürüm tutulur; açık çözüm öncesi yedek alınır.
- Metni kaydettiği halde yanıtı kaybolan sunucunun aynı metni güvenle kabul edilir.
- Hesapların taslak anahtarları birbirinden ayrıdır; eski istek yeni hesabın oturumunu kapatamaz.
- Disk hatası sunucu kaydı başarısı olarak gösterilmez.
- Gerçek Edge/Chromium motorunda 320×568 px, 1,6× yazı büyüklüğü, 60.000+ karakter ve uzun tek sözcük yatay taşma olmadan düzenlenir.
- Yüklü/pasted script/olay öznitelikleri yerel editörde çalıştırılmaz.

Tarayıcı testi yerel editör belgesini kontrol eder. iOS WKWebView / Android WebView klavye, IME, VoiceOver/TalkBack veya uygulama yaşam döngüsünün telefon doğrulaması yerine geçmez.

## Fiziksel cihaz / simülatörde kalan kabul testleri

Android ve iOS geliştirme paketlerinde gerçek test hesabıyla tamamlanmalıdır:

1. 320–360 dp telefon: beş sekme, uzun eser başlığı, boş akış, büyük sistem yazısı ve güvenli alanlar.
2. Giriş/kayıt/OTP/sözleşme tamamlama; geçersiz kod, süresi dolan oturum ve yeniden giriş.
3. Giriş → akış → eser → okuma → geri → kütüphaneden kaldığın yer.
4. Eser → yeni bölüm → biçimlendirilmiş uzun yazı → klavye açıkken Kaydet ve araç çubuğu → geri → yeniden aç.
5. Uçak modu → yaz → cihaz kaydı görülsün → uygulamayı kapat/aç → aynı metin → yeniden bağlantı.
6. Web'de aynı bölümü değiştir → telefondaki eski taslağı eşitle → çakışma ekranı → her çözüm ve yedek.
7. Türkçe IME/dikte, seçim, biçimlendirilmiş yapıştırma, geri al; klavye/döndürme/sistem fontu değişiminde metin.
8. Okuma tercihleri ve ilerleme; hassas içerik onayı, kaldırılmış bölüm, bağlantı hatası.
9. Sahne listesi sıralama, durum, perde değiştirme, bağlantı kurma; karakter/dünya/not kayıtları.
10. Gerçek posta bağlantısı; HTTPS universal/app link'in uygulamayı açması, uygulama yokken fallback.
11. FCM/APNs yapılandırması sonrası gerçek fiziksel push teslimi, okundu durumu, çıkış/izin kapatma.
12. Profil/kapak fotoğrafı seçme, izin iptali, dosya/Cloudinary hatası; AI kota ve anahtar yokluğu.
13. Ayarlar → yeni e-posta/kod → uygulamayı kapat/aç → bekleyen adres → yanlış kod/yeniden kod/iptal → doğru kod. Onaydan önce eski adresin, onaydan sonra yeni adresin girişte çalıştığını doğrula. Google-only hesapta ilk şifre → yeniden giriş.
14. 100 sahne → perde filtresi → yukarı/aşağı → bağlantı panelinde Türkçe arama → ekle → yönet/kaldır → yeniden aç. 320–360 dp ekran ve büyük sistem yazısıyla, klavye açıkken arama/geri/kapat düğmelerini dene. FPS ve bellek ölçümü bu ortamda yapılmadı.

Bu cihaz testleri henüz yapılmadı; bu uygulama mağaza yayını için onaylanmış kabul edilmemelidir.
