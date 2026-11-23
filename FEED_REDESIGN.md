# Keşfet / Akış ve eser vitrini

## Görsel ve işlevsel değişiklikler

- İlk kutu “Atölyenin Işığında” eser vitrini oldu. Koyu zeytin/kahve sahne, yumuşak CSS ışığı, sayfa kenarı ve kapak gölgesi; yanında krem kâğıt zemin üzerinde eser adı, yazar, türler, kısa tanıtım ve okuma bağlantısı bulunuyor. Kapaksız eserler tipografik kapakla gösteriliyor.
- Vitrindeki eser mevcut `useSpotlight` / `/api/feed/spotlight` üzerinden geliyor. Sunucudaki eser sırası ve dönüşüm zamanlaması değiştirilmedi. Üye doğrudan `/read/:workId`, misafir herkese açık `/story/:workId` ekranına gider.
- Akış: Herkese Açık / Takip Ettiklerim. Sekme değişimi sayfayı yeniden yüklemez; liste/sayfalama sıfırlanır, eski isteğin geç gelen sonucu yok sayılır. `/keşfet?view=feed` doğrudan bu görünümü açar.
- Günlük kartları içerik kadar büyür. Yazar, eser etiketi, raf kitapları ayrı bağlantılardır; kartın tamamında yönlendirme işleyicisi bulunmaz. Beğeni ve yorum işlemleri mevcut endpointleri kullanır.
- Raf ilk üç eseri ve kalan eser sayısını gösterir. Hover/focus hafif perspektif hareketi üretir; raf düğmesi dokunarak açar. `prefers-reduced-motion` hareketleri kaldırır. Ek animasyon bağımlılığı yoktur.
- Atölyede Bugün masaüstünde TopBar altında sticky, mobilde akışın üstünde görünür. Mobilde soru/alıntı kısmı açılabilir; son çalışma ve yazma bağlantısı açık kalır.

## Veri ve gizlilik

`GET /api/feed?scope=public|following&page=1`

- Varsayılan kapsam `public`, sayfa boyutu 15. Mevcut giriş zorunluluğu korunur; misafire kişisel feed yanıtı verilmez.
- `public`: yalnızca `visibility: public` günlükler, takip ilişkisinden bağımsız.
- `following`: yalnızca oturumdaki kullanıcının DB'deki takip listesi; `public` ve `followers` günlükler. Takip edilenlerin son 30 gündeki yayınlanmış, anonim olmayan eserlerine ait yayınlanmış bölüm aktiviteleri korunur.
- `private` günlükler iki kapsamda da yoktur; sahibi için de akışa dahil edilmez.
- Günlük/bölüm listeleri DB içinde birleştirilip tarih ve ID ile sıralanır, sonra sayfalanır. Eski 50 kayıt kesintisi kaldırıldı. `total` ve `hasMore` aynı sorgudan gelir.
- Görünür yazarların rafları tek toplu eser sorgusunda hesaplanır. Yalnızca yayınlanmış, anonim olmayan eserlerin ID, ad, kapağı ve toplam sayısı döner. Bölüm beğenileri de tek toplu sorguyla gelir.
- `relatedWork` için taslak, anonim veya silinmiş eserlerin bilgisi feed'e eklenmez.
- Günlük yorumlarını okuma/ekleme ve günlük beğenme erişimi aynı görünürlük kontrolüne bağlandı. Yorum silerken yorumun URL'deki günlüğe ait olduğu da doğrulanır.
- Yeni scope/page değerleri doğrulanır; kişisel yanıtlar mevcut auth middleware'inin `private, no-store` kuralını kullanır.

`GET /api/feed/atelier`

- Yalnızca oturum sahibinin Work kayıtlarını inceler. Son çalışma, eser `updatedAt` ve bölüm `savedAt` (eski kayıtlar için `updatedAt`) tarihlerinden bulunur. Bölüm metni istemciye gönderilmez.
- Yazmaya dön bağlantısı mevcut `/work/:workId/chapters` editörüne gider.
- Eser yoksa mevcut `CreateWorkModal` açılır; başarılı oluşturma ardından editöre geçilir.
- Günün sorusu frontend'deki 12 sorudan yerel takvim gününe göre deterministik seçilir. Yenilemeyle değişmez.
- İlk ve mevcut alıntı istenen Oğuz Atay cümlesidir.

## Bu görevde değiştirilen / eklenen dosyalar

Frontend:

- `frontend/src/pages/ExplorePage.jsx`
- `frontend/src/components/feed/WorkshopFeed.jsx` (yeni)
- `frontend/src/components/feed/FeedCards.jsx` (yeni; mevcut yorum bileşeni buraya taşındı)
- `frontend/src/components/feed/WriterShelf.jsx` (yeni)
- `frontend/src/components/feed/AtelierToday.jsx` (yeni)
- `frontend/src/components/feed/feedPresentation.js` (yeni)
- `frontend/src/styles/WorkshopFeed.css` (yeni)
- `frontend/src/styles/SpotlightHero.css` (yeni)

Backend:

- `backend/routes/feed.js`
- `backend/services/feed.js` (yeni)
- `backend/routes/log.js`
- `backend/services/logAccess.js` (yeni)
- `backend/models/Log.js` (akış sorguları için indeksler)
- `backend/models/Chapter.js` (eser/bölüm kayıt sorgusu için indeks)

Testler:

- `backend/tests/feed.integration.test.js` (yeni)
- `backend/tests/feedRendering.test.jsx` (yeni)
- `backend/tests/chapterAccess.test.js` (mevcut feed testini aggregation yapısına uyarlama)

## Doğrulama

- Frontend `npm.cmd run build`: geçti.
- Hedefli ESLint: `node node_modules/eslint/bin/eslint.js src/pages/ExplorePage.jsx src/components/feed/`: geçti.
- Backend: `npm.cmd test -- tests/feed.integration.test.js tests/feedRendering.test.jsx tests/exploreRendering.test.jsx tests/chapterAccess.test.js tests/auth.test.js tests/guestRoutes.test.js tests/spotlightSync.test.js tests/spotlight.integration.test.js`: **8 dosya, 159 test geçti**.
- Yeni backend testleri geçici, yerel MongoDB üzerinde gerçek router/JWT/sorgularla çalışır; uygulamanın gerçek veritabanını kullanmaz. Görünürlük, takipten çıkma, 67 kayıtlık sayfalama, karma bölüm/günlük sırası, anonim/taslak raf filtreleri, toplu sorgular, beğeniler/yorumlar ve kişisel son çalışma kontrol edildi.
- Render testleri bağlantıları, anonim yazarı, kapaksız eseri, raf sınırını, alt sekmeleri, alıntıyı ve günlük soru seçimini doğrular. Bunlar canlı tarayıcı etkileşimi veya görsel ekran testi değildir.
- Tarayıcı önizlemesinde ilk deneme otomatik onay incelemesinin kullanım limitine takıldı; sonraki denemede oturumda kullanılabilir tarayıcı bulunmadı. Bu nedenle gerçek masaüstü/mobil ekran görüntüsü, hover/tap ve yatay taşma canlı tarayıcıda doğrulanamadı.
- Build'de mevcut büyük PlotWorld chunk uyarısı sürüyor.

İleride yüksek trafik/veri hacmi için cursor tabanlı sayfalama düşünülebilir. Şimdiki yapı mevcut sayfa tabanlı API'yi korur; hızlı yeni gönderi akışı sırasında sayfa sınırları doğal olarak kayabilir.
