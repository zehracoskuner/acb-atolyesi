# Notlar ve Olay Örgüsü düzenlemesi

- Genel notlar ve eser notları ortak bir liste/editör görünümü kullanır. API kaynakları (`/notes`, `/works/:workId/notes`) ayrıdır. Veri taşınmaz.
- Mobilde not listesi ve editör sırayla gösterilir; görünür listeye dönüş vardır. Yükleme hatası, boş liste ve arama sonucu yok durumları ayrıdır.
- Otomatik kayıt seri çalışır. Not değiştirme, listeye dönüş ve eser bağlantısından çıkış, bekleyen kaydı bekler; hata halinde açık taslak korunur. Kaydedildi yalnızca başarılı sunucu yanıtından sonra görünür.
- Esere bağlama arayüzü önceden `workId` gönderse de model/route bunu saklamıyordu. Genel Note modeline isteğe bağlı alan eklendi; eser sahipliği kontrolüyle PATCH ve GET desteklendi. Not kaynakları birleştirilmedi.
- Karakter/evren/not detayları geniş native dialog içinde düzenlenir. Dialog odağı sınırlar ve kapanışta geri verir. Kaydetmeden kapatma isteği değişiklikleri kaydeder; hata halinde kapanmaz. Karakter yönetimi ve sahne filtresi erişilebilirdir. Sürükleme verisi korunmuştur.
- Pano detay açılışında unmount edilmez. Kayıtlı koordinatlar, çizimler ve sahne bağlantı API akışları değiştirilmedi. Kart eylemleri klavyeyle erişilebilir ve kart içinde görünürdür.
- Not CSS'indeki global reset ve `:root` tanımları kaldırıldı. Yeni stiller ekran sınıflarıyla sınırlıdır. Yeni paket eklenmedi.

## AI kapsamı

`StoryCoachPanel` mevcut world verisini ister. `backend/routes/ai.js` Hikâye Koçu promptunda ilk 5 mekanın adını, ilk 4 kuralın başlığını, ilk 3 olay örgüsü notunun başlığını ve karakter notlarının ilk 200 karakterini kullanır. Evren/not açıklamaları prompta eklenmez. Genel ve eser notları bu isteğe katılmaz. Yardım metni buna göre yazıldı; istek kapsamı değiştirilmedi.

## Tur hedefleri

Hiçbir mevcut `data-tour` işareti kaldırılmadı veya yeniden adlandırılmadı.

- `plotworld-baslik`, `plotworld-perde-yapi`: genişletilen sol panelde; mobilde panonun üstünde.
- `plotworld-ark-btn`, `plotworld-ai-btn`, `plotworld-sahne-ekle`: aynı sekme çubuğunda; küçük ekranda satıra sarılabilir.
- `plotworld-cizim-alani`, `plotworld-ark-panel`: aynı bileşen sarmalayıcılarında.
- Kaldırılan ikinci perde özeti ve açılır hale gelen gösterge üzerinde tur işareti yoktu. Not ekranlarında mevcut işaret yoktu.

Tur metni/akışı bu görevde yeniden yazılmadı. Sonraki tur görevinde mobil üst panel ve satıra sarılan sekme çubuğu konumları kontrol edilmeli.

## Doğrulama

- Frontend production derlemesi başarılı. Mevcut `index.css` tur CSS import sırası ve büyük bundle uyarıları sürüyor.
- 6 test dosyasında 91 test başarılı: `noteSaveQueue`, `noteLinks`, `worldEntryEditor`, mevcut `chapterAccess`, `drawingController`, `drawingSnapshot`.
- Yeni testler: eşzamanlı yazmaların sıralanması, kayıt hatasında geçişin durması ve tekrar deneme, boş metnin saklanması, bağlantının yeniden okumada korunması/kaldırılması, başka kullanıcının eserine bağlantının reddi, detay kapanışının sunucuyu beklemesi.
- Testler izole model taklitleri/deneme verileriyle çalışır; gerçek kullanıcı verileri değiştirilmedi.
- Hedefli ESLint: hata yok; PlotWorld'de önceden var olan 5 uyarı sürüyor.
- Tarayıcı envanteri boş; in-app browser açma denemesi `Browser is not available: iab` döndü. Bu nedenle masaüstü/390 px görsel kontrol, gerçek UI üzerinden oluştur-düzenle-geç-yenile, sahne sürükleme/bağlantı ve viewport korunumu E2E doğrulanamadı. Ekran görüntüsü yok. Native dialog odak döngüsü de gerçek tarayıcıda ayrıca doğrulanmalı.
