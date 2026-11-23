# Güncel yerel kurulum — 9 Ekim 2026

Yamadaki doğrulama düzeltmeleri güncel kaynaklara uyarlandı. Eski yamayı tekrar uygulamayın.
Gmail SMTP desteği eklendi; gönderen hesap acbatolyesi@gmail.com.

Yerel backend/.env dosyasında EMAIL_PROVIDER=gmail, GMAIL_USER ve EMAIL_REPLY_TO ayarlandı.
GMAIL_APP_PASSWORD alanı henüz boş. Google hesabında iki adımlı doğrulamayı açıp
https://myaccount.google.com/apppasswords üzerinden uygulama şifresi oluşturun.
Şifreyi sadece backend/.env içindeki GMAIL_APP_PASSWORD alanına veya canlı sunucunun gizli ortam değişkenine yazın.
Normal Gmail parolanızı kullanmayın, şifreyi Git'e veya sohbete eklemeyin.

Canlı backend ortamında gereken değerler:

```dotenv
EMAIL_PROVIDER=gmail
GMAIL_USER=acbatolyesi@gmail.com
GMAIL_APP_PASSWORD=<Google uygulama şifresi>
EMAIL_REPLY_TO=acbatolyesi@gmail.com
API_URL=https://<canli-backend-adresi>/api
SITE_URL=https://<canli-site-adresi>
CLIENT_URL=https://<canli-site-adresi>
```

Gmail modunda gönderen GMAIL_USER hesabından alınır; eski EMAIL_FROM ve RESEND_API_KEY kullanılmaz.
EMAIL_PROVIDER=resend seçilirse mevcut Resend desteği ve doğrulanmış EMAIL_FROM kullanılır.
Railway Free/Trial/Hobby SMTP bağlantısını engeller; Gmail SMTP için Pro veya üzeri plan gerekir.
Kaynak: https://docs.railway.com/networking/outbound-networking
Gmail bağlantısı: https://nodemailer.com/guides/using-gmail

Canlı ortam değişkenleri bu çalışma sırasında değiştirilmedi ve canlıya dağıtım yapılmadı.
Uygulama şifresi eklenmeden gerçek Gmail gönderimi test edilemez. Sağlayıcının kabulü teslimat garantisi değildir.

Değişiklikler: kayıt gönderimi beklenir; başarısızlıkta hesap korunur ve 503 döner;
yeniden gönderim başarısızsa önceki token koşullu geri yüklenir; doğrulama yeniden gönderimi
15 dakikada 5 istekle sınırlanır; giriş ve kayıt ekranları gönderim hatasını gösterir.

Doğrulama: e-posta ve üretim ayarlarına ait 43 test geçti; frontend üretim derlemesi başarılı.
Genel test koşusunda diğer 62 test dosyası geçti, 6 dosya atlandı; yeni e-posta testinin
model izolasyonu düzeltilip ilgili 3 dosya yeniden çalıştırıldı.

---

## Aşağıdaki bölüm yüklenen özgün Resend kurulum notudur

# ACB Atölyesi: e-posta doğrulama düzeltmesi

Bu yama, yüklenen `tum_web_kodlari(1).txt` kaynak dökümüne göre hazırlanmıştır. **Yerel `Z:\acbAstra` klasörünüzün mevcut hali incelenemedi.** Yama sürüm farkları varsa uygulanmayabilir; diğer değişikliklerinizi silmeyin.

## Kapsam

- `backend/routes/auth.js`: Kayıtta ve yeniden gönderimde Resend sonucunu `await` eder; gönderim kabul edilmeden başarı döndürmez. İlk kayıt e-postası reddedilirse kullanıcıyı silmez, `503` ve `accountCreated: true` döndürür. Yeniden gönderim başarısız olursa eski token'ı koşullu olarak geri yüklemeye çalışır.
- `backend/services/emailService.js`: API anahtarı ve FROM yoksa açık hata üretir; Resend'den `data.id` gelmedikçe işlemi başarılı saymaz. Üretimde localhost doğrulama linki üretmez. `API_URL` içinde `/api` bekler. Gönderici bilgisi `EMAIL_FROM`, yanıt adresi `EMAIL_REPLY_TO`'dan okunur.
- `frontend/src/pages/Login.jsx`: Yeniden gönderim başarısızsa başarı uyarısını göstermez; hatayı gösterir ve tekrar denemeyi sağlar.
- `frontend/src/pages/Register.jsx`: Hesap oluşturulmuş fakat e-posta gönderimi başarısız olmuşsa kullanıcıya buna özel ekran ve yeniden gönderim seçeneği sunar. "Doğrulamadan giriş yapabilirsin" çelişkisi kaldırılır.
- `backend/middlewares/rateLimiter.js` ve `backend/server.js`: Yeniden gönderim için IP bazlı bağımsız limit: 15 dakikada en fazla 5 deneme.

## Uygulama

1. VS Code içinde **güncel kaynak klasörünün** yedeğini alın ya da `git commit` edin.
2. Yama dosyasını proje köküne (yani `backend` ve `frontend` klasörlerinin bulunduğu dizine) koyun.
3. PowerShell terminalinde:

```powershell
cd Z:\acbAstra
git status
git apply --check .\acb_email_dogrulama.patch
# Üstte hata yoksa:
git apply .\acb_email_dogrulama.patch
```

`git apply --check` başarısız olursa yamayı zorlamayın; Codex'e güncel 6 dosyayı inceletip aynı mantığı yeni sürüme uyarlatın.

4. Test edin:

```powershell
cd backend
npm test
cd ..\frontend
npm run build
```

Bu testler **güncel projenizde** çalıştırılmalıdır. Burada sadece kaynak dökümünden çıkarılan dosyalara yama uygulama ve JS/JSX sözdizimi kontrolleri yapıldı.

## Railway ortam değişkenleri

```dotenv
RESEND_API_KEY=YOUR_SECRET_RESEND_KEY
EMAIL_FROM=ACB Atölyesi <noreply@mail.xn--acbatlyesi-icb.com>
EMAIL_REPLY_TO=acbatolyesi@gmail.com
API_URL=https://YOUR-RAILWAY-API-HOST/api
SITE_URL=https://YOUR-LIVE-SITE-HOST
CLIENT_URL=https://YOUR-LIVE-SITE-HOST
```

Frontend Vercel/Vite ortamında `VITE_API_BASE=https://YOUR-RAILWAY-API-HOST/api` değerini de kontrol edin. Secrets değerlerini kimseye göndermeyin.

**Alan adı uyarısı:** `xn--acbatlyesi-icb.com` = `acbatölyesi.com`; `acbatolyesi.com` ayrı bir alan adıdır. Resend'de gerçekten sahip olduğunuz ve SPF/DKIM kayıtları doğrulanmış doğru alan adını kullanın. Gönderici `noreply@...` bu alan adında bulunmalı. Gmail adresi sadece `Reply-To` olmalı.

## Canlı test senaryoları

1. Doğrulanmamış yeni bir e-posta ile kayıt: `201`, `accountCreated=true`, `emailAccepted=true` sadece Resend `data.id` dönerse. E-postada beklenen konu ve 24 saat geçerli link olmalı.
2. Geçersiz Resend anahtarı ile kontrollü test: `503`, `EMAIL_SEND_FAILED`, hesap mevcut ve doğrulanmamış kalmalı. Kullanıcı yeniden gönder düğmesini görmeli.
3. Yeniden gönderme başarılı: e-posta sağlayıcı tarafından kabul edilmeli; yeni token doğrulanmalı; önceki token geçersiz olmalı.
4. Yeniden gönderme başarısız: `503`, frontend hata göstermeli; başarılı ibaresi görünmemeli; önceki geçerli token DB'de korunmalı.
5. `API_URL` eksik veya yanlış (`/api` yok) üretim koşulunda mail gönderimi kabul edilmiş gibi görünmemeli. Doğrulama linki `localhost` içermemeli.
6. Doğrulanmamış hesapla login `403 EMAIL_NOT_VERIFIED`; başarılı doğrulama ardından login çalışmalı.
7. Çok hızlı yeniden gönderim 429 ile sınırlanmalı; hata frontend'de görünmeli.
8. Resend paneli **Emails / Events** üzerinden `delivered`, `bounced` vb. olaylara bakılmalı. API kabulü, posta kutusuna teslimat garantisi değildir.

## Notlar

Bu yama **canlı Railway ortamını veya Resend kontrol panelini değiştirmez**. Canlı URL, API anahtarı, alan adı doğrulaması ve SPF/DKIM kayıtlarını ayrıca kontrol etmek gerekir. Auth akışındaki OTP ve şifre sıfırlama gönderimlerinin de asenkron hataları yuttuğu görülüyor; bunlar aynı prensiple ayrı bir güncellemede ele alınmalı.
