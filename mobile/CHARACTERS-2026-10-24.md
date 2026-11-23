# Karakterler: liste ve detay

## Kullanım

Atölye → eser → Hikâye araçları → Karakterler. Tek sütunlu listede eser adı, geri/ekleme düğmeleri, ada göre arama, karakter renginde baş harf, ad/rol ve ilişki sayısı bulunur. Uzun adlar kartta iki satırla sınırlıdır; detayda tam ad gösterilir. İçerik tablette 760 birimle sınırlandırılır.

Kartın tamamı karakter detayını açar. Detayda Notlar ve İlişkiler, düzenleme eylemi, ikincil menüde karakterin adıyla silme onayı bulunur. İlişkide karşı karakterin adına dokunmak onun detayına götürür. Ekleme/düzenleme ayrı ekranlardır; ad zorunludur. Sunucuya kaydetmeden boş karakter oluşturulmaz.

İlişki formu yalnızca aynı eserdeki diğer karakterleri seçtirir; tür, giden/gelen/karşılıklı yön, 1–5 güç ve açıklama desteklenir. Gelen ilişki için kaynak/hedef istek gövdesinde doğru yönde değiştirilir. İlişkiler onayla silinir. Backend'de ilişki düzenleme endpoint'i bulunmadığından bir düzenleme işlemi uydurulmadı.

## Veri davranışı

- Mevcut `api()` istemcisi ve oturum kullanılır. Tüm sorgu ve mutasyonlar workId içerir; route parametresi değişince ekranın yerel durumu yeniden kurulur. Ekran odaklandığında mevcut `useResource` yeniden veri alır.
- Karakter PATCH isteği yalnızca değişen `name`, `role`, `color`, `notes` alanlarını gönderir. x/y, tagline, faction, location ve diğer alanlar gönderilmez/sıfırlanmaz.
- Çift gönderim `useAction` kilidiyle engellenir. Başarı yalnızca sunucu yanıtından sonra görünür; hatada form korunur. Kirli formdan geri çıkma onay ister; kayıt sürerken çıkış durdurulur. Bunlar form belleği davranışlarıdır; bu değişiklik yeni bir çevrimdışı kuyruk veya uygulama kapatılınca taslak kurtarma sistemi eklemez.
- Webin dokuz varsayılan ilişki türü aynı anahtarlarla kullanılır. Bilinmeyen özel türler ham anahtarlarıyla gösterilir ve tekrar kullanılabilir. Webdeki özel tür etiket/renk tanımları localStorage'dadır; cihazlar arası eşitlenmez. Mobil bunların etiketlerini bildiğini varsaymaz.
- Backend karakter silme işlemi ilişkileri otomatik silmez. Kalan ilişkilerde eksik hedef “Silinmiş karakter” olarak gösterilir ve ilişki kullanıcı onayıyla kaldırılabilir.
- Ana karakter akışı artık liste/detaydır. Yeni canvas veya grafik bağımlılığı eklenmedi. Mevcut mobil kaynaklarda Sahne Kıvılcımı / Derinleştir girişi bulunmadı; yeni AI özelliği eklenmedi.

## Değişen dosyalar

- `app/characters/[workId]/index.tsx`, `new.tsx`, `[id].tsx`, `[id]/edit.tsx`, `[id]/relation.tsx`: Expo Router ekranları.
- `src/components/CharacterScreens.tsx`: liste, detay, karakter ve ilişki formları; güvenli alan, klavye, tema, çıkış uyarısı.
- `src/characters.ts`: kısmi güncelleme, tür sözlüğü, yön yorumlama ve ilişki gövdesi.
- `src/types.ts`: karakter rengi.
- `app/tools/[workId].tsx`: yeni listeye yönlendirme; eski gömülü karakter akışının temizliği. Sahne karakter seçimleri korunur.
- `tests/characters.test.ts`, `scripts/check-characters.cjs`, `scripts/design-preview/{App,adapters}.jsx`: saf mantık/istek ve izole arayüz kontrolleri. QA adaptörleri native uygulamada kullanılmaz.
- `../backend/tests/mobileFlow.integration.test.js`: gerçek karakter/ilişki endpoint'lerini izole MongoDB üzerinde sınayan ek test. Backend ürün kodu ve web ekranı bu görevde değiştirilmedi.

## Son kontroller — 24 Ekim 2026

- TypeScript başarılı.
- Karakterlere özel Vitest: **4/4 başarılı**. Değişen alanlar, boş ad, hata/tekrar deneme, özel tür, gelen ilişki ve öz ilişki engeli.
- Gerçek Express + izole MongoDB mobil entegrasyon paketi: **5/5 başarılı**. Karakter/ilişki CRUD, eserler arası ayrım, yanlış eserde mutasyon reddi, x/y ve diğer alanların korunması, yeniden okuma dahil. Kullanıcı veritabanı kullanılmadı.
- `node scripts/check-characters.cjs`: başarılı. Gerçek bileşenler ve API istemcisi kontrollü HTTP yanıtlarıyla çalıştırıldı. Oluşturma/düzenleme/silme, ilişkiler, başarısız kayıt/tekrar deneme, çift gönderim, çıkış uyarısı, veri yenileme, eser ayrımı, boş liste, arama sonucu yok, GET hatası/yeniden deneme doğrulandı.
- 320/430/1024 px açık ve koyu listeler, 320 px detay/düzenleme/ilişki/yeni karakter ekranları görüntülendi. Uzun ad/not ile yatay taşma kontrolü yapıldı. Görseller `artifacts/design/characters-*.png` içinde.
- Genel mobil test paketinin bu devam turundaki çalıştırması **52 başarılı / 14 başarısız**: `draftEngine`, `syncQueue`, `offlineStudio`, `editor.browser` testlerinde hatalar var. Önceki 66/66 sonucu güncel kabul sonucu olarak kullanılmamalı. Bu karakter çalışması uygulamanın tamamının sorunsuz olduğu anlamına gelmez.
- Son lint: 0 hata; `app/write/[id].tsx` içinde bu görev dışındaki `localPending` ve `diskFailed` değişkenleri için 2 uyarı.
- Android ve iOS Hermes export başarılı: `npx.cmd expo export --platform android --platform ios --output-dir .tools/characters-export`. Bu sonuç native APK/Xcode derlemesi veya fiziksel cihaz çalıştırması değildir.
- Fiziksel Android/iOS cihazında sistem geri hareketi, gerçek klavye, ekran okuyucu ve sistem büyük yazı kabul testi yapılamadı. RN Web uyarı testi kontrollü navigation/Alert adaptörü kullanır; native cihaz testi değildir.
- Mevcut APK yeniden üretilmedi. Bu değişiklik kaynak koddadır; önceki 1.0.5 APK bu ekranları içermez.
