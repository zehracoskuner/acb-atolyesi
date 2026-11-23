# Güvenlik incelemesi — 18 Ekim 2026

İncelenen: mevcut çalışma ağacındaki web, ortak Express/MongoDB backend, Expo mobil uygulama ve kilitlenmiş bağımlılıklar. Sonuç: önemli korumalar mevcut; aşağıdaki açık işler kapanmadan genel bir “güvenli” veya mağazaya hazır değerlendirmesi yapılmamalı. Bu çalışma canlı sunucu sızma testi değildir. Canlı TLS/proxy, veritabanı erişimi, yedekler, bulut izinleri, gizli anahtar rotasyonu ve tüm Git geçmişi denetlenmedi. Gerçek hesaplara saldırı veya e-posta gönderimi yapılmadı.

## Öncelikli bulgular

### 1. Google ile mevcut hesabı otomatik bağlama — yüksek öncelik, web ve mobil

**Kodda doğrulandı:** `backend/utils/googleUpsert.js` önce Google kimliğiyle, bulamazsa e-postayla kullanıcı buluyor. E-posta eşleşirse mevcut hesaba yeni Google kimliğini bağlayıp `emailVerified=true` yapıyor; mevcut hesap şifresi veya o adrese yeni doğrulama istenmiyor. `backend/config/passport-google.js` ve `backend/routes/auth.js` içindeki `/google/mobile` aynı yardımcıyı kullanıyor. Mobilde Google token imzası/audience/süre kontrolü var; fakat `email_verified` ve e-posta otoritesi değerlendirilmeden bağlama yapılıyor.

**Etki koşulu:** Geçerli Google kimliğindeki e-posta, başka bir mevcut hesabın e-postasıyla eşleşirse ve Google o adresin güncel sahipliğini kanıtlamıyorsa, yanlış kişiye hesap erişimi verilebilir. Özellikle Gmail/Workspace dışı adreslerde e-posta sahipliği zamanla değişebilir. Bu bir imza atlatma bulgusu değildir; gerçek Google hesaplarıyla hesap ele geçirme deneyi yapılmadı.

**Düzeltme:** Kalıcı Google hesabını `sub` ile tanı; mevcut yerel hesaba bağlantıyı oturum + yeniden kimlik doğrulama veya mevcut adrese yeni kanıt ile kur. Doğrulanmamış e-postayı reddet. Yalnızca `email_verified=true` kontrolü üçüncü taraf adreslerde tek başına yeterli değildir. [Google'ın resmi doğrulama ve hesap bağlama açıklaması](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

### 2. Mevcut deneme APK'sı HTTP kullanıyor — dağıtım öncesi yüksek öncelik

**Doğrulandı:** Üretilen APK `http://192.168.1.128:5000/api` adresini ve geliştirme amaçlı cleartext iznini kullanıyor. Kaynaklar: `mobile/app.config.ts`, `mobile/src/api.ts`, yerel derleme yapılandırması. Yerel deneme paketi Android Debug sertifikasıyla imzalı; mağaza imzası değil.

**Etki:** Ağ trafiğini okuyabilen/değiştirebilen bir taraf şifre ve Bearer oturumunu hedefleyebilir. SecureStore cihazdaki oturumu korur; HTTP aktarımını şifrelemez. Bu bulgu canlı sitenin HTTPS kullanmadığı anlamına gelmez; canlı dağıtım incelenmedi.

**Düzeltme:** Dağıtılacak paketi HTTPS API adresi, `ACB_ALLOW_HTTP=0` ve size ait kalıcı imza ile yeniden üret. Mevcut paket yalnızca güvenilen yerel ağda deneme hesabıyla test için uygundur. EAS production profili HTTP iznini kapatıyor; gerçek üretim adresi ve imza ayrıca sağlanmalı.

### 3. Şifre sıfırlama/doğrulama kodlarında hesap başına deneme bütçesi yok — orta öncelik

**Kodda doğrulandı:** `backend/routes/auth.js` altı haneli, 15 dakika geçerli kodlar kullanıyor; doğru kod atomik tüketiliyor. **IP sınırı var:** reset/verify için 15 dakikada 10 başarısız istek; kod gönderimleri için saatte 5 istek. Kaynaklar: auth router başındaki limiter bağlantıları ve `backend/middlewares/rateLimiter.js`.

**Eksik:** Kod/hesap başına kalıcı yanlış deneme sayacı bulunmuyor; ilgili IP limitleri varsayılan süreç içi depoda. Dağıtık IP'ler, birden fazla sunucu süreci ve süreç yeniden başlaması toplam korumayı zayıflatır. Kodlar `User` içinde düz metin saklanıyor. Bu, sınırsız veya IP korumasız uç bulunduğu iddiası değildir.

**Düzeltme:** Hesap/kod başına örneğin 5 yanlış deneme, kalıcı gönderim bekleme süresi, kodun HMAC özeti ve paylaşımlı IP limit deposu. Yeni e-posta değişikliği akışında bulunan deneme sınırı/özet yaklaşımı reset ve ilk doğrulamaya da uygulanmalı.

### 4. Bağımlılık güvenlik bildirimleri — sürüm yükseltme ve erişilebilirlik incelemesi gerekli

18 Ekim 2026 npm registry taraması; sayılar bildirime konu paket düğümleridir, bağımsız ve uygulamada kullanılabilir açık sayısı değildir.

| Proje | Üretim bağımlılıkları (`--omit=dev`) | Geliştirme dahil tamamı |
| --- | --- | --- |
| Web frontend | 0 | 11 yüksek, 3 orta, 1 düşük |
| Backend | 1 yüksek | 7 yüksek, 5 orta |
| Mobil | 22 yüksek, 14 orta | 22 yüksek, 14 orta |

Üç taramada da critical düzeyinde bildirim yok; bu sonuç uygulama mantığında kritik açık bulunmadığını kanıtlamaz.

- Backend: Nodemailer 8.0.5 için bildirimler var. Registry'nin toplu düzeltme önerisi 10.1.6, major yükseltme. E-posta gönderimi ve sağlayıcı fallback akışı regresyonla doğrulanmalı. Uygulama sabit Gmail transport/Resend ve sunucuda üretilen mesajları kullanıyor; raw/jsonTransport/kullanıcı tanımlı transport gerektiren senaryoların uygulamada erişilebilir olduğu gösterilmedi. Dolayısıyla uygulamada dosya okuma/SSRF kanıtlandı denemez.
- Mobil: Expo/Metro/Jest/Xcode araçları üretim bağımlılık ağacında da yer alıyor; tamamı APK çalışırken kullanılan kod değil. Kök bildirimler arasında braces, node-forge, decode-uri-component, sprintf-js ve uuid var. Router/React Navigation altındaki URI ayrıştırıcıları için çalışma zamanı erişilebilirliği ayrıca incelenmeli; tüm uyarılar derleme aracı diye kapatılamaz. Kötü deep link ile cihaz çökmesi bu çalışmada yeniden üretilmedi.
- Frontend: geliştirme araçları dahil tarama temiz değil. Üretim bağımlılıklarında sıfır bildirim, XSS/yetki hatası olmadığı anlamına gelmez. Vite geliştirme sunucusunu internete açmamak gerekir.
- `npm audit fix --force` uygulanmadı: öneriler bazı Expo paketlerinde uyumsuz major değişiklik/düşürme içeriyor. Desteklenen SDK yamalarıyla kontrollü yükseltme ve native regresyon gerekli.

Ham tarama kayıtları bu çalışma alanında `mobile/.tools/audit-{backend,frontend,mobile}-{full,prod}.json` altında; `.tools` üretilen/ignore edilen dizindir. Tekrar: her projede `npm.cmd audit --json` ve `npm.cmd audit --omit=dev --json`.

### 5. Cihaz taslakları uygulama düzeyinde şifrelenmiyor — cihaz gizliliği iyileştirmesi

`mobile/src/storage.ts` ve `mobile/src/formDrafts.ts`, metinleri AsyncStorage'da saklıyor. Oturum SecureStore'da; taslaklar için ayrıca şifreleme yok. Cihazın uygulama depolamasına erişebilen saldırgan/root veya uygun yedek erişimi halinde yayımlanmamış metinler açığa çıkabilir. Normal, başka bir sandbox içindeki uygulamanın bu dosyaları okuyabildiği gösterilmedi. Cihaz yedekleme kuralları ve şifreli yerel metin deposu ayrıca değerlendirilmelidir.

## Mevcut güçlü taraflar ve test sınırı

- Web'de HttpOnly cookie, üretimde Secure/SameSite; mobilde SecureStore ve Bearer oturumu. Veritabanında iptal edilebilir oturum, parola değişimi/çıkış sonrası geçersizleşme.
- API'de sahiplik/rol kontrolleri, özel içerik için ayrı erişim kuralları, halka açık profilde sınırlı alanlar. Parola/OTP alanları normal profil yanıtlarında dışarı verilmez.
- Cookie istekleri için origin kontrolü, CORS izin listesi, Google OAuth state kontrolü. Sunucu HTML temizleme ve web gösteriminde sanitizasyon.
- Mobil yerel editör HTML'sinde temizleme/CSP ve sınırlandırılmış WebView erişimi. Bu editör, mevcut web sitesini açan bir WebView değildir.
- Gerçek Express ve geçici MongoDB üzerinde **815/815 backend testi** geçti; daha önce opt-in nedeniyle atlanan 59 test bu çalıştırmada etkin. Yetkisiz özel içerik, oturum iptali, CSRF, upload ve yarış koşulları dahil mevcut testlerin geçmesi, yalnızca kapsanan senaryoları doğrular.
- Mobil TypeScript/lint ve **55/55 test** geçti; web lint ve üretim derlemesi geçti. Fiziksel Android/iOS üzerinde güvenlik/klavye/yaşam döngüsü testi yapılmadı.
- İzlenen `.env`/anahtar dosyası adları kontrol edildi; bu sınırlı kontrol tam sır taraması veya Git geçmişi denetimi değildir.

## Bu istekte tamamlanan profil düzeltmesi

Google'ın geçici `google_…` adı web ekranında kullanıcının önceden seçtiği ad sanılıyor ve alan kilitleniyordu. Backend şimdi `canChooseUsername` döndürüyor; web ve mobil yeni Google hesabında kullanıcıdan kendi adını istiyor. Önceden tamamlanmış, yalnızca doğum yılı eksik hesaplarda mevcut ad korunuyor. Sunucu doğrulamaları korunuyor; kullanıcı adı müsaitlik kontrolündeki eski yanıt yarışı da iptal mekanizmasıyla giderildi.

Backend profil testlerine bu ayrım eklendi. `mobile/scripts/check-profile-browser.cjs`, gerçek Edge'de yeni Google hesabı → alınmış ad → uygun ad → tamamlama ve eski hesabın adını koruma senaryolarını geçti. Bu tarayıcı testinin API yanıtları kontrollüdür; gerçek Google OAuth uçtan uca testi değildir.

Değişiklikler yerel çalışma ağacında. Canlıya yansımaları için backend ve frontend birlikte dağıtılmalı. Önceden tamamlanmış hesapları topluca yeniden açan bir veri migrasyonu yapılmadı.

Profil düzeltmesinin hemen ardından, tasarım yenilemesinden önce üretilen APK kaydı: `mobile/artifacts/acb-atolyesi-preview.apk`, 41.457.925 bayt, SHA-256 `1ef47f82e9ef8d611abaea7b9e85b09bbd0d4f46f54b14c1f1e3ab05d669b052`. O derlemede Gradle release ve v2 imza doğrulaması geçti. Aynı dosya daha sonraki tasarım derlemesiyle güncellenebilir; **son APK bilgisi `mobile/VALIDATION.md` içindedir**. HTTP/geliştirme imzası sınırlaması yukarıdaki gibidir. Google public client ID'leri bu yerel pakette sağlanmadığı için native Google düğmesi henüz etkin değildir; konsol/imza kurulumu README'de belgeli.

## Sonraki güvenlik sırası

Önce Google hesap bağlama kanıtını güçlendir; dağıtımdan önce HTTPS/kalıcı imzaya geç. Ardından reset/doğrulama kodlarına hesap bazlı bütçe ekle ve Nodemailer/Expo bağımlılıklarını kontrollü yükselt. Son aşamada gerçek cihaz ve canlı yapılandırma testi yap. Bu incelemede bu güvenlik bulguları kapatılmış sayılmıyor; kod değişikliği profil adı akışına yönelik.
