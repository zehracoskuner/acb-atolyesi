# İnsan incelemesiyle içerik moderasyonu

Kapak, avatar, banner yükleme ve bölüm yayınlama akışlarında otomatik AI içerik kararı yoktur. Yazarlık koçunun `/api/ai/review` dahil uçları korunur. Teknik görsel doğrulaması, oturum, sahiplik, Origin kontrolü ve ortak MongoDB yükleme sayaçları uygulanmaya devam eder.

## Davranış

- Görsel şikâyetleri sunucunun mevcut eser/profil alanından doğruladığı `ImageAsset` sürümüne bağlanır. İstemcinin verdiği rastgele URL indirilmez. Aynı asset için şikâyetler tek `ContentCase` altında toplanır; aynı kişinin açık başvurusu yinelenemez. Karara bağlanmış aynı sürüm için yeni başvuru 409 döner; yeni görsel yeni incelemedir.
- Beşinci başvuruda sahibine yalnız ACB Atölyesi adına nötr bildirim gider. Şikâyet sayısı kaldırma veya ceza oluşturmaz. Şikâyetçi kimliği sahibine sunulmaz.
- Admin ve moderatör gerekçeli kaldırma, reddetme ve kaldırmayı geri alma işlemlerini ortak panelden yapar. Karar, yetkili, sürüm, gerekçe, mesaj ve zaman saklanır. Kendi içeriğinde veya kendi şikâyetinde karar verilmez.
- Görsel kaldırma eski URL'yi kullanan alanları temizler; arayüzün varsayılanı gösterilir. Kararın işaretlediği boş alan dışında geri yükleme yapılmaz. Kullanıcının yeni görseli korunur; Cloudinary geri yüklemesi yeni public ID/URL üretir.
- Son 90 gündeki beş ayrı doğrulanmış görsel ihlali, 72 saat otomatik görsel yükleme engeli oluşturur. Kapak/avatar/banner ortak, bölüm ayrı tutulur. İşlemler kullanıcı hesabı kilidi ve MongoDB transaction ile atomiktir. Kullanılan beş kayıt tüketilmiş olarak saklanır; süresi dolunca aynı grup tekrar ceza vermez. Aktif otomatik ceza uzatılmaz. Geri alma ihlali etkisizleştirir ve ilişkili aktif otomatik cezayı yeniden değerlendirir; manuel yaptırıma dokunmaz.
- Görsel engeli yeni yükleme ve mevcut URL ilişkilendirmesinde uygulanır. Kendi görselini kaldırma, profil metni, yazma ve taslak kaydı açıktır. Kaldırma bildiriminde gerekçe/ihlal sayısı, engelde kesin bitiş tarihi bulunur. Yetkili bağımsız gerekçeli manuel engel koyabilir.
- Bölüm şikâyeti metin ve sürüm özeti saklar. Eski metin kararı düzenlenmiş metne uygulanmaz. Kaldırma metni/sürüm geçmişini silmez; taslağa geçiş inceleme engelini ve gerekçesini korur. Yeniden yayın isteği insan incelemesine gider. Onay exact `expectedRevision` ve gerekçe gerektirir. Önceki pending/rejected kayıtlar kendiliğinden yayınlanmaz.

## Dağıtım ve veri geçişi

1. Veritabanı yedeği alın; mevcut transaction kullanan bölüm geçmişi gibi bu özellik de **MongoDB replica set veya transaction destekleyen küme** gerektirir. Tüm backend süreçleri aynı veritabanını ve aynı güvenilir `CLIENT_URL`/`SITE_URL` değerlerini kullanmalıdır. Üretim HTTPS ve güvenli oturum çerezleri korunmalıdır.
2. Backend ve frontend'i birlikte dağıtın. Karışık eski/yeni backend sürümlerini uzun süre çalıştırmayın: eski süreçler yeni sürüm/engel sözleşmesini uygulamaz.
3. Sunucu başlangıcı `prepareContentModeration()` çağırır: yeni indeksleri oluşturur, yalnız eski reporter/targetType/targetId benzersiz indeksini sürümlü açık-şikâyet indeksiyle değiştirir; pending_review/rejected bölümlere `moderationHold` işaretler. Veri/metin/şikâyet silmez veya topluca yayınlamaz. İndeks kurma yetkisi gerekir; hata başlangıcı durdurur. Birden çok süreçte tamamlanmış indeks silmesi güvenle kabul edilir.
4. `ImageAsset`, `ContentCase`, `VisualAccount` koleksiyonlarını yedekleme/erişim politikasına dahil edin. Doğrulanmış görsel baytları özel kanıt ve geri yükleme için MongoDB'de tutulur; herkese açık model sorgularında seçilmez. Kanıt uçları yalnız personele açıktır, `no-store`/`nosniff` kullanır. Veritabanı ve yedek erişimlerini sınırlandırın; disk şifrelemesi/kanıt saklama süresi işletim politikasıdır. Otomatik kanıt süresi dolumu bu görevde eklenmedi; depolama büyümesini izleyin.

## Depolama ve CDN sınırları

Yeni görseller provider public ID ile kayıtlıdır. Kaldırmada Cloudinary `destroy` + `invalidate:true` çağrılır. Hata kalıcı `purge_pending` durumuna yazılır ve panelden tekrar denenebilir; otomatik tekrar işçisi yoktur. Bu durum giderilene kadar eski doğrudan URL erişilebilir olabilir.

Eski, kendi Cloudinary hesabına ait standart sürümlü URL'ler ilk şikâyette sağlayıcı API'siyle doğrulanıp özel kanıta alınır; indirme süre/boyut sınırlarına tabidir. Harici veya eşlenemeyen eski URL'ler `external` olarak işaretlenir: uygulama referansı kaldırılabilir ancak başka sağlayıcıdaki dosya bu uygulamadan silinemez. Bunlar için sağlayıcı müdahalesi veya yönetilen depoya yeniden yükleme gerekir. Rastgele istemci URL'si kanıt almak için indirilmez.

Cloudinary silme başarısı tüm önbelleklerin aynı anda boşaldığı anlamına gelmez. CDN invalidation yayılımı genellikle saniyeler/dakikalar alır; eski/versioned URL ve hesap ayarları etkileyebilir. Tarayıcı/proxy önbellekleri ve önceden indirilmiş kopyalar geri çağrılamaz. Kaynaklar: [destroy API](https://cloudinary.com/documentation/image_upload_api_reference), [CDN invalidation](https://cloudinary.com/documentation/invalidate_cached_media_assets_on_the_cdn).

## Doğrulama ve sözleşme değişiklikleri

24 Eylül 2026 son koşu: **23 test dosyası, 315 başarılı test, sıfır başarısız/atlanan**. Frontend üretim derlemesi başarılı; mevcut CSS `@import` sırası ve büyük bundle uyarıları sürüyor.

- `cd backend; npm run test:all`: geçici gerçek MongoDB replica set üzerinde tüm testler, isteğe bağlı entegrasyonlar dahil çalışır. Moderasyon paketi gerçek HTTP/JWT/DB ile yetki, mahremiyet, deduplikasyon, eşzamanlı karar, 4/5 eşik, 90 gün, 72 saat, tüketilmiş grup, geri alma, yeni görsel korunması, yükleme/URL engeli, taslak serbestliği, bölüm geçmişi/yeniden inceleme ve AI koçu yanıtını doğrular.
- `tests/upload.test.js`: oturumsuz, sahte MIME, bozuk/çok büyük dosya, piksel/kare sınırları, animasyon, yeniden kodlama, CSRF/Origin, sahiplik ve kota testleri korunur. Geçersiz dosyanın AI/Cloudinary'ye ulaşmadığı doğrulanır. AI ret beklentisi bilinçli olarak kaldırılmıştır; teknik olarak geçerli dosya artık AI onayı beklemez.
- `tests/chapterAccess.test.js`: AI review/reject beklentilerinin yerini normal yayın davranışı alır; manuel yayın kısıtı korunur. pending_review/rejected başlık düzenleme testleri önceden boş reviewNote bekliyordu. Yeni insan inceleme sözleşmesi gerekçeyi ve engeli korur; bu iki beklenti güncellenmiştir, engel kaldırılmamıştır.
- `tests/reportWorkflow.integration.test.js`: eski sürümsüz genel başvuru testi eser üzerinde tutulur; yeni bölüm şikâyeti transaction/sürüm testlerinde doğrulanır. Mevcut telif başvurusu akışı korunur.
- `cd frontend; npm run build`: üretim derlemesi. Gerçek tarayıcıyla uçtan uca inceleme, canlı Cloudinary/CDN invalidation, canlı AI sağlayıcısı ve çok makinalı üretim dağıtımı bu ortamda doğrulanmadı. Harici servisler testlerde taklit edilir; MongoDB transaction ve eşzamanlı istekler gerçek çalışır.

Önceki yükleme güvenliği ve dört eski kimlik doğrulama testi incelemesi `UPLOAD_SECURITY_REVIEW.md` içindedir. Oradaki AI davranışı ve test sayıları tarihsel kayıttır; güncel moderasyon sözleşmesi bu belgedir.

## Bu değişikliğin dosyaları

- Backend modelleri: `models/ImageAsset.js`, `ContentCase.js`, `VisualAccount.js`, `Report.js`, `Chapter.js`, `Work.js`, `User.js`.
- Backend servisleri: `services/imageAssets.js`, `contentModeration.js`, `prepareContentModeration.js`, `chapterReview.js`, `chapterHistory.js`.
- Backend uçları/bağlantıları: `routes/contentModeration.js`, `upload.js`, `user.js`, `works.js`, `chapter.js`, `reports.js`, `adminReports.js`, `admin.js`, `moderator.js`; `config/cloudinary.js`, `server.js`.
- Frontend: `components/ContentModerationPanel.jsx`, `ImageReportButton.jsx`, `ReportModal.jsx`; `pages/AdminPanel.jsx`, `ModeratorPanel.jsx`, `ProfilePage.jsx`, `StoryDetailsPage.jsx`.
- Testler: `tests/contentModeration.integration.test.js`, `upload.test.js`, `chapterAccess.test.js`, `reportWorkflow.integration.test.js`; geçiş/teslim belgesi: `CONTENT_MODERATION.md`.

Çalışma ağacında önceki görevlerden kalan diğer dosyalar da değişiktir; bu liste yalnız bu moderasyon çalışmasının kapsamını gösterir.
