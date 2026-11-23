# ACB Atölyesi — son code-only release incelemesi

**Kod doğrulaması GO; mevcut release kaynağıyla production NO-GO.** Legacy session ve production dependency High bulguları kapatıldı. Shared dosyaları henüz untracked; mevcut HEAD deployment kaynağında bulunmuyor. Gerçek hosting kaynak bağlamı, domain/cookie akışı ve platform davranışları staging'de doğrulanmadan production GO verilmez.

Bu turda deploy, push, commit, stage, tag, release, hosting paneli değişikliği veya production DB işlemi yapılmadı. Testler yalnız geçici loopback MongoDB/replica-set veritabanları kullandı. Önceki çalışma ağacı düzeltmeleri korundu. Shared dosyaları silinmedi, taşınmadı veya değiştirilmedi. Feature bayrakları kapalı kaldı. `trust proxy=1` değiştirilmedi.

## Gate sonuçları

| Gate | Sonuç | Production blocker mı? | Kanıt |
| --- | --- | --- | --- |
| Legacy JWT | Kapalı; sid'siz cookie/Bearer 401, tekrar login gerekir | Hayır | authSession.js legacy kabulü kaldırıldı; gerçek DB'de logout, parola değişimi/reset replay testleri; temiz kurulum 8 kritik dosyada 117 test |
| Dependency audit | Backend ve frontend ayrı ayrı 0 Critical / 0 High / 0 Moderate / 0 Low | Hayır | backend-audit-clean-release.json / frontend-audit-clean-release.json; her eski advisory ayrı triage edildi |
| shared/ | Aynı dosyalar çözülüyor, ignore değil; mevcut HEAD'de yok | **Evet: release kaynağı eksik** | git status `?? shared/`; git ls-files/history boş; yerel ve temiz kopyada hash ve import çözümlemesi aynı |
| Tests | Çalışma ağacı 64 dosya **679/679**; temiz kopya aynı **679/679**; ilgili frontend/session 11 dosya **75/75** | Hayır | Son JSON test raporları; 0 fail, 0 skip, bütün dosyalar passed |
| Lint/build | Lint **0 error / 0 warning**; production build başarılı; temiz npm ci backend **381**, frontend **511** paket | Hayır | Temiz build ve emitted module raporu; tek build uyarısı büyük çizim chunk'ı, performans konusu |
| Readiness/shutdown | Readiness DB ping + timeout + draining; SIGTERM/SIGINT drain ve bounded exit; fail-closed production env | Kodda hayır; platform staging kontrolü gerekli | 9 lifecycle + 21 startup environment testi; server ilgili model index init'lerini listen öncesi bekliyor |

## Legacy JWT/session düzeltmesi

`validWebSession` artık sid'siz token'ı kabul etmez. Rastgele 64-hex sid, imza/expiry, AuthSession kayıt varlığı, user binding, parola fingerprint'i ve DB expiry birlikte doğrulanır. JWT'nin içindeki role/terms verileri üyelik veya yetki vermez; mevcut DB hesabı kullanılır.

`/login` ve OTP'nin varsayılanı web cookie session'dır. 30 günlük remember-me ve 12 saatlik kalıcı olmayan cookie davranışı korunur; HttpOnly, production Secure, SameSite=Lax, Path=/ devam eder. Yeni web JSON yanıtı credential içermez. Profil tamamlama mevcut session'ı korur; sid'siz veya yeni bağımsız JWT üretmez.

Native login açıkça `client: "native"` gönderir; Google native `/google/mobile` üzerinden Google credential doğrulaması yapar. Native token 12 saatlik, sid + AuthSession + fingerprint bağlı credential'dır; web cookie'ye yazılmaz. Native refresh modeli henüz tasarlanmadı; legacy bypass yoktur. Mobil yeniden tasarlanırken bu sözleşme kullanılmalıdır. Eski sid'siz credential'lar yeniden login gerektirir; production öncesi bilinçli uyumluluk kırılmasıdır.

Logout cookie önceliğiyle mevcut credential'ı, cookie yoksa Bearer session'ı sunucudan siler; diğer cihazları korur. Frontend `forgetSession` ve `logoutSession` sunucunun iptalini bekler. Başarısız logout/forget yerel state'i başarılı çıkış gibi temizlemez; retry mümkündür. Confirmed 401 geldiğinde yalnız zaten geçersiz yerel state temizlenir. Geç gelen `/me` yanıtı logout sonrası hesabı geri getiremez.

Parola değişimi ve OTP/link reset sonrası eski password fingerprint'e bağlı bütün web/native credential'lar reddedilir. Expiry TTL temizliğine veya frontend gizlemesine güvenilmez. Gerçek DB testleri eski token replay'i ve yeni login başarısını doğrular; reset credential'ı ikinci kez kullanılamaz. Session kayıtlarında yalnız sid SHA-256 özeti bulunur. Yeni web login local/session storage tokenlarını temizler; eski storage tokenları sid'sizse sunucuda 401 olur. JS-readable eski credential kopyaları geçerli yeni bir token değildir.

Ek regresyonlar: iki legacy transport reddi, iki gerçek DB logout replay kontrolü, bütün cihazları etkileyen password-change kontrolü, OTP/link reset replay, iki forget-session kontrolü. Yeni Google native testleri sid, 12h expiry, kayıt üretimi ve cookie yokluğunu doğrular. Membership/profile koşulları gevşetilmedi. Önceki moderator-read/admin-decision telif kuralı korundu.

## Bağımlılık kararları

Baseline: backend 17 paket kaydı (11 High, 5 Moderate, 1 Low), frontend 10 (6 High, 4 Moderate). Son çalışma ve temiz kurulum production audit'leri **0**. Kalan her High için istenen kayıt listesi boştur; bütün eski bulguların advisory ID, etkilenen aralık, kod yolu, kategori, final sürüm/aksiyonu [ayrı triage tablosunda](./DEPENDENCY_TRIAGE_2026-10-05.md) yer alır. Bu tablo 94 advisory/aralık kaydını, 37 High kaydını içerir; aynı ID farklı dependency/etkilenen aralıkta tekrar edebilir. Paket sayısı/advisory sayısı birbirine karıştırılmadı.

Kullanılmayan backend dependency'leri kaldırıldı: bcrypt (kod bcryptjs kullanır), express-session, doğrudan mongodb 3.7 (Mongoose kendi driver'ı), multer-storage-cloudinary, Nodemailer, passport-local, @google/genai. Kullanılan @google/generative-ai korunur. Frontend Nodemailer, Passport, passport-google-oauth20 ve state kullanılmadığı için kaldırıldı. E-posta servisi Resend olarak kaldı.

Mongoose **8.24.5**, Multer **2.4.0**, jsonwebtoken **9.0.3**, express-rate-limit **8.7.0**, google-auth-library **10.9.1**, sanitize-html **2.18.0**, Axios **1.20.0**, Router **7.18.4**, DOMPurify **3.4.16** ile mevcut major'lar korundu. jws/lodash/nanoid/postcss/path-to-regexp/ip-address/qs gibi transitifler uyumlu patch/minor sürümlere çözümlendi. Cloudinary **1.41.3 → 2.11.0** major geçişi önce değerlendirildi: v2 export ve kullanılan upload_stream/destroy/api.resource çağrıları korunur; secure URL default'u mevcut HTTPS secure_url kullanımına uygundur, URL analytics yalnız üretilen URL'leri ilgilendirir, kaldırılan eski Node desteği Node 22 test ortamını etkilemez. Native Promise/stream callback yolları testlerde geçti. [Resmî changelog](https://github.com/cloudinary/cloudinary_npm/blob/master/CHANGELOG.md), [kapatılan injection advisory](https://github.com/advisories/GHSA-g4mf-96x5-5m2c).

tldraw **4.5.10** korunur; ilan ettiği ^3.12.1 TipTap aralığında aile **3.31.4** ile aynı sürüme hizalanır. İlk npm update eski core/pm/react ile yeni extension'ları birlikte bıraktığı için güvenlik kapısı açık tutuldu; overrides ve temiz npm ci ile giderildi. Mevcut Floating UI **1.7.6**, ^1.0.0 peer aralığını sağlar; açık override npm 11 çözümleme tutarsızlığını giderdi. Major TipTap/tldraw yükseltmesi yok.

Axios Node dependency'si `form-data` kurulu ağaca gelir; uygulamanın browser bundle'ında kullanılmaz. Build module incelemesinde **2,812** emitted modül içinde Nodemailer, Passport, form-data, Axios Node HTTP adapter ve Node platform modülleri **0**. Browser gadget advisory'leri sunucu-only gerekçesiyle topluca kapatılmadı; ayrı koşul değerlendirmesi ve patch uygulandı. TipTap browser chunk'ında bulunduğundan feature bayrağı kapalı diye advisory dışlanmadı.

`npm audit fix --force` veya otomatik major audit fix yapılmadı. Root package.json ayrı eski dependency ağacını içerir; root npm ci production kurulum komutu değildir. Backend/frontend audit sonuçları root manifest için iddia oluşturmaz. Release root kaynak bağlamını kullanmalı, fakat yalnız `npm ci --prefix frontend` / `npm ci --prefix backend --omit=dev` kurmalıdır. Gerçek builder bu komutları uygulamıyorsa production blocker'dır.

Temiz `npm ls --all --omit=dev` iki tarafta exit 0; frontend peer/extraneous sorunları yok. Backend npm çıktısında Sharp'ın platform optional WASM ağacından kalan **2 extraneous** kaydı vardır (`@img/sharp-wasm32`, içindeki `@emnapi/runtime`); eksik/invalid runtime peer yok. Sharp Windows native binding ve gerçek görüntü upload/MIME testleri çalıştı. Bunlar audit bulgusu değildir; Linux native binding staging smoke testine dahildir. Dev dependency audit bu omit=dev gate'inin kapsamında değildir.

## Shared release bütünlüğü

`shared/features.js` ortak kapalı launch bayraklarını taşır; `shared/drawingProtocol.js` ortak snapshot doğrulaması ve boyut limitlerini taşır. Ayrı servis değildir. Frontend'de **8**, backend runtime kaynaklarında **7** import deklarasyonu aynı iki canonical dosyaya çözülür. `git check-ignore -v` repo/global kurallarında eşleşme vermedi; git ls-files/history shared için boş. Git tarafından takip edilmediğinden yazar/eklenme commit'i atfedilemez.

Temiz kopyada backend/frontend/shared birlikte, root node_modules ve .env olmadan kurulup build edildi. Shared dosyalarının SHA-256 değerleri iki kopyada aynı; son package/lockfile'lar ve backend/frontend/shared JS/JSX/JSON/CSS kaynakları temiz kopyayla byte olarak karşılaştırıldı, fark yok. Bu current working-tree snapshot doğrulamasıdır, henüz commit deployment doğrulaması değildir.

[RELEASE_SOURCE.md](./RELEASE_SOURCE.md) repo kökünden ayrı paket kurulum komutlarını ve Vercel/Railway source bağlamını açıklar. Vercel Root frontend ise dış kaynakları dahil etme ayarı gerekir; Railway Root backend sibling shared erişimini kesebilir. En sade çözüm root repo bağlamını koruyup paket-specific komutlar çalıştırmak ve iki hizmeti **aynı release SHA** değerinden hazırlamaktır. Vercel SPA rewrites korunmalıdır. Panellere girilmedi; mevcut Root Directory değerleri doğrulanmadı.

`node scripts/check-shared-release.mjs` yerel/temiz import ve hash kanıtını üretir. Sonradan release commit hazır olduğunda `--committed` iki dosyanın tracked, ignored olmayan ve HEAD ile değişmemiş source olmasını zorunlu tutar. Bu turda commit/stage/push yapılmadığı için bu release ön koşulu henüz sağlanmaz.

## Release hardening ve test kök nedenleri

`/api/health` liveness olarak korunur. `/api/ready` DB readyState ve bounded ping kontrolü yapar; disconnected/connecting/draining/timeout durumunda 503 ve `{ready:false}` döner. Başarılı durumda 200; no-store, DB hata ayrıntıları yok.

SIGTERM/SIGINT mevcut HTTP server'ı yeni bağlantılara kapatır, Spotlight interval'ini durdurur ve aktif tick/request'leri bekler; sonra MongoDB kapanır. Toplam 10 saniye deadline sonunda bağlantılar zorla kapanır ve exit 1; başarılı drain exit 0. İdempotent shutdown, bekleme sırası, timeout ve DB failure testleri var. Gerçek Railway sinyali/termination grace süresi staging'de kontrol edilmelidir.

Production başlangıcı boş/zayıf/placeholder JWT_SECRET, eksik Mongo/admin/Google/Cloudinary/Resend/email ayarları, güvenilmeyen originler, explicit public HTTPS API/callback URL yokluğu ve geçersiz port için fail-closed olur. Değerler hataya basılmaz. API/callback localhost/platform fallback'e dayanılmaz. Bu doğrulama gerçek hosting değerlerinin ayarlanmış olduğunun kanıtı değildir.

Temiz testler ayrıca yerel .env bağımlılığını ortaya çıkardı: developmentPreferences testi dolaylı emailService import'unda gerçek Resend key bekliyordu. İlgisiz mail servisi testte mock edildi; production mail davranışı değiştirilmedi. İlk kitap snapshot transaction'ı arka plandaki Work index kurulumu sırasında MongoDB'nin 5ms IX-lock bekleme sınırına çarpıyordu. Model init'leri listen öncesi ve ilgili test başlangıcında beklenir; 404 ownership assertion'ı ve snapshot transaction kaldırılmadı. Atelier sıralama fixture'ı her map öğesi için ayrı Date.now aldığı için milisaniye geçişinde skor sırasını değiştiriyordu; eşit skor fixture'ı tek timestamp kullanır, aynı assertion korunur. Reset OTP testi de gerçek altı haneli OTP kuralına uygun fixture kullanır.

Önceki üç problem dosyası son turda geçti: guestRendering **10/10**, tourLayout **7/7**, feedbackAndQueues **4/4**. Birth-year/profile koşulları ve moderator-read/admin-decision modeli korunur; assertion gevşetme veya test silme yok. Yeni legacy-rejection davranışı için eski auth fixture tokenları gerçek session modeline geçirildi; signature/account/fingerprint/expiry/revocation kontrolleri mock edilerek bypass edilmedi, yalnız izole storage kullanıldı.

## Son doğrulama kanıtları

- `backend npm run test:all`: 64 dosya, **679 passed / 0 failed / 0 skipped**. [Çalışma ağacı JSON](./review-evidence/release-tests.json).
- Temiz backend `npm run test:all`: aynı **679 / 0 / 0**, 64 dosya. Bunun içindeki kritik auth/session seti 8 dosyada **117/117**. [Temiz JSON](./review-evidence/release-clean-tests.json).
- İlgili frontend/session/çizim/navigation testleri: 11 dosya, **75 / 0 / 0**. [JSON](./review-evidence/release-frontend-tests.json).
- Frontend lint çalışma ağacında ve temiz kopyada: **0 error / 0 warning**; eslint-disable eklenmedi.
- Frontend production build çalışma ağacında ve temiz kopyada başarılı; temiz npm run build ve aynı Vite config üzerinden module evidence build çalıştı. Büyük çizim chunk uyarısı yaklaşık **1.65 MB / 503.6 KB gzip**, güvenlik blocker'ı değil.
- Temiz npm ci: backend **381**, frontend **511** paket; iki işlem exit 0. Mongo-memory-server'ın gereksiz otomatik postinstall binary indirmesi kapatıldı; normal install script'leri çalıştı. Testler workspace'teki aynı izole MongoDB 7.0.14 binary'sini kullandı; skip test veya production DB fallback yok.
- Son production audit: backend/frontend bütün severity sayıları **0**; temiz kopyadaki manifest ve lockfile'lar current working tree ile aynı. [Backend](./review-evidence/backend-audit-clean-release.json), [frontend](./review-evidence/frontend-audit-clean-release.json).
- [Browser emitted module kanıtı](./review-evidence/browser-bundle-release.json), [shared yerel çözümleme](./review-evidence/shared-release-resolution.json), [shared temiz çözümleme](./review-evidence/shared-clean-resolution.json).

Temiz kopya ilk çalıştırmada Windows sandbox üst dizin erişimi nedeniyle esbuild config okuma hatası verdi; aynı kaynak ağacı için izinli, yerel test/build yeniden çalıştırıldı ve geçti. Bu uygulama import/build sorunu veya production erişimi değildi. Nihai test/build sayıları yalnız başarılı son kaynak doğrulamalarını ifade eder.

## Kalan blocker'lar ve staging

**Gerçek release blocker:** mevcut HEAD shared dosyalarını ve bu turdaki yeni/düzeltilmiş release kaynaklarını içermez. Kullanıcının sonraki release hazırlığında bunlar tek gözden geçirilmiş commit'e dahil edilmeli; iki hizmet aynı SHA'yı kullanmalı. Repo kökü kaynağı ve paket-specific install komutları gerçek builder'da doğrulanmalı.

**Staging doğrulaması:** aynı-site HTTPS custom domainlerde web cookie/login/remember/Google/logout/parola reset, sekmeler/browsers; Origin/CORS/CSRF; explicit OAuth callback ve e-posta URL'leri; gerçek proxy IP zinciri ve rate-limit spoof kontrolü (trust proxy değiştirilmedi); çoklu instance limit davranışı; Linux Sharp + gerçek Cloudinary upload/destroy; readiness DB kesintisi, gerçek SIGTERM/drain ve platform termination süresi; mevcut startup hazırlıkları/indexlerin staging DB'de güvenli tamamlanması ve rollback provası. Hosting/DB işlemleri bu turda yapılmadı.

**Karar: Kod kapıları GO; production NO-GO, yukarıdaki release source ve staging ön koşulları tamamlanana kadar.**
