# Sözleşme taslağı ve kabul akışı

Sürüm: `2026-09-16-draft-1`. **Hukuk incelemesi bekleyen taslaktır; nihai hukuk onayı alınmış değildir.** Canlıya yayın yapılmadı.

## Metin ve kaynaklar

`frontend/src/pages/KullaniciSozlesmesi.jsx` içindeki mevcut I–VIII. maddeler korunmuştur. IX. madde eser sahipliği ve izinsiz kullanım taslağını, X. madde açık kabul ve sürüm kaydını ekler. `EtikKurallar.jsx` mevcut ilkeleri ve topluluk taahhüdünü korur; ilgili eki ve sözleşme bağlantısını ekler. Taahhüt düğmesi üyelik kabul kaydı oluşturmaz.

16 Eylül 2026 tarihinde erişilen resmî kaynaklar:

- [Kültür ve Turizm Bakanlığı — Telif Hakkı Nedir?](https://telifhaklari.ktb.gov.tr/TR-332375/telif-hakki-nedir.html): eser sahipliği, mali/manevi haklar, koruma ve haklara ilişkin işlemlerin şekli için dayanak.
- [Kültür ve Turizm Bakanlığı — Telif Hakkı İhlali Halinde Ne Yapılabilir?](https://telifhaklari.ktb.gov.tr/TR-332372/telif-hakki-ihlali-halinde-ne-yapilabilir.html): izinsiz kullanım, başkasının eserini sahiplenme ve başvuru yolları için dayanak.
- [Bakanlığın resmî kanunlar dizini](https://telifhaklari.ktb.gov.tr/TR-332443/kanunlar.html): 5846 sayılı Kanun bağlantısı.

Mevzuat Bilgi Sistemi PDF bağlantısı 502 hatası verdi; Bakanlığın PDF bağlantısı da alınamadı. Dolayısıyla güncel konsolide kanunun tamamının satır satır doğrulandığı ileri sürülmez. Taslak erişilebilen resmî açıklamalara dayanır; ceza miktarı, tazminat katsayısı veya zamanaşımı süresi öngörmez. Yayın öncesi hukuk incelemesinde güncel konsolide metin ayrıca kontrol edilmelidir.

Kaynak açıklamalarından hareketle hazırlanan platform hükümleri; teknik kullanımın sınırı, yapay zekâ eğitimi için genel izin verilmemesi ve bildirim inceleme sürecidir. Bunlar resmî makamca onaylanmış platform sözleşmesi değildir. Mevcut IV. maddede yer alan lisansın şekli ve kapsamı ayrıca değerlendirilmelidir; kutu işaretlemenin mali haklara ilişkin yazılı şekil şartını tek başına karşıladığı iddia edilmez. I. ve VIII. maddelerdeki örtülü kabul ifadeleri silinmemiştir; X. ek bu sürümde açık kabul sürecinin esas olduğunu belirtir.

## Sunucu sözleşmesi

İstemci aşağıdaki alanları gönderir:

```json
{
  "termsAccepted": true,
  "termsVersion": "2026-09-16-draft-1"
}
```

- `POST /api/auth/register`: normal kayıt alanlarına ek olarak yukarıdaki alanlar zorunludur. Doğrulama, DNS/veritabanı/e-posta işlemlerinden önce çalışır.
- `POST /api/auth/complete-profile`: kimliği doğrulanmış, eksik Google profili için kullanıcı adı ve kabul birlikte kaydedilir.
- `POST /api/auth/accept-terms`: kimliği doğrulanmış, profili tamamlanmış mevcut üyenin güncel sürümü kabul etmesini sağlar. Hedef kullanıcı oturumdan alınır. Aynı sürüm için tekrar gönderim ilk kabul zamanını değiştirmez.

Eksik, `false`, `"true"`, sayı veya nesne kabul değeri: `400 TERMS_ACCEPTANCE_REQUIRED`. Eksik/eski/farklı sürüm: `409 TERMS_VERSION_MISMATCH`. Kimliksiz kabul isteği: `401`. Üyelik API'sine kabul eksikliğiyle erişim: `403 TERMS_ACCEPTANCE_REQUIRED`; eksik profil: `403 PROFILE_INCOMPLETE`.

`User.termsVersion` ve `User.termsAcceptedAt` varsayılan olarak `null` değerindedir. Eski kayıtlar kabul edilmiş sayılmaz ve geriye dönük tarih üretilmez. İstemcinin gönderdiği zaman ve pazarlama alanları kabul kaydına alınmaz. Güncel sürüm sunucu sabitinden, zaman sunucunun `new Date()` çağrısından gelir. Bu alanlar son kabulü tutar; geçmiş sürümlere ait ayrı bir olay günlüğü eklenmemiştir.

`GET /api/auth/me`, yerel giriş, Google mobil giriş ve profil tamamlama yanıtları `termsVersion`, `termsAcceptedAt`, `currentTermsVersion`, `requiresTermsAcceptance` içerir. Mevcut token da her korumalı istekte veritabanındaki güncel kabul üzerinden denetlenir. Kabul edilmiş gibi görünen JWT/localStorage alanlarına güvenilmez. `ensureIdentity` yalnızca `/me`, `/complete-profile`, `/accept-terms` için kabul öncesi erişim sağlar. Yasaklı hesap denetimi korunur.

Google OAuth ve mobil Google doğrulaması tek başına kabul oluşturmaz. Yeni Google hesabı eksik profille bekler; üyelik yetkileri profil tamamlama/kabul bitene kadar kapalıdır. Mevcut Google üyesi de gerekiyorsa yeniden kabul ekranına gider. İsteğe bağlı kimlik doğrulaması kullanan herkese açık okumalar, kabulü olmayan üyeyi anonim olarak değerlendirir.

## İstemci ve sürüm değişikliği

Kayıt, Google profil tamamlama ve `/sozlesme-kabul` ekranlarında kutu başlangıçta boştur. Kabul, pazarlama izniyle birleştirilmez. Bağlantılar yeni sekmede `/kullanim-sartlari`, `/etik-kurallar` ve `/gizlilik` sayfalarını açar; bu sayfalar üyelik geçidinin dışındadır.

Giriş ve OAuth dönüşü, `/auth/me` ile bulunan duruma göre profil tamamlama veya sözleşme kabulüne yönlenir. Açık oturumda doğrudan uygulama sayfasına giren üyeler de denetlenir. Önceki güvenli dönüş adresi kabul tamamlanana kadar korunur.

Metin değişikliğinde backend `config/terms.js` ve frontend `src/lib/terms.js` sürümlerini, görünen taslak tarihini ve metni birlikte güncelleyin. Sürüm eşitliği test edilir. Eski frontend yeni sürümü kendiliğinden kabul edemez; `409` üzerine yenileme ve yeniden açık kabul gerekir. Backend/frontend birlikte dağıtılmalıdır. Eski mobil istemcilerin de yeni alanları göndermesi, yanıt bayraklarını işlemesi ve yeniden kabul arayüzünü uygulaması gerekir; mobil uygulama kaynakları bu değişikliğin kapsamında değildir.

## Doğrulama

```text
cd backend
npm test

cd ../frontend
node scripts/verify-terms.mjs
npm run build
```

`tests/termsAcceptance.test.js` gerçek Express rotaları, JWT ve kabul middleware'ine HTTP istekleri gönderir; MongoDB ve dış servisler yalıtılmış test örnekleridir. Yerel/Google kayıt, eski üye, oturum çerezi/Bearer token, atlanan kutu, yanlış veri türleri, eski sürüm, sahte istemci zamanı, yinelenen kabul ve kayıt hatası kapsanır. Gerçek MongoDB'ye veya Google hesabına işlem yapılmaz.

`frontend/scripts/verify-terms.mjs` gerçek React sayfalarını render ederek kutuları, zorunluluğu, başlangıçtaki boş durumu ve kapalı gönderim düğmelerini kontrol eder. Bağlantıları gerçek rota ve sayfa importları üzerinden çözerek doğru başlıkların render edildiğini doğrular. Bağlı tarayıcı bulunmadığından görsel/tıklamalı uçtan uca test yapılmamıştır.
