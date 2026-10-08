# Web API ve Google OAuth origin geçişi

Frontend Vercel Root Directory: `frontend/`. Config: `frontend/vercel.json`.
Production web API tabanı `/api`; bütün frontend API tüketicileri `src/lib/apiBase.js` kullanır.
Production build, eski absolute `VITE_API_BASE` / `VITE_API_URL` değerleri olsa da `/api` seçer.
Development bu değişkenleri ve `http://localhost:5000/api` fallback'ini kullanmaya devam eder;
Vite'ın mevcut `/api` → localhost:5000 proxy'si de korunur.

API rewrite SPA fallback'inden önce çalışır:
`/api/:path*` → `https://acb-atolyesi-production.up.railway.app/api/:path*`.
API yollarında browser/CDN cache `no-store` ve Vercel rewrite caching `0` olarak ayarlanmıştır.
API 401/404/500 yanıtları SPA index.html yanıtına çevrilmemelidir.

## Kullanıcının uygulayacağı production ayarları

| Platform | Değişken / ayar | Hedef |
| --- | --- | --- |
| Vercel Production | `VITE_API_BASE` | `/api` |
| Vercel Production | `VITE_API_URL` | `/api` |
| Railway | `API_URL` | `https://xn--acbatlyesi-icb.com/api` |
| Railway | `GOOGLE_CALLBACK_URL` | `https://xn--acbatlyesi-icb.com/api/auth/google/callback` |
| Railway | `CLIENT_URL` | `https://xn--acbatlyesi-icb.com` |
| Railway | `SITE_URL` | `https://xn--acbatlyesi-icb.com` |
| Railway | `GOOGLE_CALLBACK_BASE_URL` | Varsa eski override'ı kaldırın veya yeni API_URL ile eşitleyin |
| Google Cloud OAuth web client | Authorized redirect URI | `https://xn--acbatlyesi-icb.com/api/auth/google/callback` |
| Google Cloud OAuth web client | Authorized JavaScript origin | `https://xn--acbatlyesi-icb.com` |

Domainlerin Unicode görünümü `acbatölyesi.com`dur; URL yapılandırmasında canonical punycode kullanılır.
Google client ID/secret, JWT_SECRET ve native OAuth client ayarları değiştirilmez.
Railway upstream adresi rewrite destination olarak kalır; destination frontend `/api` adresine
çevrilirse proxy döngüsü oluşur. Cookie Domain eklenmez, SameSite=None kullanılmaz ve CORS allowlist
preview/üçüncü taraf originlere açılmaz.

`token` ve `oauth_state` cookie'leri mevcut HttpOnly + Secure + SameSite=Lax, Path=/ ve host-only
modelini korur. Browser Google başlangıcını frontend `/api/auth/google` üzerinde yapar;
Google aynı frontend originindeki callback'e döner. Böylece OAuth state ve login cookie'lerinin
browser host'u frontend olur. Native/mobile Bearer ve Google ID-token endpointleri değişmez.

## Sonraki onaylı dağıtımın sırası

1. Google Console'a yeni redirect URI'yi ekleyin; geçiş tamamlanana kadar eski URI'yi tutun.
2. Vercel Production değişkenlerini hazırlayın. Ayrı main/dağıtım onayından sonra onaylı Git SHA'yı
   Vercel'e dağıtın; önce `/api/ready`, `/api/health` ve bir API 401/404 yanıtının JSON olduğunu doğrulayın.
3. Railway API_URL/GOOGLE_CALLBACK_URL ve frontend origin değişkenlerini uygulayıp backend'i
   onaylı SHA ile yeniden başlatın/dağıtın. Yeni callback, Vercel proxy aktif olmadan uygulanmamalıdır.
   Google login'i iki adım da tamamlandıktan sonra sınayın; aradaki geçişte eski callback origin'i
   frontend üzerinde oluşturulan OAuth state cookie'sini alamaz.
4. Production frontend domaininde temiz browser session ile login → /auth/me, remember me,
   logout, Google başlangıç/callback ve profil tamamlama smoke testlerini çalıştırın.
   Browser API Request URL `/api/...`, cookie host frontend, SameSite=Lax ve Secure/HttpOnly olmalı.
   Set-Cookie'de Railway Domain olmamalı; API yanıtı cache'e girmemeli. Native Bearer akışını ayrıca sınayın.
5. Geçiş ve rollback penceresi tamamlandıktan sonra artık kullanılmayan eski web redirect URI'yi kaldırın.

Bu doküman deployment talimatıdır; kod hazırlığı veya release branch push'u hosting paneli,
Google Console, main, production DB veya manuel deploy değişikliği içermez. Canlı proxy header/cookie
aktarımı ve callback doğrulaması gerçek deployment sonrası yapılmalıdır. Vercel preview domaini,
production callback origininin yerine OAuth smoke testi için kullanılamaz.
