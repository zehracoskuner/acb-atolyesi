# Mobil okuma ekranı — teslim notu

26 Ekim 2026. Mevcut Expo Router uygulamasında uygulandı. Yeni demo veya üretim örnek verisi eklenmedi. Çalışma alanındaki diğer yayınlama, yorum ve editör değişiklikleri korunarak entegre edildi.

## Kullanılan rota ve akış

Navigasyon eser detayından, kütüphaneden ve bölüm hedefli bildirimlerden `mobile/app/read/[workId]/[chapterId].tsx` rotasına gidiyor. Bu rota `src/ReaderScreen.tsx` ekranını açıyor ve kök Stack içinde genel sekmelerden bağımsız çalışıyor. Aynı adlı eski web/okuma ekranları mobil hedef olarak kullanılmadı.

- Geri, eser/bölüm bilgisi, Aa ve menü üstte; bölümler, bölüm içi yüzde ve yorumlar altta. Araçlar opaklık değiştirir; metnin yerleşimi değişmez. Yukarı kaydırma ve görünür çıkış düğmesi araçları geri getirir. Ekran okuyucu açıkken otomatik gizleme kapalıdır.
- Tek sütun, 19 temel yazı boyutu, 1,7 satır aralığı, telefonda 22 birim kenar boşluğu, tablette ortalanmış 740 birim dış genişlik. Açık/sepya/koyu ve uygulama temasını izleme; serif/sans serif; sistem yazı ölçeği ve yerel kalıcı tercihler.
- Bölüm listesi sunucunun `order` sırasını kullanır; yayın kimliği dizisinin sırasını kullanmaz. Önsöz ayrı öğedir. Bilinçli bölüm seçimi ve doğrudan bağlantı baştan açılır. Kütüphane/eser devam eylemi `mode=resume` ile kayıtlı bölümü/konumu açar.
- Bölüm sonunda: sonraki bölüm → önceki bölüm → beğeni ve yorumlar → eser bilgisi. Son yayın için “Yayınlanan son bölüme geldin” gösterilir; tamamlanma verisi olmadan kitap bitişi iddia edilmez.
- Yorumlar ayrı panelde, gerektiğinde ve sayfalı yüklenir. Bölüm/paragraf ayrımı, yanıt, beğeni, sahip düzenleme/silme ve gerçek rapor akışı korunur. Panel ve gönderim hataları açık metni kaldırmaz. Yorum taslakları kullanıcı/eser/bölüm kapsamında saklanır.
- Seçili metin için alıntı eylemi ve kayıt öncesi eser/yazar/görünürlük bilgisi vardır. Sınırlar `/quotes/policy` üzerinden alınır: 10–500 karakter; kesme yoktur. Mükerrer kayıt sunucunun 409 mesajını gösterir. Kütüphane, liste, alıntı ve bölüm beğenisi ayrı eylemlerdir.

## Veri, erişim ve ilerleme

- HTML, mevcut `react-native-webview` içinde yalıtılmış yerel belge olarak gösterilir. Sunucu temizler; script/olay öznitelikleri alınmaz. Paragraflar, boş satırlar, biçim, başlıklar, listeler, şiir satırları ve desteklenen görseller korunur. Yazarın zorunlu iki yana hizalaması mobil normal paragraflarda sola çevrilir; merkez/sağ hizalama korunur.
- `readerContent.js` web ve mobil için ortak `blocks`, içerik parmak izi ve blok kimliklerini üretir. Boş görsel bloklar yorum indeksi değildir. Web `Read.jsx` aynı blok verisini kullanır.
- Sadece eski `paragraphIndex` içeren yorumun hangi yayın metnine ait olduğu kanıtlanamaz. Silinmez; güncel paragrafa bağlanmaz, eski pasaj yorumlarından erişilir. Aynı içeriğe sahip yinelenen bloklar ancak aynı yayın sürümü/indeksle doğrulanır. Benzersiz, değişmemiş blok yer değiştirse de eşleşebilir.
- Açılan yayın, odak geri geldiğinde sessizce yenilenmez. Menüdeki yeni sürüm kontrolü kullanıcı seçimiyle geçiş yapar. Yazarın `draftContent`/inceleme kopyası okura verilmez; mevcut yayınlama ayrımı korunmuştur.
- Yüzde yalnız metin geometrisinden hesaplanır; yorum düğmelerinin yüksekliği, üst bilgi ve bölüm sonu alanı hesaba katılmaz. Tüm kitap yüzdesi olarak gösterilmez.
- Yerel kayıt kullanıcı + eser kimliğiyle ayrılır; bölüm kimliğini de içerir. Blok kimliği ve blok içi oran cihazda saklanır. Sunucunun yüzde sözleşmesi korunur; ek `savedAt` eski yeniden denemeleri reddetmek için kullanılır. Önceki ağ cevabı daha yeni yerel kaydı ezmez. Aralıklarla, kaydırma durduğunda, çıkışta ve arka plana geçişte kayıt yapılır; geri yükleme hazır olmadan sıfır kaydı gönderilmez.
- Misafir önizlemesi ilk anlatım bölümünün varsayılan 1500 görünür karakteridir. `READER_PREVIEW_CHARACTERS` ile 100–5000 aralığında yapılandırılır. Sunucuda kesilir; tam metin, sonraki bölüm ve bölüm medyası gönderilmez. Önizlemeden giriş dönüşünde blok oranı mümkün olduğunca aktarılır; kısmi paragrafın oranı tam paragraf boyuna uyarlanır.
- Yorumlarda önizleme dışından metin/alınmış eski pasaj bulunabileceği için bölüm ve paragraf yorumlarını okumak oturum gerektirir. Herkese açık profil alıntıları da misafire metin sızdırmaz. Bu erişim kuralı web istemcisi için de geçerlidir. Herkese açık alıntı, özel kayıt anlamına gelmez.

## Bu çalışma kapsamında düzenlenen dosyalar

Mobil rota ve girişler:
`mobile/app/read/[workId]/[chapterId].tsx`, `mobile/app/_layout.tsx`, `mobile/app/work/[id].tsx`, `mobile/app/(tabs)/library.tsx`, `mobile/app/notifications.tsx`, `mobile/app/lists.tsx`, `mobile/app/paragraph-comments.tsx`, `mobile/src/components/MemberGate.tsx`.

Mobil okuma uygulaması:
`mobile/src/ReaderScreen.tsx`, `readerDocument.ts`, `readerModel.ts`, `reading.ts`; `mobile/src/components/ReaderSurface.tsx`, `ReaderControls.tsx`, `ReaderComments.tsx`.

Backend sözleşmeleri:
`backend/services/readerContent.js`, `backend/config/reader.js`, `backend/routes/public.js`, `inlineComments.js`, `quotes.js`; `backend/controllers/readingProgressController.js`, `commentController.js`; `backend/models/InlineComment.js`, `ReadingProgress.js`, `Quote.js`; `backend/.env.example`.

Web uyumu:
`frontend/src/pages/Read.jsx` — ortak bloklar, sürüm kontrollü paragraf yorumları, eski yorum erişimi ve görünür metinden kelime sayımı.

Testler:
`backend/tests/readerContent.test.js`, `reader.integration.test.js`, `readingProgressController.test.js`, `chapterAccess.test.js`, `securityBoundaries.integration.test.js`, `readerInteractions.integration.test.js`; `mobile/tests/readerProgress.test.ts`, `reader.browser.test.ts`, `readerInteractions.browser.test.ts`. Çalışma alanındaki mevcut `readerWhitespace` ve diğer yayınlama testleri de kullanıldı.

## Doğrulama

- 11 ilgili backend test dosyası, yalnız izole yerel MongoDB replica set ile: 145 test geçti. Son önizleme/erişim düzeltmelerinden sonra 4 etkilenen dosya tekrar çalıştırıldı: 28 test geçti. Yorum etkileşimi entegrasyon grubu: 8 test geçti.
- Mobil ilerleme, eşitleme ve Chromium okuma belgesi: 19 test geçti. Son belge/konum değişikliği sonrası iki grup tekrar çalıştırıldı: 8 test geçti.
- Gerçek ReaderScreen/ReaderComments bileşenlerini React Native Web test uyarlamasında çalıştıran etkileşim grubu: 5 test geçti. Çift dokunuş, ağ hatasında metin/durum koruma, bölüm isteği yarışları, panel sonrası kaydırma konumu, yorum/yanıt/düzenleme/silme/şikâyet ve tema panellerini kapsar.
- Mobil TypeScript ve hedefli ESLint geçti. Android ve iOS Expo export ile web Vite üretim derlemesi başarılı. Web derlemesinin mevcut büyük paket boyutu uyarısı sürüyor.
- Telefon/tablet ve üç tema görselleri `mobile/artifacts/reader/`; gerçek bileşenlerin test paneli görselleri `mobile/artifacts/reader-interactions/` altında. Görseller yerel test verisidir; üretim verisi değildir.

## Somut sınırlar

- Fiziksel Android/iOS cihaz testi yapılmadı. VoiceOver/TalkBack odağı, yerel seçim menüsü, Android geri/klavye sırası, ekran döndürme ve sistem büyük yazısının gerçek cihaz davranışı ayrıca doğrulanmalıdır. Tarayıcı ölçüleri cihaz doğrulaması değildir.
- Blok içi oran kesin karakter konumu değildir. Cihazlar arasında sunucu yalnız yüzde saklar; başka cihazda konum yaklaşık geri yüklenir. Yeni sürümde blok değişirse yüzdeye geri dönülür.
- Metin için tam çevrimdışı kitap indirme eklenmedi. Açık belge ağ kesilince kalır; alınmamış bölüm yeniden deneme ister. Yerel ilerleme saklanır.
- Mobil okuma yüzeyi sistem serif/sans serif yazılarını kullanır; native araçlar mevcut uygulama fontlarını kullanır. Metin seçimi için mutlak kopya/ekran görüntüsü engelleme iddiası yoktur.
- Üretime dağıtım yapılmadı. Mobil paketle birlikte yeni backend blok/önizleme/politika sözleşmesi dağıtılmalıdır.
