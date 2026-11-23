# Deploy doğrulama ve güvenlik raporu — 5 Ekim 2026

> Bu rapor önceki turun tarihsel kaydıdır. Legacy JWT ve dependency bulguları sonraki code-only turda kapatıldı. Güncel sonuç ve release kararı: [RELEASE_CODE_REVIEW_2026-10-05.md](./RELEASE_CODE_REVIEW_2026-10-05.md).

**Karar: Production için NO-GO.** Yerel düzeltmeler ve doğrulama tamamlandı; açık bağımlılık bulguları ve doğrulanmamış hosting/oturum konfigürasyonu production onayını engelliyor. Deploy, push, release tag, Git geçmişi yeniden yazımı veya production veritabanı işlemi yapılmadı. Mevcut çalışma ağacındaki önceki değişiklikler korunarak çalışıldı.

## Kök nedenler ve oturum kalıcılığı

| Başlangıçta başarısız test | Kök neden | Sonuç |
| --- | --- | --- |
| `guestRendering.test.jsx` | Tamamlanmış üye fixture'ında `birthYear` yok. `membershipStep` bu hesabı profil tamamlama adımına yönlendiriyor. | Geçerli üye fixture'ına doğum yılı eklendi; eksik yıllı eski hesabın özel sayfayı açamadığı ayrı regresyonla korunuyor. |
| `tourLayout.test.jsx` | Aynı fixture eksikliği turu doğru biçimde engelliyor. | Geçerli fixture güncellendi; eksik yıllı restore edilmiş hesabın tur başlatamadığı ayrıca doğrulandı. |
| `feedbackAndQueues.integration.test.js:77` | Eski assertion/doküman admin-only okuma beklerken güncel kod ve `reportWorkflow` testleri moderatörün telif dosyalarını okumasını açıkça destekliyor. | Kullanıcı bu turda “Moderatör okuyabilsin; yalnız admin karar versin” kuralını doğruladı. Assertion 2'ye bu ürün kararıyla güncellendi; dönen iki kaydın kimlikleri, salt okuma ve yasak yazma işlemleri de test edildi. Doküman aynı kuralla güncellendi. |

İlk iki test oturum kalıcılığı değişikliğinden doğrudan etkilenmiyor: testler oturum taşımasını taklit ediyor; cookie/JWT süresi veya gerçek login çalıştırmıyor. Oturumun doğrulanmış kullanıcı kimliğini yeniden yüklemesi ve ardından üyelik koşullarını değerlendirmesi doğru davranış. `/auth/me`, login ve `User.toSafeJSON()` doğum yılı eksik hesapları eksik profil olarak sunuyor; `ProfilTamamla` mevcut kullanıcı adını koruyup yılı alıyor. Testleri geçirmek için `membershipStep` gevşetilmedi.

Ancak incelemede gerçek bir backend tutarsızlığı bulundu: `ensureAuth`, `profileComplete=true` fakat doğum yılı eksik eski hesabı üye işlemine kabul edebiliyordu. Backend'e de tamsayı doğum yılı koşulu eklendi. `ensureIdentity` profil tamamlama/kimlik doğrulama için açık kalıyor; normal üyelik ve optional member yetkisi eksik profilde verilmez. Tamamlanmış yetişkin hesabı temsil eden diğer eski fixture'lar da bu kurala güncellendi.

Telif testinin session persistence ile ilişkisi yok. Geçici admin-only erişim daraltması kullanıcı kararı sonrasında geri alındı; nihai kod moderatöre okuma, admin'e karar yetkisi verir. Moderatörün workflow/resolve/dismiss/warn/comment kısayollarından telif dosyasını değiştirmesi 403 ile engellenir. Taraf olan admin'in karar yasağı da korunur.

## Yapılan düzeltmeler

- `auth.js`: zaten doğrulanmış hesabın e-posta adresi ve herhangi bir OTP ile token alınabilen yolu kapatıldı. Gerçek OTP atomik tek kullanımlık tüketilir; web OTP akışı cookie üretir. OTP üretimi kriptografik `randomInt` kullanır. OTP/şifre sıfırlama uçlarına auth limiter, kod/e-posta gönderimlerine daha sıkı limiter bağlandı. Auth alanlarında nesne yerine metin zorunlu tutuldu; şifre sıfırlama kodu da atomik tüketilir.
- `cookieOrigin.js`, `server.js`, `validateEnvironment.js`: cookie taşıyan unsafe API istekleri güvenilir Origin/Referer gerektirir. Güvenilmeyen kaynaklar reddedilir; cookie taşımayan native Bearer istemcileri kaynaksız çalışabilir. CORS aynı origin listesini kullanır. Production'da açık HTTPS origin konfigürasyonu gerekir; localhost, kimlik bilgili veya path içeren URL ile başlangıç başarısız olur. CORS reddi 403 döner.
- `user.js` ve `admin.js`: profil ve yönetici kullanıcı yanıtlarından doğrulama/sıfırlama token ve OTP alanları çıkarıldı.
- `discussionAccess.js`, `commentController.js`, `inlineComments.js`: normal ve paragraf yorumları için eserin/bölümün gerçekten yayında ve doğru esere bağlı olması kontrol edilir. Taslağa dönen bölümün eski yorumları kamuya sızmaz. Yeni paragraf yorumu başka eser veya özel bölüme bağlanamaz; boyut/indeks doğrulaması eklendi.
- Auth/me, kullanıcı, paragraf yorumları, bölüm, AI ve görsel izin hata yollarında tespit edilen ham exception/DB/provider ayrıntıları genel mesajlarla değiştirildi. Production global handler stack'i istemciye vermez.
- `session.js`: logout/forget, eski sessionStorage token'ını da temizler. Yeni web cookie kalıcılığının süreleri değiştirilmedi.
- Frontend lint hataları giderildi. `useMembership` context/hook ayrı modüle alındı; importlar ve test mockları buna göre güncellendi. Kullanılmayan değişken/props kaldırıldı. Boş yönetim listesi catch'leri kullanıcıya hata bildirir; isteğe bağlı yerel cache hataları gerekçeli biçimde ele alınır.
- Hook uyarıları davranış açısından incelendi: okuma ilerlemesinde eski kullanıcı/bölüm metadatasının tutulması giderildi; admin/moderator yükleme callback'leri ve gezinme bağımlılıkları tamamlandı; PlotWorld bağlantı callback'i sabitlendi. Kelime tercihleri React dışındaki depoda değiştiği için kelime analizleri yeniden render sırasında hesaplanır. RichEditor'daki tekrarlı ilk-mount effect kaldırıldı; değer senkronizasyon effect'i korunur. Yeni eslint-disable eklenmedi.
- Temiz kurulumda JSX testlerinin kökteki rastlantısal React kurulumuna bağımlı olduğu ortaya çıktı. `backend/vitest.config.js`, frontend'in React/ReactDOM/Router kurulumunu açıkça çözümler.
- `selamCodex.txt:45` içinde credential biçimli malzeme redakte edildi ve yerel not Git ignore'a alındı. Gerçek sır değerleri rapor/çıktıya yazılmadı. Paket sürümleri ve lockfile'lar bu turda yükseltilmedi.

## Kesin doğrulama sonuçları

| Kontrol | Nihai sonuç |
| --- | --- |
| Backend `npm run test:all` | **62 dosya, 640/640 başarılı, 0 başarısız, 0 atlanan**; izole loopback MongoDB replica set |
| İlgili frontend testleri | **9 dosya, 65/65 başarılı, 0 başarısız, 0 atlanan**; backend Vitest runner'ıyla |
| Frontend lint | **0 hata, 0 uyarı**, exit 0 |
| Frontend production build | Başarılı, exit 0; yaklaşık 1,63 MB çizim JS chunk'ı için 500 kB uyarısı sürüyor |
| Temiz kurulum | Depodan ayrı geçici klasöre kaynak kopyası; `.env`, node_modules, dist hariç. Backend **426**, frontend **522** paket `npm ci` ile kuruldu. Kök node_modules yok. Lockfile'lar değişmedi. |
| Temiz kurulumda seçili testler | **12 dosya, 107/107 başarılı, 0 başarısız, 0 atlanan**; auth/session/CSRF ve ilgili frontend testleri |
| Temiz kurulumda frontend build | **Başarılı, exit 0**; gerçek production sırları kullanılmadan örnek API URL'siyle derlendi. Aynı çizim chunk uyarısı var. |

Temiz kaynak kopyası mevcut çalışma ağacını temsil eder; henüz commit edilmemiş değişiklikleri içeren bir Git checkout değildir. Tam 640 test bu çalışma alanında çalıştırıldı; temiz kopyada seçili 107 test çalıştırıldı. İlk izole test denemesi React çözümleme kusurunu açığa çıkardı; çözümleme düzeltmesinden sonra geçti. Bir tekrar kullanım limiti nedeniyle otomatik onay incelemesinde çalıştırılamadı; daha sonra onaylı tekrar tamamlandı.

## Güvenlik bulguları

| Seviye | Bulgu | Durum |
| --- | --- | --- |
| **Critical** | Doğrulanmış hesabın e-postası + rastgele OTP ile JWT üretimi; admin dahil hesap ele geçirme | **Düzeltildi**, HTTP ve rol varyasyonlarıyla regresyon testi var. |
| **High** | Production dependency audit bulguları | **Açık**: backend 11 High, frontend 6 High. Audit'te Critical 0; bunlar paket bazlı sayılar, uygulamadaki her advisory'nin kullanılabilirliğini göstermez. |
| **High** | Eski/native JWT'ler `sid` taşımıyorsa `validWebSession` uyumluluk nedeniyle kabul ediyor; logout/parola değişimi bu token'ları sunucuda iptal etmiyor. Eski browser token'ları localStorage'da kalabilir. | **Açık**: geriye dönük istemci uyumluluğunu kıracak toplu geçiş yapılmadı. Production öncesi token geçiş/iptal politikası gerekir. |
| **High** | Cookie mutasyonlarında uygulama genelinde açık kaynak doğrulaması yoktu; yalnız upload korunuyordu | **Düzeltildi**: genel unsafe API origin kontrolü eklendi; SameSite tek savunma olarak kullanılmıyor. |
| **Medium** | Backend üyelik kontrolü ile eksik doğum yılı state'i uyuşmuyordu | **Düzeltildi**, eksik profilde normal üye yetkisi verilmez. |
| **Medium** | Kullanıcı/staff JSON'larında OTP/sıfırlama alanları; bazı 500 yanıtlarında ham hata ayrıntısı | **Tespit edilen yollar düzeltildi** ve profil gizliliği HTTP testi eklendi. |
| **Medium** | Bilinen bölüm ID'siyle yayından kaldırılmış bölümün yorumlarına erişim ve paragraf yorumunun yanlış esere bağlanması | **Düzeltildi**, yayın/sahiplik bağlamı HTTP testleriyle doğrulandı. |
| **Medium** | Sabit `trust proxy=1`, altyapıdaki hop/alternatif doğrudan erişim yolu doğrulanmadı; genel/auth limitleri süreç belleğinde | **Açık, deployment'a bağlı**. Gerçek IP/header zinciri ve çoklu instance politikası staging'de doğrulanmalı. Upload IP+hesap limitleri MongoDB'de ortaktır. |
| **Medium** | Git geçmişinde gerçek JWT biçimli kayıt | `.claude/settings.json:6`, üç tarihsel blobda bulundu; aynı JWT 11 Haziran 2026'da dolmuş. Mevcut çalışma kopyasında kaldırılmış; Git geçmişi bu turda yeniden yazılmadı. Geçmiş temizliği/erişim değerlendirmesi ayrı işlem. |

**Bağımlılık audit'i** (`npm audit --omit=dev`): backend **17** paket bulgusu = 11 High + 5 Moderate + 1 Low; frontend **10** = 6 High + 4 Moderate. Backend High paketleri: cloudinary, ip-address, jws, lodash, mongoose, multer, multer-storage-cloudinary, nanoid, nodemailer, path-to-regexp, postcss. Frontend High: @tiptap/core, axios, form-data, nodemailer, react-router, react-router-dom. Frontend'deki server-only/transitive advisory'ler otomatik olarak tarayıcıda exploitable sayılmadı; ulaşılan kullanım ayrıca incelenmeli. npm'nin Cloudinary/Nodemailer/multer-storage-cloudinary çözüm önerilerinde SemVer major değişim var. Otomatik audit fix veya major upgrade yapılmadı. Ham sonuçlarda advisory bağlantıları korunur: [backend audit](./review-evidence/backend-audit.json), [frontend audit](./review-evidence/frontend-audit.json); örnek doğrudan kaynak: [Cloudinary advisory](https://github.com/advisories/GHSA-g4mf-96x5-5m2c).

Sır taraması 53 erişilebilir commit ve 453 farklı blobda credential/JWT/private-key/assignment kalıplarını inceledi. `.env` dosyaları mevcutta ignore ediliyor ve erişilebilir Git geçmişinde `.env` commit'i bulunmadı. Son kaynak kalıp taramasında kalan provider-key/JWT/credential-URI adayı yok. Bu tarama bütün olası sır biçimlerinin bulunacağının garantisi değildir. Yerel nottaki malzemenin sağlayıcı geçerliliği denenmedi; ilgili credential sahibinin iptal/rotation değerlendirmesi gerekir.

## Authentication/session değerlendirmesi

Yeni web parola/Google girişleri token'ı JSON/localStorage'a koymaz; JWT HttpOnly cookie'de, rastgele session ID'nin hash'i ve parola fingerprint'i MongoDB `AuthSession` içinde tutulur. RememberMe yalnız literal true ise 30 günlük kalıcı cookie/JWT/DB son kullanma süresi vardır; false ise session cookie ve 12 saatlik JWT/DB süresi. Oturum her açılışta `/auth/me` ile doğrulanır; ağ/5xx hatası sahte logout üretmez, doğrulanmış 401 logout yapar. Gecikmiş istek eski hesabı logout sonrasında geri getiremez. Google state, başlangıç cookie'sine ve nonce'a bağlıdır; remember tercihi imzalı state'tedir.

Production cookie: HttpOnly + Secure + SameSite=Lax + Path=/. Cookie önceliği korunur, native Bearer akışı açıktır. localStorage/sessionStorage eski token'ını JS okuyabildiğinden XSS halinde çalınabilir; yeni cookie credential'ı doğrudan JS okuyamaz, fakat XSS kullanıcı adına istek gönderebilir. [OWASP storage açıklaması](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), [CSRF açıklaması](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

`JWT_SECRET` tek environment kaynağından alınır; production/dev hard-coded veya fallback secret bulunmadı. Eksik/boş secret, server'ın ilk environment doğrulamasında başlangıcı durdurur. Rol JWT claim'inden güvenilerek verilmez: middleware güncel DB rolünü yükler; server/admin/moderator/contentModeration/comments uçlarında backend role kontrolü vardır. Frontend gizleme yetki sınırı olarak kullanılmaz.

Hızlı IDOR taramasında eser studio işlemleri kullanıcı-sahip filtresi, bölüm işlemleri eser sahibi, yorum düzenleme/silme yazar/staff kuralı ve profil mutasyonları `req.user.id` kullanıyor. Moderasyon kararlarında rol ve ilgili taraf yasağı mevcut. Normal/paragraf yorumlarındaki bağlam açığı bu turda kapatıldı. Bu çalışma tüm endpoint'ler için kapsamlı pentest iddiası değildir.

Upload: auth ve kaynak doğrulaması parser'dan önce; dosya başına 5 MiB, tek dosya, MIME ile decode edilmiş gerçek format eşleşmesi, piksel/frame sınırı, tüm kareleri decode/yeniden encode, metadata temizliği ve timeout mevcut. IP+hesap denemeleri ortak Mongo store'a yazılır. Kapak/avatar/banner URL bağlama yalnız kendi aktif ImageAsset'ine izin verir. Hatalı dosya sağlayıcıya gönderilmez. Çoklu instance ve gerçek reverse-proxy IP zinciri canlı ortamda denenmedi.

Vercel adresi ile `*.up.railway.app` API adresi farklı siteyse Lax cookie cross-site fetch'te taşınmayabilir. Mevcut `.env.production` Railway API URL'sine işaret ediyor. En sade üretim çözümü frontend ve API'yi aynı site altındaki özel domainlerde çalıştırmaktır (örneğin site ve api alt domaini); alternatif same-origin proxy yapılandırması ayrıca denenmelidir. SameSite=None'a körlemesine geçilmedi. Gerçek CORS/domain/OAuth/cookie panel değerleri doğrulanmadan GO verilemez.

## shared/ ve Vercel + Railway

Klasör gerçekten var; **ayrı servis değil**, package.json, sunucu veya bağımsız çalışma süreci yok. İki saf ESM dosyası içerir:

- `drawingProtocol.js`: frontend/backend ortak snapshot yapı doğrulaması; 9 MiB snapshot ve 10 MiB request limitleri.
- `features.js`: bölüm geçmişi, gelişim koçu, sahne AI ve çizim için launch flag'leri. Dört flag de false. Gelecek sürüm uygulamaları saklı kalır; iç save/revision güvenliği kapatılmaz. Frontend build ve backend aynı dosya/sürümden üretilmelidir.

`git ls-files shared` ve `git log --all -- shared` boş: klasör **henüz Git'e eklenmemiş**. Dolayısıyla Git'ten kim oluşturdu veya ne zaman eklendi belirlenemiyor. Dosya sistemi creationTime, drawingProtocol için 23 Eylül, features için 3 Ekim 2026 gösteriyor; bu zamanlar Git provenance kanıtı değil. Bu turda klasör oluşturulmadı, silinmedi, taşınmadı veya yeniden yapılandırılmadı.

| Ortak dosya | Frontend importları | Backend runtime importları |
| --- | --- | --- |
| `features.js` | DevelopmentCoachPreference, ChaptersPage, PlotWorld, DetailPanel, SceneDetailPage, SceneNode | routes/ai.js, routes/chapter.js, routes/user.js, services/developmentCoach.js |
| `drawingProtocol.js` | lib/drawingPersistence.js | server.js, routes/drawing.js, services/cloudinaryDrawing.js |

Yerel `frontend/vercel.json` yalnız SPA index rewrite içeriyor; Root Directory/include-outside ayarı burada yok. Railway root/build ayarını kanıtlayan yerel yapılandırma veya bağlı CLI bulunmadı. Hosting panellerine erişilmedi; mevcut Vercel/Railway build bağlamlarının shared'ı gerçekten içerdiği **doğrulanamadı**.

Önerilen sade monorepo düzeni:

- Vercel Root Directory `frontend`, “Include source files outside of the Root Directory in the Build Step” açık; install `npm ci`, build `npm run build`, output `dist`. Alternatif repo root bağlamı ve `--prefix frontend` komutları. [Vercel resmi açıklaması](https://vercel.com/docs/monorepos/monorepo-faq).
- Railway build bağlamı repo root olacak şekilde tutulmalı; install/build `npm ci --omit=dev --prefix backend`, start `cd backend && npm start`. Yalnız `/backend` bağlamı seçilip dış dosyalar kesilirse `../shared` runtime import'u bozulur. Kök package.json'un yanlış server.js start komutuna otomatik tespit bırakılmamalı. `shared/` ve backend değişiklikleri watch kapsamına alınmalı. [Railway monorepo açıklaması](https://docs.railway.com/deployments/monorepo).
- Onaylı sonraki sürümde iki shared dosyası release commit'ine dahil edilmeli; frontend/backend aynı commit'ten üretilmeli. Bu turda commit/push yapılmadı.

## Sonraya bırakılanlar ve GO koşulları

Paket güvenlik düzeltmeleri, eski/native token migration ve iptal modeli, hosting panel ayarları/domain-cookie-OAuth kontrolü, gerçek proxy IP doğrulaması, çoklu instance limit deposu, staging E2E ve DB backup/rollback provası sonraki adımlardır. Backend başlangıcındaki indeks/veri düzenlemeleri production'da çalıştırılmadı. Graceful shutdown/readiness geliştirmesi, çizim bundle küçültme ve hukuk taslak metninin yayın kararı da bu turda yapılmadı.

**GO için:** High bağımlılık bulgularını giderme veya kullanım bağlamıyla gerekçeli kapatma; legacy credential geçiş kararı; shared'ın Git/build/runtime kapsamının ve aynı-site cookie akışının doğrulanması; staging üzerinde gerçek IP, login/logout/remember, profil, kayıt, upload, okuma, moderasyon ve geri dönüş provası. Yerel testlerin yeşil olması bu production koşullarını tek başına doğrulamıyor.
