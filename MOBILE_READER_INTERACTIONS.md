# Mobil okuma: yorum ve beğeni akışları

26 Ekim 2026 tarihli uygulama notu. Çalışma alanında önceden bulunan mobil okuma ve yayınlanmış sürüm çalışmalarının üzerine uygulanmıştır; diğer mevcut değişiklikler geri alınmamıştır.

## Kullanıcı akışı

- Bölüm sonunda sıra: sonraki bölüm/son bölüm bilgisi → önceki bölüm → bölüm beğenisi → gerçek sayılı yorum düğmesi → eser bilgisi. Kalp, kütüphane ve okuma ilerlemesi ayrıdır.
- Yorumlar metnin altına uzun liste olarak eklenmez. Safe area ve okuma temasını izleyen alt panelde, kendi sanallaştırılmış listesinde açılır. Tablet paneli 680 birimle sınırlıdır. Metin WebView'ı yeniden oluşturulmaz; panel kaydırması okuma ilerlemesine katılmaz.
- Misafirler gerçek bölüm beğeni sayısını görebilir. Yorumlar önizleme dışında metin içerebildiğinden yorum okuma oturum gerektirir. Yazma/beğeni/şikâyet girişimleri oturum akışına gider. Oturum dönüş hedefi eser, bölüm, yorum paneli ve seçili paragrafı içerir; okuma konumu geçici olarak devredilir. Önceki beğeni dokunuşu otomatik gönderilmez.
- Ana yorum ve tek seviyeli yanıt; yanıtları açma/gizleme; bağımsız yorum kalpleri; sahip için düzenle/sil; diğer kullanıcı için neden seçilen şikâyet formu uygulanmıştır. Yanıttaki Yanıtla aynı ana yoruma gider; hedef kullanıcı ayrıca gösterilir.
- Bölüm yorumunda 2000, paragraf yorumunda mevcut backend sınırı olan 1000 karakter uygulanır. Metin sessizce kesilmez. Boş/değişmemiş/aşırı uzun gönderim engellenir. İstek bitmeden başarı gösterilmez; hata halinde metin korunur. Sunucu hata mesajları, yetki kısıtları dahil gösterilir.
- Taslaklar kullanıcı + eser + bölüm kapsamındadır; ana metin, her yanıt ve düzenleme ayrı korunur. Paragraf taslakları blok, indeks ve yayın sürümüyle de ayrılır. Paneli kapatmak taslağı iptal etmez; başarılı kayıt temizler.
- Aynı anda yinelenen yazma/beğeni istekleri ref kilitleriyle engellenir. Beğeniler sunucudan onaylanınca güncellenir. Eski bölümün veya eski kontrol isteğinin yanıtı yeni durumu ezmez. Sayfalama kimlik bazında tekilleştirilir.
- Yanıtlı ana yorum silinirse metni gizlenen tombstone kalır. Sunucuda yanıt oluşturma ve kök silme transaction içinde aynı kök kilidini kullanır; eşzamanlı işlemler sahipsiz yanıt bırakmaz. Düzenleme/beğeni silinmiş yorumu canlandıramaz.
- Paragraf paneli kendi endpoint'ini kullanır; desteklenmeyen yanıt/beğeni düğmeleri eklenmez. Şikâyet genel rapor akışına gider ve yorumu kendiliğinden gizlemez.

## Endpoint ve veri sözleşmesi

| Yol | Değişiklik |
| --- | --- |
| `GET /api/chapters/:chapterId/like/check` | Zaten misafir sayacını destekliyordu; yeni endpoint eklenmedi. Mobil bunu kullanıyor. |
| `POST /api/chapters/:chapterId/like` | Mevcut açık `liked` durumu ve atomik/transaction sözleşmesi korunuyor. |
| `GET /api/comments/chapter/:chapterId` ve mevcut alias'ları | Yayın ve yaş erişim kontrolleri korunur; önizleme sınırını aşan alıntıları sızdırmamak için oturum gerekir. `?summary=1` yalnızca `total` döndürüyor. |
| Bölüm yorumu `total` | Yayınlanmış ana zincir sayısıdır; tombstone dahildir, yanıtlar dahil değildir. Web ve mobil aynı anlamı kullanır. |
| Bölüm yorumu oluşturma | Eser kimliği bölümden doğrulanır; başka eser/bölüme yanıt ve ikinci seviye yanıt reddedilir. Yayınlanmamış/erişilemeyen hedefe yazılamaz. |
| `PATCH/DELETE /api/comments/:commentId` | Sahiplik kontrolü korunur. Düzenleme atomik silinmemiş durum koşulu kullanır. Silme yanıtında `deletedId` ve `tombstone` eklenir. Web de bu yanıtla zinciri korur. |
| `POST /api/comments/:commentId/like` | Mevcut atomik `liked`/`likeCount` yanıtı kullanılır; ham beğenen kimlikleri yayınlanmaz. |
| `GET /api/inline-comments` | Oturum kontrolü ve mevcut sayfalama/özet korunur; sayfalı yanıta `total` ve `page` eklenir. Yalnızca yayınlanmış yorumlar görünür; gizli moderasyon notları çıkarılır. |
| **`GET /api/reports/reasons`** | Yorum şikâyetlerinin nedenlerini döndürür. Mobil yorum formu bu listeyi kullanır. |
| `POST /api/reports` | `targetType: "comment"` gerçek hedefi iki mevcut yorum koleksiyonunda da doğrular. Kendi/olmayan/erişilemeyen yorum reddedilir; bekleyen mükerrer şikâyet 409 döner. Açıklama isteğe bağlıdır; telif için mevcut özgün eser bilgisi zorunluluğu korunur. |
| Admin/moderatör rapor listesi | Paragraf yorum hedefini de başlık ve eser bağlamıyla çözer; mevcut kaldırma eylemi ilgili paragraf yorumunu reddedebilir. |

Yeni bildirim türü veya gerçek zamanlı altyapı eklenmedi. Mevcut kendi kendine bildirim ve yinelenen alıcı önleme davranışları test edildi; beğeni kaldırma yeni bildirim üretmiyor.

## Web–mobil paragraf uyumu ve somut sınırlar

İki istemci de sunucunun güvenli `blocks`/`contentVersion` verisini kullanır. Boşluk HTML'i görsel olarak korunur ama yorum paragrafı olarak numaralandırılmaz (`index: -1`). İç blokları olan editör `div` sarmalayıcıları ayrıştırılır; güvenli hizalama stilleri korunur. Başlık, paragraf, alıntı ve her liste öğesi bloktur. Bir paragraf veya `pre` içindeki şiir dizeleri/satır sonları aynı bloğun parçasıdır.

Web ve mobil editörler paragraflara kalıcı kimlik verir. Yazım ve biçim düzenlemelerinde veya paragraf taşındığında yorum aynı paragrafa bağlı kalır. Metin değişmişse okur önceki paragraf metnini yorumdan açabilir. Paragraf silindiğinde ya da bölme ve birleştirmede hangi parçaya ait olduğu belirsizleştiğinde yorum eski paragraf metniyle birlikte Eski pasaj yorumları alanında görünür.

Yayın değişirken eski parmak iziyle özgün pasajı doğrulanan yorumlar kalıcı paragraf kimliğine bağlanır. Yalnızca paragraf sırasını taşıyan eski kayıtlar Eski pasaj yorumları alanında korunur. Yeni yorum gönderilirken sunucu güncel yayın sürümünü ve blok parmak izini doğrular.

Bildirim modelinde yorum kimliği yoktur. Mobil yorum bildirimi doğru eser/bölümün yorum panelini açar; tek bir yoruma otomatik odaklama desteği varmış gibi davranılmaz.

## Değişen dosyalar (bu görevin kapsamı)

- Mobil: `mobile/src/ReaderScreen.tsx`, `mobile/src/readerDocument.ts`, `mobile/src/types.ts`, `mobile/src/components/ReaderComments.tsx`, `ReaderControls.tsx`, `ReaderSurface.tsx`, `mobile/app/paragraph-comments.tsx`, `mobile/app/notifications.tsx`.
- Sunucu: `backend/controllers/commentController.js`, `backend/middlewares/readerAccess.js`, `backend/models/Comment.js`, `InlineComment.js`, `backend/routes/inlineComments.js`, `public.js`, `reports.js`, `adminReports.js`, `backend/services/readerContent.js`, yeni `commentTarget.js`, `reportWorkflow.js`.
- Web: `frontend/src/pages/Read.jsx` (ortak blok indeksleri, boşluk göstergeleri ve tombstone yanıtını koruma).
- Doğrulama: yeni `backend/tests/readerInteractions.integration.test.js`, `mobile/tests/readerInteractions.browser.test.ts`; güncellenen `backend/tests/readerContent.test.js`, `readerWhitespace.test.js`, `reader.integration.test.js`, `mobile/tests/reader.browser.test.ts`; yerel test uyarlamaları `mobile/scripts/design-preview.mjs` ve `design-preview/adapters.jsx`.

## Çalıştırılan doğrulamalar

- Mobil `npm.cmd run typecheck`: geçti.
- Değişen mobil bileşenler, rotalar ve yeni tarayıcı testi için hedefli ESLint: hata/uyarı yok.
- Mobil testleri, `MOBILE_READER_BROWSER` yerel Chrome yoluyla: **83 geçti**, bu işten bağımsız editör tarayıcı grubundaki **9 test atlandı**. Bunların 4'ü okuma WebView belgesini, 5'i gerçek ReaderScreen/ReaderComments bileşenlerini React Native Web test uyarlamasında çalıştıran tarayıcı testleridir.
- Backend izolasyonlu replica set ile 9 ilgili test dosyası: **112 geçti**. Dosyalar: `readerInteractions.integration`, `readerContent`, `readerWhitespace`, `reader.integration`, `likes.integration`, `securityBoundaries.integration`, `reportWorkflow.integration`, `feed.integration`, `publishedDraft.integration`. Son stil/serileştirme düzeltmesinden sonra ilgili 3 dosya tekrar çalıştırıldı: **18 geçti**.
- Web `npm.cmd run build`: başarılı. Derleme mevcut büyük paket boyutu uyarısını veriyor.
- Tarayıcıda çift dokunuş, hata sonrası durum/metin koruma, eski kontrol/önceki bölüm yanıtı, panel sonrası aynı kaydırma konumu, 2000 karakter sınırı, ana yorum/yanıt/düzenleme/tombstone/şikâyet, misafir ve paragraf ayrımı doğrulandı. Telefon açık/koyu/sepya ve tablet koyu panel görüntüleri `mobile/artifacts/reader-interactions/` altında üretildi ve incelendi. Bunlar açıkça test verisi kullanan yerel QA görüntüleridir; üretim ekranına örnek veri eklenmedi.

## Gerçek cihazda kalan doğrulama

Fiziksel iOS/Android cihaz testi yapılmadı. Dokunmatik metin seçimi, yerel klavye ve yeniden boyutlandırma, Android geri tuşunun klavye → menü/onay → panel sırası, VoiceOver/TalkBack odağı, işletim sistemi büyük yazı ayarı, çentik/safe area ve gerçek tablet yön değişimi cihazda doğrulanmalıdır. Tarayıcı testleri bu kontrollerin yerine geçmez.
