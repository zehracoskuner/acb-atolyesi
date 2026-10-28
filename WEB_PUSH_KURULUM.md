# Tarayıcı bildirimlerini canlıya alma

Kod, mevcut site içi bildirimleri Web Push ile gönderir. Kilit ekranında yalnızca
“Atölyeden yeni bir bildirimin var.” görünür; tıklama Bildirimler sayfasını açar.
İzin yalnızca kullanıcı düğmeye bastığında istenir. Site açıkken isteğe bağlı
yumuşak ses vardır; site dışındaki ses işletim sistemi tarafından belirlenir.

## 1. Anahtarları bir kez üret

Backend dizininde bağımlılıkları kurup çalıştır:

```sh
npm ci
npx web-push generate-vapid-keys
```

Çıktıdaki public/private key çiftini güvenli şekilde sakla. Private key'i Git'e,
frontend ayarlarına veya sohbetlere koyma. Her dağıtımda yeniden anahtar üretme;
anahtar değişirse kullanıcıların bildirimleri kapatıp yeniden açması gerekir.

## 2. Railway API servisinin ortam değişkenleri

```dotenv
WEB_PUSH_PUBLIC_KEY=uretilen_public_key
WEB_PUSH_PRIVATE_KEY=uretilen_private_key
WEB_PUSH_SUBJECT=mailto:acbatolyesi@gmail.com
```

Subject gerçek iletişim adresi olmalı. API'yi yeni kodla yeniden dağıt.
Anahtarlar eksikse bildirim açma düğmesi pasif kalır. Public key API'den alınır;
Vercel'e ayrıca anahtar tanımlamak gerekmez.

## 3. Railway üzerinde ayrı worker servisi

Aynı repository'den, root directory `backend` olan ayrı bir servis oluştur.
Başlatma komutu:

```sh
node scripts/web-push-worker.mjs
```

API ile aynı `MONGO_URI` ve üç `WEB_PUSH_*` değerini bu servise de tanımla.
Servis sürekli çalışmalı, replica sayısı **1** olmalı. HTTP portuna veya public
domain'e ihtiyacı yok; HTTP healthcheck tanımlama. Yaklaşık 10 saniyede bir tarar.
Kuyruk MongoDB'de tutulur; geçici ağ hataları yeniden denenir. 404/410 dönen
abonelikler silinir. Tek seferlik tanılama için `--once` kullanılabilir.
İşlem gönderimden hemen sonra kesilirse aynı bildirim tekrar denenebilir;
tarayıcıdaki notification tag ve push topic aynı bildirimi birleştirir.

## 4. Vercel frontend dağıtımı

Frontend'i yeni kodla dağıt. HTTPS gerekli; geliştirmede localhost kullanılabilir.
`https://SITE/push-sw.js` adresi JavaScript döndürmeli, SPA HTML'i dönmemeli.
Service worker sayfaları veya API yanıtlarını önbelleğe almaz.

## 5. Gerçek cihaz kontrolü

1. Giriş yap, Bildirimler sayfasında “Tarayıcı bildirimlerini aç” düğmesine bas.
2. Tarayıcı izin penceresinde izin ver.
3. Başka hesapla ilk hesabın takip ettiği bir yazarın günlük/bölümünü paylaş.
4. İlk hesabın site sekmesini kapat; bildirimin gelmesini ve tıklanınca
   Bildirimler sayfasının açılmasını kontrol et.
5. Site açıkken ses seçeneğini aç; odaktaki sekmede yeni bildirim sesini dene.
6. Bildirimleri kapatıp yeniden olay oluştur; yeni push gelmemeli.
7. Çıkış, oturum süresi dolması, şifre değişikliği ve hesap engelinde worker
   aboneliği kaldırır. Daha önce push sağlayıcısına teslim edilmiş bildirimler
   geri çekilemez. Tekrar girişte izinli mevcut abonelik yeniden kaydedilir.

Abonelikten önceki bildirimler topluca gönderilmez. iPhone/iPad'de Web Push için
iOS/iPadOS 16.4+ ve Ana Ekrana eklenen web uygulaması gerekir. Tarayıcı tamamen
kapatılmışsa, arka plan çalışması engellenmişse veya cihaz çevrimdışıysa teslim
gecikebilir. İşletim sisteminin sessiz/odak modu ses çıkmasını engelleyebilir.

Bu değişiklik Railway/Vercel hesabına otomatik dağıtım yapmaz. Canlı gönderim
doğrulaması, yukarıdaki ortam ayarları ve gerçek kullanıcı izniyle yapılmalıdır.
