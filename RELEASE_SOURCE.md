# Frontend + backend release kaynağı

Bu doküman panel değişikliği yapmaz. İki servis tek monorepo'nun **aynı release commit SHA** değerinden hazırlanmalıdır. Root package.json eski, ayrı bir dependency ağacı içerir; root'ta `npm ci` çalıştırmayın. Production paketleri yalnız frontend/package-lock.json ve backend/package-lock.json üzerinden kurulmalıdır.

`shared/` ayrı servis değildir. `features.js` ortak açılış bayraklarını, `drawingProtocol.js` snapshot doğrulamasını ve 9 MiB içerik / 10 MiB parser limitlerini tanımlar. Frontend bundle üretirken; backend doğrudan runtime'da bu dosyaları kullanır. Bu dosyaları ayrı ayrı kopyalayarak farklı sürümler oluşturmayın.

Yerel doğrulama: `node scripts/check-shared-release.mjs`. Release commit hazırlandıktan sonra: `node scripts/check-shared-release.mjs --committed`. İkinci komut iki dosyanın Git'te bulunduğunu, ignore dışında olduğunu ve HEAD ile aynı olduğunu zorunlu tutar. İki shared dosyası, gözden geçirilmiş frontend/backend kaynakları ve deployment config'leri tek release commit'e dahil edilmelidir. Commit oluşturmak deploy veya push onayı değildir; iki servis aynı onaylı SHA'dan hazırlanmalıdır.

En sade dağıtım bağlamı:

| Servis | Kaynak bağlamı | Kurulum | Build / start | Çıktı |
| --- | --- | --- | --- | --- |
| Vercel | Repo kökü | `npm ci --prefix frontend` | `npm run build --prefix frontend` | `frontend/dist` |
| Railway | Repo kökü, backend + shared birlikte | `npm ci --prefix backend --omit=dev` | `node backend/server.js` | Node runtime |

Vercel'de Root Directory frontend seçilecekse **Include source files outside of the Root Directory** açık olmalıdır; build kaynak ağacında sibling shared dizini bulunmalıdır. Repo kökü kullanılırsa frontend/vercel.json içindeki SPA rewrites ayarı kök proje config'inde korunmalıdır; frontend/vercel.json kök projenin config'i olarak otomatik okunmaz. Railway için Root Directory `/`, Config File `/railway.json` ve repo kökündeki `railpack.json` kullanılır. Bu config yalnız backend production lockfile kurulumu yapar; root dependency kurulumu/start otomatiğine güvenmez. Ayrıntılı Variables, watch paths ve lifecycle sözleşmesi: [RAILWAY_RELEASE_PREPARATION.md](./RAILWAY_RELEASE_PREPARATION.md). Gerçek panel bu turda doğrulanmadı/değiştirilmedi.

Her iki servis için kaynak filtresi/watch paths: kendi dizini **ve shared/**. Aynı SHA ile build yapılmalı; shared değiştiğinde iki servis de yeni aynı kaynaktan hazırlanmalı. Sadece frontend veya sadece backend klasörünü ZIP/image context yapmak runtime/build import'larını kırar. Temiz doğrulama kopyasında root node_modules ve .env olmadan frontend/backend/shared birlikte kullanılır.

Node 22 LTS veya mevcut API'leri destekleyen daha yeni LTS ile doğrulayın. Backend `/api/health` liveness, `/api/ready` DB erişimi ve draining durumunu kontrol eden readiness endpoint'idir. SIGTERM/SIGINT HTTP ve Spotlight işini boşaltır, sonra MongoDB bağlantısını kapatır; 10 saniye içinde bitmezse başarısız çıkış yapar. Gerçek hosting sinyali/probe davranışı staging'de sınanmalıdır.

Production startup için JWT_SECRET (en az 32 byte, rastgele ve secret manager'da), MONGO_URI, ADMIN_SECRET_PATH, CLIENT_URL/SITE_URL HTTPS originleri, API_URL ve GOOGLE_CALLBACK_URL HTTPS URL'leri, Google/Cloudinary/Resend kimlik bilgileri ve EMAIL_FROM gerekir. Değerleri repo'ya koymayın. API_URL / Google callback explicit olmalı; platforma veya localhost'a fallback kullanılmamalıdır. `trust proxy=1` değiştirilmedi; staging'de gerçek proxy zinciri/IP doğrulanmalıdır. Frontend ve API aynı site altında HTTPS kullanmalı (ör. app ve api alt domainleri); varsayılan vercel.app ile railway.app arasındaki cross-site cookie davranışı mevcut SameSite=Lax modeline uymaz.
