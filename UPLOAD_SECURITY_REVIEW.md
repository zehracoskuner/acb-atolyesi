# Kapak ve profil yükleme incelemesi — 23 Eylül 2026

Bu inceleme yükleme güvenliği ve test doğrulamasıyla sınırlıdır; yeni ürün özelliği eklenmedi. Çalışma ağacındaki diğer değişiklikler korunmuştur.

Son doğrulama: `npm run test:all` — **13 dosya, 230 başarılı test, 0 başarısız, 0 atlanan**. Frontend sözleşme doğrulama betiği ve üretim derlemesi de başarılıdır.

## Önceki dört başarısız test

Dördü de `tests/auth.test.js` dosyasındadır. Önceki koşuda ortak `account` örneği yalnızca kimlik, e-posta ve rol içeriyordu. `config/terms.js`, `middlewares/ensureAuth.js`, `TERMS_ACCEPTANCE.md` ve `tests/termsAcceptance.test.js` birlikte incelendi: güncel sürümün veritabanında kabul edilmiş olması bilinçli API sözleşmesidir. JWT içindeki kabul/rol iddiaları bunun yerine geçmez.

| Test | Eski beklenti | Yeni davranışla uyuşmazlık | Karar |
| --- | --- | --- | --- |
| `accepts header and cookie sessions and preserves cookie precedence` | Geçerli JWT ile `req.user.id` dolmalı; çerez öncelikli olmalı. | Kabul kaydı olmayan kullanıcı zorunlu kimlik doğrulamada `403 TERMS_ACCEPTANCE_REQUIRED` alır; optionalAuth anonim devam eder. | Ürün regresyonu değil, eksik test verisi. Başarılı oturum örneğine güncel kabul eklenmeli. Çerez önceliği beklentisi korunur. |
| `checks current user staff permissions` | Veritabanındaki `user` rolü atanmalı ve personel yetkileri reddedilmeli. | Kabul kontrolünde durulduğu için `req.user` oluşmaz; rol kontrolüne hiç ulaşılmaz. | Eksik test verisi. Kabul edilmiş kullanıcıyla gerçek rolün JWT'deki sahte `admin` rolünden üstün olduğu doğrulanır. |
| `checks current moderator staff permissions` | `moderator` rolü atanmalı; moderatör işlemleri açık, yalnız admin işlemleri kapalı olmalı. | Aynı kabul kapısı rol kontrolünden önce isteği durdurur. | Eksik test verisi. Güncel kabul verilir; rol ayrımı korunur. |
| `checks current admin staff permissions` | `admin` rolü atanmalı; admin/personel kontrolleri geçmeli. | Admin rolü sözleşme kabulünden muaf değildir. | Eksik test verisi. Güncel kabul verilir; admin için de kabul zorunluluğu ayrıca test edilir. |

Bu inceleme başladığında `newTermsAcceptance()` ortak örneğe zaten eklenmişti ve dört test geçiyordu. Bu turda `profileComplete: true` açıklaştırıldı; üç rolün her biri için eksik/eski/tarihsiz kabul, çerez/Bearer, sahte JWT kabul alanları, tam `403` hata kodu ve optionalAuth anonim davranışı eklendi. Üretim kimlik doğrulaması gevşetilmedi.

## Güvenlik bulguları ve düzeltmeler

Tam paket koşusunda eşzamanlı değişen `tests/reportWorkflow.integration.test.js` dosyasında önce eksik, ardından yinelenen Vitest importu görüldü; tek standart paket importuna indirildi. Ayrıca gövdesiz yorum silme DELETE isteğinin `req.body.reason` erişimi nedeniyle 500 verdiği saptandı. `routes/adminReports.js` için eşzamanlı gelen `req.body?.reason` düzeltmesi korunup gerçek entegrasyon testiyle doğrulandı; bu düzeltme bu inceleme tarafından yazılmış değildir.

| Kontrol | Sonuç ve kanıt |
| --- | --- |
| Oturum çerezleri | Yerel giriş ve Google web callback zaten `HttpOnly`, üretimde `Secure`, `SameSite=Lax` kullanıyordu. Geliştirme/üretim ayrımı `termsAcceptance.test.js` ve `googleAuth.test.js` ile doğrulandı. Yerel girişte `Path=/` da kontrol edildi. |
| CSRF / Origin | Önceden CORS ve SameSite vardı; çerezli, kaynağı belirsiz isteklere açık bir ret yoktu. `uploadOrigin.js` çerezli istek için izinli Origin, Origin yoksa izinli Referer ister. `null`, yanlış/sahte alt alan ve kaynak bilgisi bulunmaması reddedilir. Çerez ve Bearer birlikteyse çerez kuralı geçerlidir. Çerezsiz mobil Bearer istekleri Origin olmadan çalışır. Kontrol kapak/avatar/banner rotalarında dosya ayrıştırılmadan çalışır. |
| Eşzamanlı kullanıcı kotası | Bellek sayacı tek süreçte yarışsız olsa da süreçler arasında paylaşılmıyordu. `uploadRateStore.js` tek MongoDB belgesinde atomik `findOneAndUpdate` ve sunucu saati `$$NOW` kullanır. Aynı kullanıcıyla 40 eşzamanlı isteğin yalnız 20'si sonraki aşamaya geçer. |
| Çoklu süreç | Kapak, avatar ve banner aynı MongoDB koleksiyonundaki ayrı IP/kullanıcı anahtarlarını paylaşır. İki bağımsız Node HTTP sürecinde hem IP hem kullanıcı limiti test edildi; yeniden başlatma kotayı sıfırlamaz. `_id` benzersizdir, eşzamanlı ilk oluşturma çakışması yeniden denenir; yazılar majority onayı ister. TTL yalnız temizliktir; süresi dolmuş kayıt atomik güncellemede sıfırlanır. Veri deposu hatasında istek devam etmez. |
| Dosya sınırları / çözümleme | Dosya başına 5 MiB, tek dosya, alan kabul etmeyen multipart; mevcut kapak JSON/urlencoded 50 MB sınırı korunur. Sharp gerçek biçimi okur, bildirilen MIME ile karşılaştırır; JPEG/PNG/WebP/GIF için bütün piksel/kareleri çözümler ve yeniden kodlar. Profilin mevcut JPEG/PNG/WebP alt kümesi korunur. `failOn: warning`, toplam 40 milyon piksel, 200 kare, 10 saniye işlem sınırı ve kodlanmış sonuç için tekrar 5 MiB sınırı vardır. Metadata ve eklenmiş yükler yeniden kodlamada taşınmaz. |
| Decompression bomb / animasyon | Sıkıştırılmış boyutu 5 MiB altında olup açılmış hali piksel sınırını aşan PNG ve iki GIF karesinin toplamı için ret testleri var. 201 kareli GIF reddedilir. Geçerli animasyonlu GIF iki kare olarak korunur. Bozuk/kesik JPEG/PNG, SVG, metin ve sahte MIME reddedilir. |
| Dış servislere erişim | Hatalı/oturumsuz/CSRF isteklerinde AI ve Cloudinary casuslarının çağrılmadığı doğrulanır. Moderasyon reddinde Cloudinary çağrılmaz. Gerçek dış servisler testte taklit edilir; MongoDB sayaçları gerçektir. |
| Sahiplik | `/api/upload` yalnız yeni bir görsel URL'si üretir; bir eseri değiştirmez. `PATCH /api/works/:id` sorgusu `_id` ve oturum kullanıcısını birlikte şart koşar. Başka kullanıcı/admin ve sahte gövde `user` alanı ile değişiklik reddedilir. Avatar/banner hedefi yalnız `req.user.id`'dir; sahte query kullanıcı kimliği hedefi değiştiremez. Cloudinary public_id/overwrite hedefi istemciden alınmaz. |

MongoDB tek belge atomikliği: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
Origin/Referer yaklaşımı: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Kota tüketimi sözleşmesi

- Yükleme middleware'ine ulaşan istek önce IP kotasını tüketir. Sunucunun daha önceki CORS/genel limit katmanlarında durdurduğu istekler bu aşamaya ulaşmaz.
- Kaynak kontrolünü ve kimlik doğrulamayı geçen istek kullanıcı kotasını da tüketir. Kaynak/oturum reddi başka kullanıcının kotasını tüketmez. Avatar/banner sırası kapakla aynı hale getirildi.
- Başarılı yükleme, eksik/bozuk/çok büyük dosya, moderasyon reddi ve sağlayıcı hatası için iade yoktur. Reddedilen denemeleri ücretsiz yapmak doğrulama ve AI maliyetlerinin kötüye kullanımına izin verirdi.
- IP kotası dolmuşsa kullanıcı sayacına ulaşılmaz. Kullanıcı kotası dolmuşsa IP sayacı yine tüketilmiş olur. IP ve kullanıcı sayaçları tek bir ortak işlem değildir; her kapı kendi aşamasına ulaşan denemeyi sayar.
- Her iki kota saatte 20; sayaçlar kapak/avatar/banner arasında ortaktır. Pencere ilk denemeden itibaren bir saattir, kayan pencere değildir. Süreç yeniden başlatma ve IP değiştirme kullanıcı kotasını sıfırlamaz.

## Doğrulama komutları

```text
cd backend
npm run test:all
cd ../frontend
node scripts/verify-terms.mjs
npm run build
```

`test:all`, varsayılan koşuda atlanan kitap indirme ve bölüm geçmişi entegrasyonlarını da geçici loopback MongoDB replica setleriyle çalıştırır. Uygulamanın MONGO_URI değerini kullanmaz. Yükleme testleri gerçek MongoDB ve gerçek HTTP kullanır; çoklu süreç testi ayrı Node süreçleri açar. İlk çalıştırmada test MongoDB binary indirmesi gerekebilir.

## Kalan riskler ve kapsam sınırları

- Canlı MongoDB/Cloudinary/AI, gerçek tarayıcı ve dağıtım topolojisi üzerinde test yapılmadı. Tüm uygulama süreçleri aynı MongoDB veritabanını kullanmalı; sayaç koleksiyonu için yazma/indeks yetkisi gerekir. DB ulaşılamazsa güvenlik gereği yükleme kapanır.
- `trust proxy: 1`, uygulamanın gerçekten güvenilen tek proxy arkasında ve doğrudan dış erişime kapalı olması varsayımına dayanır. Yanlış dağıtım IP kotasını zayıflatabilir; kullanıcı kotası IP'den bağımsızdır.
- Upload dışındaki genel/auth/AI limitleri mevcut süreç içi store'u kullanır; bu inceleme onları dağıtık hale getirmez.
- Piksel/kare/süre sınırları tek dosya kaynak kullanımını sınırlar, eşzamanlı çok sayıda hesabın toplam bellek/CPU tüketimi için mutlak süreç izolasyonu sağlamaz. Kodlanmış 5 MiB kontrolü çıktı buffer'ı oluşturulduktan sonra yapılır.
- Mevcut politika, AI servisi hata verirse teknik olarak geçerli görselin Cloudinary'ye yüklenmesine izin verir; değişmedi. Bu içerik moderasyonunun servis kesintisindeki sınırıdır, dosya doğrulaması atlanmaz.
- JWT'nin istemciye dönmesi ve frontend'de saklanması mevcut davranıştır; HttpOnly çerez tek başına XSS karşısında tüm oturum kopyalarını korumaz. SameSite=Lax farklı site üzerindeki frontend/API dağıtımında çerez gönderimini kısıtlar; mevcut Bearer yolu korunmuştur.
- Frontend derlemesinde mevcut CSS `@import` sırası ve büyük chunk uyarıları var; derleme başarısızlığı değiller.

## Bu incelemede değiştirilen / eklenen dosyalar

- `middlewares/uploadOrigin.js`: yükleme kaynağı doğrulaması.
- `services/uploadRateStore.js`: atomik, paylaşılan MongoDB sayaçları ve TTL indeksi.
- `middlewares/rateLimiter.js`: iki yükleme sayacının ortak depoya bağlanması, depo hatasında kapalı davranış.
- `routes/upload.js`, `routes/user.js`, `config/cloudinary.js`: kaynak/kimlik/kota sırasının uygulanması ve profil ile kapak akışının eşitlenmesi.
- `server.js`: sayaç indeksinin dinlemeye başlamadan hazırlanması.
- `tests/auth.test.js`: bilinçli sözleşme değişikliği için pozitif/negatif yetkilendirme testleri.
- `tests/googleAuth.test.js`, `tests/termsAcceptance.test.js`: üretim/geliştirme çerez bayraklarının doğrulanması.
- `tests/upload.test.js`, `tests/fixtures/uploadRateWorker.mjs`: gerçek MongoDB, HTTP, çoklu süreç, CSRF, sahiplik, kota politikası ve dosya güvenliği testleri.
- `tests/reportWorkflow.integration.test.js`: yalnız Vitest import düzeltmesi.
- `scripts/test-all.mjs`, `package.json`: isteğe bağlı entegrasyonları da açan tam test komutu.
- `UPLOAD_SECURITY_REVIEW.md`: bu inceleme ve sonuçları.

Önceki turdan gelen `middlewares/imageUpload.js` içerik doğrulaması ve frontend yükleme değişiklikleri bu turda yeniden incelendi; bu turda bu dosyalar değiştirilmedi.
