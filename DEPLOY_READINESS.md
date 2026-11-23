# Deploy değerlendirmesi — 5 Ekim 2026

> Bu belge ilk incelemenin tarihsel sonucudur. Güncel code-only güvenlik/release raporu: [RELEASE_CODE_REVIEW_2026-10-05.md](./RELEASE_CODE_REVIEW_2026-10-05.md).

Durum: Canlı dağıtım için henüz onay önerilmiyor. Deploy, push veya uygulama kodu değişikliği yapılmadı. Bu belge inceleme sonucu ve onaya sunulan dağıtım önerisidir.

## Doğrulama

- `frontend`: `npm.cmd run build` başarılı. Çizim modülü için yaklaşık 1,63 MB sıkıştırılmamış JS paket uyarısı var; build engeli değil.
- `backend`: `npm.cmd run test:all` sonucu 603 testten 600 başarılı, 3 başarısız (58 test dosyasından 55 başarılı). Testler izole yerel MongoDB ile çalıştırıldı.
- `frontend`: `npm.cmd run lint` sonucu 17 hata, 21 uyarı.
- Canlı altyapı, hosting ayarları, gerçek OAuth/e-posta/yükleme akışları ve yedekten geri yükleme doğrulanmadı. Temiz checkout üzerinden `npm ci` kurulumu henüz denenmedi.

## Kapanması gereken bulgular

1. `guestRendering.test.jsx` ve `tourLayout.test.jsx`: test üyelerinde `birthYear` yok; mevcut `membershipStep` bunu eksik profil sayıyor. İlk bulgu test verisi ile yeni üyelik koşulunun uyuşmaması. Gerçek kullanıcı akışı doğrulanarak test verisi düzeltilmeli; güvenlik koşulu testi geçirmek için kaldırılmamalı.
2. `feedbackAndQueues.integration.test.js:77`: moderatörün telif kuyruğunda beklenen 0 yerine 2 kayıt geliyor. Yetki beklentisi ile uygulama davranışı uzlaştırılmalı; beklenen sayı gerekçesiz değiştirilmemeli.
3. Lint hataları giderilmeli, hook uyarıları davranış açısından incelenmeli.
4. Kökteki `package.json` başlangıç komutu mevcut olmayan kök `server.js` dosyasına işaret ediyor. Hosting otomatik tespitine bırakılmamalı; backend çalışma dizini açıkça belirlenmeli.
5. `backend/server.js` kökteki `shared/` klasörünü çalışma zamanında import ediyor. Frontend de build sırasında bu klasöre ihtiyaç duyuyor. Yalnızca `backend/` klasörünü paketlemek sunucuyu bozacaktır.
6. `prepareContentModeration` açılışta indeks kaldırıyor ve eski bölüm kayıtlarını güncelliyor. Sürüm düşürmek veritabanını geri almaz; yedek ve eski sürüm uyumluluğu önceden denenmeli.

## Onaya sunulan kod dağıtımı

Tek depo korunsun; frontend ve backend ayrı dağıtım birimleri olsun. `shared/` aynı sürümden gelsin. Bu aşamada ek mikroservis ayrımı önerilmiyor.

| Birim | Kaynak / paket | Komut ve koşul |
| --- | --- | --- |
| Frontend | `frontend/` ve build girdisi olarak `shared/` | Depo kökünden `npm ci --prefix frontend`, ardından `npm run build --prefix frontend`; yayın çıktısı `frontend/dist/` |
| Backend | `backend/` ve kardeş dizin olarak `shared/` | Depo kökünden `npm ci --omit=dev --prefix backend`; çalışma dizini `backend/`, başlangıç `npm start` |
| Veri | MongoDB ve mevcut görsel depolama servisi | Uygulama sürümünden bağımsız kalıcı depolama; snapshot transaction kullanan kitap indirme için replica set desteği |
| Diğer | `acb-atolyesi/`, yerel notlar ve araç ayarları | Bu uygulamanın üretim paketine alınmasın |

Kök başlangıç komutu kullanılmasın. Backend çalışma dizini seçmek ile build bağlamını yalnızca backend klasörüne daraltmak farklı işlemlerdir; `shared/` her zaman erişilebilir olmalı.

## Güncelleme düzeni

- İlk dağıtımdan önce gerekli yeni dosyalar dahil gözden geçirilmiş bir release commit'i ve sürüm etiketi oluşturulsun. Çalışma ağacında çok sayıda değişiklik ve henüz Git'e eklenmemiş dosya var; mevcut HEAD bu çalışma durumunu temsil etmiyor.
- Node sürümü sabitlensin, lockfile üzerinden `npm ci` kullanılsın. Mevcut kontroller Node 22.17.1 üzerinde çalıştı; hedef çalışma ortamı ayrıca doğrulanmalı.
- Ayrı veritabanı ve ayarlarla staging ortamı kurulsun. Test/lint/build başarılı olmadan üretim sürümü hazırlanmasın.
- Frontend ve backend aynı release kimliğiyle üretilsin. API değişiklikleri eski açık tarayıcı sekmeleriyle uyumlu kalsın; önce uyumlu backend, sonra frontend yayınlansın.
- Üretim sırları hosting ortam değişkenlerinde tutulsun; `.env` dosyaları dağıtım deposuna eklenmesin. `VITE_*` değerleri tarayıcıya açıktır.
- Frontend üretim ayarında Railway API adresi var. Hedef domain, CORS, Google callback ve cookie davranışı birlikte doğrulansın. Mevcut cookie `sameSite: lax`; ayrı site adreslerinde cookie oturumuna güvenmeden gerçek tarayıcı testi yapılsın.
- Backend kapanışında devam eden istekleri tamamlama ve MongoDB bağlantısını kapatma desteği eklensin. Mevcut health endpoint'i DB bağlantısının sonradan kopmasını göstermiyor; readiness kontrolü eklensin.
- İlk sürüm tek backend instance ile planlansın; genel/auth limitleri süreç belleğinde. Birden fazla instance öncesi ortak limit deposu düzenlensin.
- Dağıtım öncesi DB yedeği alınsın, staging üzerinde migration ve geri dönüş denensin. Önceki frontend/backend paketleri saklansın; veri geri yükleme ayrı ve açıkça onaylanan bir işlem olsun.
- SPA deep-link yönlendirmesi ve eski hash'li assetlerin güncelleme sırasında erişimi ayarlansın. Giriş, Google giriş, profil tamamlama, eser/bölüm kaydetme, okuma, dosya yükleme ve moderasyon staging üzerinde kontrol edilsin.

## Sonraya bırakılabilecekler

Çizim paketinin küçültülmesi ve yeni özelliklerin açılması ilk yayının ön koşulu değil. `shared/features.js` içinde bölüm geçmişi, gelişim koçu, sahne AI ve çizim kapalı; bu sınırlar ilk sürümde korunabilir. Sözleşme sayfasındaki taslak bildiriminin yayın kararı ayrıca netleştirilmeli.

Önerilen onay kapsamı: Yukarıdaki düzeltmelerin ve dağıtım yapılandırmasının hazırlanması, ardından staging doğrulaması. Canlı yayın için kullanıcı onayı bekleniyor.
