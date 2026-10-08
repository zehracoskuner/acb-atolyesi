# Railway release hazırlığı — 2026-10-05

Bu rapor Railway hazırlık turunun bulgularını ve doğrulamalarını kaydeder. O turda panel, deploy, push, commit/tag, DNS ve production DB işlemi yapılmadı. Sonraki release commit hazırlığı ayrı kullanıcı onayıyla yürütülür; commit onayı deploy/push onayı değildir. Önceki uygulama düzeltmeleri korundu; yeni bir güvenlik taraması yapılmadı. Secret değerleri ve .env içerikleri okunmadı/raporlanmadı. Variables karşılaştırması kullanıcının verdiği **isim listesi** ile yapıldı; canlı panel doğrulanmadı.

## A. Kullanıcının elle değiştireceği Railway ayarları

Deploy tetiklemeden önce otomatik deploy davranışını kontrol edin; ayar değişiklikleri bir sonraki deploya hazırlık olarak uygulanmalıdır.

| Ayar | Kesin hedef |
| --- | --- |
| Root Directory | `/` (repo kökü; `/backend` kaldırılmalı) |
| Railway Config File | `/railway.json` |
| Builder | `RAILPACK`; config sürümü `0.40.1` |
| Eski Build Command override | Temizleyin; build `railpack.json` tarafından tanımlanıyor |
| Start Command | `node backend/server.js`; eski `node server.js` kaldırılmalı |
| Healthcheck | `/api/ready`, timeout 300 saniye |
| Draining | 20 saniye |
| Node environment | Variables içinde açıkça `NODE_ENV=production` |

Varsa çelişen `RAILPACK_INSTALL_CMD`, `RAILPACK_BUILD_CMD`, `RAILPACK_START_CMD`, `RAILPACK_CONFIG_FILE`, `RAILPACK_NODE_VERSION`, `RAILPACK_NODE_NPM_INSTALL`, `RAILPACK_NODE_PRUNE_CMD`, `RAILWAY_HEALTHCHECK_TIMEOUT_SEC`, `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` override'larını inceleyin; bu repo config'iyle çelişen eski değerleri kaldırın. Secret değerlerini dışarı aktarmayın. Eski Nixpacks/Docker build ayarlarına güvenmeyin.

Railway Root Directory ayarı sadece çalışma dizini değildir: izole monorepo modunda sibling kaynaklar deployment kaynağından çıkarılır. Dolayısıyla `/backend` ile `../shared` erişimi uygun değildir. Root Directory `railway.json` schema'sında tanımlanabilen bir alan değil; kullanıcı panelde değiştirmelidir. [Railway monorepo belgesi](https://docs.railway.com/deployments/monorepo), [build ayarları](https://docs.railway.com/builds/build-configuration).

## B. Repo değişiklikleri

- `railway.json`: builder/sürüm, start, readiness, timeout, draining ve watch patterns.
- `railpack.json`: Node `22.23.2`, yalnız backend production lockfile kurulumu, kaynak filtreleri, açık runtime start.
- `scripts/check-backend-release.mjs`: server/.env başlatmadan 22 production dependency'nin **backend/node_modules** içinde çözülmesini, relative importları, iki shared modülünü ve Sharp runtime yüklenmesini kontrol eder.
- `.gitignore`: `review-evidence/` ve yerel birleşik kaynak dökümü `tumkodlarrr.txt` dışarıda tutulur.
- `RELEASE_SOURCE.md`: yeni config ve shared index durumuna göre güncellendi.
- İki shared dosyası Git indexine eklendi; içerik değişikliği yapılmadı. Diğer mevcut dosyalar topluca stage edilmedi.

Config, kontrol scriptleri ve bu doküman sonraki onaylı release commit'e dahil edilmelidir. Mevcut backend/frontend kaynak düzeltmeleri, ilgili package.json/lockfile'lar ve kalıcı regresyon testleri de o commit'e girmelidir. `.env`, `.review-cache/`, `review-evidence/`, node_modules, dist, geçici sonuç dosyaları ve yerel araç/not dosyalarını eklemeyin. `.claude/settings.json` zaten tracked ve yerel değişiklik içeriyor; bu release'in yeni diff'ine eklemeyin. Ignore kuralı zaten tracked dosyayı Git geçmişinden çıkarmaz.

## C. Railway Variables sözleşmesi

### REQUIRED PRODUCTION

| İsim | Kod sözleşmesi |
| --- | --- |
| `NODE_ENV` | Tam olarak `production`; panelde açıkça tanımlanmalı |
| `JWT_SECRET` | Bağımsız, rastgele, en az 32 byte; placeholder olmamalı |
| `MONGO_URI` | Mongo URI; uygulamanın transaction gereksinimi için replica set/Atlas |
| `ADMIN_SECRET_PATH` | Tek route segmenti |
| `CLIENT_URL`, `SITE_URL` | Allowlist için en az biri gerekir; ikisini doğru frontend HTTPS originine açıkça ayarlayın. Path/query/credentials yok |
| `API_URL` | Public HTTPS API tabanı, `/api` dahil. Kullanıcının eski listesinde yok; **API_BASE_URL yerine gereken isim bu** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Mevcut OAuth client; callback kaydı ile eşleşmeli |
| `GOOGLE_CALLBACK_URL` | Public HTTPS URL; `/api/auth/google/callback` dahil |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Üçü de production startup validation tarafından zorunlu |
| `RESEND_API_KEY`, `EMAIL_FROM` | Mail sağlayıcısı ve doğrulanmış gönderici |
| `PORT` | Railway tarafından sağlanan port kullanılmalı. Genellikle elle tanımlama gerekmez; kod fallback'i 5000. Sağlanırsa 1–65535 doğrulanır |

`validateStartupEnvironment` production'da yukarıdaki gereklilikleri kontrol eder; origin için CLIENT_URL/SITE_URL'den en az biri yeterlidir. Deployment sözleşmesi ikisini de açıkça tanımlar. Sadece değişken adının varlığı, sağlayıcı erişiminin veya gerçek değerlerin doğruluğunun kanıtı değildir.

### OPTIONAL / özelliğe bağlı

| İsim | Kullanım / gerekli olduğu koşul |
| --- | --- |
| `EMAIL_REPLY_TO` | Resend reply-to |
| `GEMINI_API_KEY` | `routes/ai.js` ve Gemini development provider; bu akışlar kullanılacaksa geçerli key gerekir |
| `GEMINI_MODEL` | AI routes / Gemini provider modeli; model seçimini değiştirmeden mevcut uyumluluğu doğrulayın |
| `GEMINI_MIN_INTERVAL_MS` | Aktif AI route çağrı aralığı |
| `DEVELOPMENT_COACH_ENABLED` | Yalnız tam `true` etkin kabul edilir; mevcut shared launch bayrağı false. Release'te false tutun |
| `DEVELOPMENT_COACH_PROVIDER` | openai/gemini; varsayılan openai |
| `DEVELOPMENT_COACH_MODEL` | Development coach modeli; mevcut provider sözleşmesini değiştirmeyin |
| `DEVELOPMENT_ANALYSIS_DAILY_LIMIT` | Pozitif integer; varsayılan 2 |
| `DEVELOPMENT_ANALYSIS_TIMEOUT_MS` | Config'te 1000–180000 ms; varsayılan 90000 |
| `OPENAI_API_KEY` | OpenAI development coach gerçekten etkinse gerekir; sırf startup için zorunlu değil |
| `ANDROID_APP_ID`, `ANDROID_SHA256` | Android app-link ayarları; web auth secretları değildir |
| `RAILWAY_PUBLIC_DOMAIN` | Railway tarafından sağlanır; dev/legacy API/OAuth fallback. Production explicit API_URL/callback varken kullanılmaz |
| `GOOGLE_CALLBACK_BASE_URL` | OAuth fallback tabanı; production explicit GOOGLE_CALLBACK_URL varken etkisiz |
| `CLOUDINARY_URL` | Uygulama doğrudan okumaz, ancak Cloudinary SDK otomatik okur (`lib/config.js`). Tamamen kullanılmıyor denemez. Ayrı üç credential zorunlu olduğundan gereksiz duplicate ise kaldırın; çelişkili veya geçersiz URL bırakmayın |

### LEGACY / mevcut aktif runtime'da etkisiz

| İsim | Kanıt / aksiyon |
| --- | --- |
| `API_BASE_URL` | Backend hiçbir `process.env.API_BASE_URL` okumuyor; emailService'deki aynı isim **yerel const**, `API_URL` üzerinden hesaplanır. API_URL tanımlandıktan sonra eski değişken kaldırılabilir |
| `SUPPORT_EMAIL` | Backend runtime source'ta env tüketicisi yok |
| `GEMINI_MODERATION_KEY` | Sadece artık hiçbir runtime modülünün import etmediği `utils/aiModerator.js` içinde geçiyor. Aktif release için gerekli değil |
| `ADMIN_EMAIL` | admin.js'de kullanılmayan const; email gönderen tüketici yalnız import edilmeyen aiModerator helper'ında. Güncel staff bildirimleri DB rolleri üzerinden çalışır |
| `EMAIL_USER` | Yukarıdaki kullanılmayan ADMIN_EMAIL fallback'i; Resend SMTP kullanıcı adı kullanmaz |
| `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT`, SMTP/Nodemailer'a ait eski isimler | Runtime source'ta tüketici yok; Nodemailer paketi kaldırılmıştı. Kullanıcının listesinde yok, panelde varsa eski akış olarak gözden geçirin |

Bu sınıflandırma source tüketimine dayanır; servisler arası başka tüketici varsa değişkeni o serviste ayrıca inceleyin. Koddan veya panelden secret değerleri okunmadı.

### NODE_ENV etkisi

| Davranış | production | Gerçekten undefined / başka değer |
| --- | --- | --- |
| Session/OAuth cookie Secure | true | false |
| HttpOnly, SameSite=Lax, path=/ | Aynı | Aynı |
| Production startup doğrulaması | Tam zorunlu validation | getJwtSecret ve origin parse sonrası erken return; 32-byte/credential/HTTPS/PORT kontrolleri atlanır |
| CORS/cookie/upload allowlist | Configured HTTPS originler; localhost eklenmez | localhost:5173 eklenir; prod HTTPS kısıtları uygulanmaz |
| Global error response | Genel mesaj | err.message döner; bu handler hiçbir ortamda stack'i response'a eklemez |
| OAuth/mail fallback | Prod site fallback | localhost fallback |
| sid gerekliliği, DB session iptali, session süresi | Aynı | Aynı |

JWT_SECRET tamamen eksikse bütün ortamlarda startup hata verir. NODE_ENV eksikliği tek başına güvenli startup hatası üretmez; production'a özgü korumaları atlar. Bu davranış bu turda değiştirilmedi ve kod içine NODE_ENV hard-code edilmedi.

Railpack Node provider varsayılan runtime env'inde NODE_ENV=production sağlar; **Variables'da görünmüyor olması ile process'te gerçekten undefined olması aynı değildir**. Üretilen plan production değerini içeriyor. Yine de açık Railway Variable gereklidir; yanlış kullanıcı override'ı/dev değeri production korumalarını kapatır. [Railpack Node belgesi](https://railpack.com/languages/node/).

## D. Root Directory

`/`. Frontend/backend/shared aynı onaylı Git SHA'dan hazırlanmalı. `shared/` ayrı servis veya ayrı dependency install hedefi değildir.

## E. Install ve build

`railpack.json` install: **`npm ci --prefix backend --omit=dev`**.

Install komutlarından önce iki açık CopyCommand, backend/package.json ve backend/package-lock.json dosyalarını sırasıyla `/app/backend/package.json` ve `/app/backend/package-lock.json` hedeflerine kopyalar. Railpack 0.40.1 `local.include` içindeki tekil dosyaların yalnız basename'ini koruduğu için bu dosyalar local layer filtresiyle kopyalanmaz. Build kontrol scripti de açık CopyCommand ile `/app/scripts/check-backend-release.mjs` hedefine yerleştirilir. Backend ve shared dizinlerinin local layer girdileri kendi dizin adlarını korur. Root dependency ağacı ve frontend bağımlılıkları kurulmaz. Root npm start/build otomatik tespitine güvenilmez. Root package.json yalnız shared ESM package scope'u ve builder Node tespiti için tutulur; root lockfile sadece package-manager tespitini etkileyebilir, dependency kurulumu için kullanılmaz.

Railpack Node provider install için varsayılan `NPM_CONFIG_PRODUCTION=false` verir. npm 10.9.8 ile doğrudan doğrulamada bu değer `--omit=dev` verilse bile include=dev oluşturuyor. Config bu nedenle **sadece install step'te NPM_CONFIG_PRODUCTION=true** tanımlar; aksi halde yalnız production dependency kurulumu garantisi yanlış olurdu. Build/runtime NODE_ENV uygulama kodunda hard-code edilmedi.

Build: **`node scripts/check-backend-release.mjs`**; backend derleme gerektirmiyor. Üretilen plan bunu açıkça gösteriyor. Boş root node_modules dizini sadece provider'ın runtime layer beklentisini karşılar; içine root paketleri kurulmaz. Prune step boş bırakılır; eski PRUNE override'ı root'ta npm prune/install çalıştıramaz.

Build local layer'ında backend, shared, root package.json ve kontrol scripti vardır; frontend, tool ayarları, review evidence, local env ve kalıcı test dosyaları runtime image'a girmez. Dependency install layer'ının runtime çıktısı backend/node_modules ile sınırlıdır. Build kontrolüne secret verilmesi gerekmez. Config bir overlay'dir; Railway'nin varsayılan runtime/Mise katmanları korunur. Dockerfile eklenmedi. [Railpack config modeli](https://railpack.com/config/file/).

## F. Start

`node backend/server.js`. Railway ve Railpack config'leri aynı değeri kullanır. Root'taki eski `npm start` / `node server.js` kullanılmaz. Sinyalin gerçek Node process'e ulaştığı staging'de test edilmelidir.

## G. Health / readiness

Railway path: **`/api/ready`**, timeout **300 s**. Mongo connected + ping başarılı ise 200 `{ready:true}`; DB kopuk, ping timeout veya draining durumunda 503 `{ready:false}`. Cache-Control no-store; endpoint auth gerektirmez ve secret/DB hatası döndürmez. DB connection/index/preparation bitmeden HTTP server dinlemeye başlamaz. PORT Railway'nin verdiği değerle kullanılır.

`/api/health` liveness'tır; DB hazır olmasa da çalışan process için 200 olabilir. Railway deployment healthcheck sürekli DB monitörü değildir; deploy sonrasındaki readiness kesintileri ayrı izlenmelidir. [Healthcheck belgesi](https://docs.railway.com/deployments/healthchecks), [deployment sonrası monitoring ayrımı](https://docs.railway.com/guides/roll-back-bad-deploy).

## H. Draining / sleep

Config **20 s**, kod deadline'ı **10 s**. SIGTERM/SIGINT: yeni worker tick'i durdurulur, HTTP ve mevcut Spotlight işi drain edilir, Mongo disconnect, başarılı exit 0. Deadline aşılırsa bağlantılar kapanır ve exit 1. 20 s platform buffer'ı uygulamaya 10 s deadline ve kapanış payı bırakır. `drainingSeconds` resmi schema'da geçerlidir; variable ile alternatif `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` varsa çelişki bırakmayın. [Railway lifecycle değişkenleri](https://docs.railway.com/variables/reference).

AuthSession hash/expiry/user/password fingerprint Mongo'dadır; Express process-local session store yoktur. JWT_SECRET ve aynı DB korunduğunda backend restart sonrası henüz geçerli cookie/native credential devam eder. OAuth state imzalı cookie'dedir; aynı JWT_SECRET ve 10 dakika geçerlilik içinde process restart'a bağlı kaybolmaz. Mongo bağlantısı ve Spotlight worker her startup'ta yeniden kurulur. DB koparsa readiness 503; yeniden bağlantı/ping başarılıysa tekrar 200.

Process-local rate limit sayaçları ve AI çağrı kuyruğu/cooldownları vardır: restart ile sayaçlar sıfırlanır, devam eden işler deadline yüzünden başarısız olabilir. Bunlar login kalıcılığının kaynağı değildir; request dayanıklılığı ayrıca staging'de sınanmalıdır. Upload limitleri Mongo store kullanır. Spotlight state/history DB'dedir; worker timer yeniden başlar. Her 10 saniyede DB tick'i ve Mongo bağlantısı outbound trafik yaratabilir; Serverless'ın gerçekten uyuyacağı garanti değildir. Bu turda Serverless ayarı değiştirilmedi. İlk wake isteğinin cold boot/502 ihtimali ayrı staging testi gerektirir. [Railway Serverless belgesi](https://docs.railway.com/deployments/serverless).

## I. Watch paths

Config'te bire bir:

```text
/backend/**
/shared/**
/railway.json
/railpack.json
/package.json
/package-lock.json
/scripts/check-backend-release.mjs
```

Backend lockfile ilk pattern tarafından kapsanır. Root lockfile kurulmaz ama builder tespiti etkileyebildiği için izlenir. Frontend-only değişiklik backend deploy tetiklemez; bir release birlikte dağıtılacaksa iki servis seçilen aynı SHA'ya sabitlenmelidir. Shared değişikliği frontend tarafında da deployment tetiklemelidir. Patterns root-relative gitignore biçimindedir. [Watch paths belgesi](https://docs.railway.com/builds/build-configuration).

## J. Shared Git durumu

Hazırlık turu sonunda `shared/features.js` ve `shared/drawingProtocol.js`: **A / staged additions**, Git indexinde tracked; o turun HEAD'inde henüz yoktu. Repo ve global ignore kontrolünde ikisi için ignore eşleşmesi yok. İçerikleri değişmedi; index ile çalışma dosyaları eşleşiyor. Frontend 8 ve backend 7 import declaration aynı iki canonical dosyaya çözülüyor.

`node scripts/check-shared-release.mjs` yerel ve temiz kopyada geçer. `--committed` bilinçli olarak HEAD ile eşitliği ister ve onaylı release commit sonrasında yeniden çalıştırılmalıdır. Hazırlık turundaki başarısız committed kontrolü bir import/ignore hatası değil, o turda commit yapılmamasının sonucuydu. Git'e tracked/index durumunu doğrulamak için commit gerekmedi.

## K. Sonuç ve kalan geçiş koşulları

### Son doğrulama

Node **22.23.2**, beraberindeki npm **10.9.8** ile .env/root node_modules içermeyen temiz kopyada:

| Gate | Sonuç |
| --- | --- |
| Backend `npm run test:all` | 64 dosya, **679/679 geçti**, 0 failed, 0 skipped |
| İlgili frontend/session/drawing/navigation testleri | 11 dosya, **75/75 geçti**, 0 failed, 0 skipped |
| Frontend lint | Exit 0; **0 error / 0 warning** |
| Frontend production build | Exit 0; büyük chunk uyarısı devam ediyor |
| Temiz backend `npm ci` | **327 paket**, exit 0 |
| Temiz frontend `npm ci` | **444 paket**, exit 0 |
| Backend-only production `npm ci --prefix backend --omit=dev` | Gerçek install-step env ile **212 paket**, exit 0; root/frontend dependency yok |
| Backend runtime source check | **22 production dependency, 392 relative import, 2 shared modül**, Sharp import başarılı |
| `check-shared-release` | Yerel ve temiz kopyada geçti; frontend **8**, backend **7** declaration; hashler aynı |
| Kaynak bütünlüğü | Temiz kopya ile **407 JS/JSX/CSS/JSON/MJS dosyası byte-equal** |
| Git shared | İki staged dosyanın blob'u çalışma içeriğiyle eşit; repo/global ignore eşleşmesi yok |
| Resmi JSON schema | `railway.json` ve `railpack.json` geçti; indirilen resmi draft-2020-12 schema'ları Ajv ile doğrulandı |
| Gerçek Railpack plan | CLI **0.40.1**, success=true, Node **22.23.2**, backend-only install, NPM_CONFIG_PRODUCTION=true, doğru start ve kaynak filtreleri |

Test yardımcısı MongoMemoryServer'ın postinstall'da gereksiz ikinci binary indirmesi temiz dev kurulumunda kapatıldı (`MONGOMS_DISABLE_POSTINSTALL=1`); testler mevcut MongoDB **7.0.14** binary'sini izole loopback replica setinde kullandı. Sharp ve diğer production install scripts kapatılmadı. İlk Node 22.17.1/npm 11.4.2 kontrolü de 679/75 geçti; farklı npm optional paket davranışı nedeniyle sayıları 381/511/236 idi. Tablodaki sayılar **son sabitlenen runtime sürümüne** aittir.

Windows Railpack CLI'nin Mise zip extraction hatası resmi geçici Mise binary'siyle aşıldı. CLI exit code tek başına yeterli sayılmadı; info JSON'daki success=true ve gerçek plan incelendi. Linux BuildKit image build yapılmadı. Yerel çıktılar `.review-cache/` içindedir ve release kaynağına girmemelidir.

Repo hazırlığı tamamlandı. **Production deployment kararı: NO; panel/Variables geçişi ve staging doğrulaması bekleniyor.** Shared ve bütün gözden geçirilmiş kaynak/config ayrı kullanıcı onayıyla tek release commit'te bulunmalı; commit sonrası `check-shared-release --committed` geçmelidir. Vercel/Railway aynı SHA'ya sabitlenmeli, kullanıcı A/C ayarlarını uygulamalı ve staging smoke sonucu görülmelidir. Config-as-code'un panelde gerçekten okunduğu ilk staging build/deploy loglarından doğrulanmalıdır; hazırlık turunda Linux container image build veya gerçek hosting deploy yapılmadı.

Staging'de özellikle: secure cookie/remember-me/reopen/restart, revoke/logout/forget/password-change, Google callback/state, shared drawing importları, gerçek proxy/IP ve X-Forwarded-For spoof, ready DB down/reconnect, SIGTERM drain ve Linux Sharp import/upload kontrolü. `trust proxy=1` değişmedi. Uygulama kod gate'leri tekrar güvenlik incelemesine açılmadı.
