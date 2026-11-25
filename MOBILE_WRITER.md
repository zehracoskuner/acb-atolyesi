# Mobil bölüm yazma ve yayınlama

Expo Router yazma ekranı mevcut yerel WebView rich text editörünü kullanır. Başlık ve metin aynı dikey akıştadır; sayfalama yoktur. Bölüm seçici, menüde güncel metnin önizlemesi, manuel kayıt ve ayrı yayınlama/yayından kaldırma eylemleri vardır. Sıra numarası düzenleme ve bölüm adıyla onaylanan silme, eser atölyesindedir.

## Kayıt ve kurtarma

- Her değişiklik kullanıcı + eser + bölüm anahtarıyla AsyncStorage kuyruğuna girer; sunucu kaydı 1,5 saniye duraklamadan sonra yapılır. Eski anahtarlar başarılı yerel kopyadan sonra taşınır.
- Aynı bölümün kayıt/yayınlama istekleri sıralıdır. Eski yanıt yeni yazıyı ezmez. Başlık değişiminde içerik gönderilmez. Yerel kayıt durumu gerçek disk sonucundan gelir.
- Yeniden açılan kirli taslak sunucudan farklıysa arka plan eşitlemesi de durur. Kullanıcı cihaz veya sunucu sürümünü seçer; iki metin önce yerel yedeğe alınır.
- Bölüm değiştirme/geri çıkış editör köprüsündeki son metni ve disk kuyruğunu bekler. Arka plana geçişte disk kaydı ve mümkünse sunucu kaydı tamamlanır. İşletim sisteminin uygulamayı zorla sonlandırması sırasında tamamlanmamış işlemler için garanti verilmez.
- Desteklenen HTML biçimleri korunur. Desteklenmeyen eski HTML metni salt okunur açılır; kullanıcı önizleyebilir veya webde düzenleyebilir. Desteklenmeyen HTML yapıştırma açıklamayla engellenir. Ayrı bölüm medya alanı kayıt isteklerinden çıkarılmaz/silinmez; mobil editör medya düzenleme arayüzü sağlamaz.

## Yayın ve inceleme

Mevcut `title/content/media` okur sürümüdür. Mevcut özel `draftContent` çalışma sürümüdür. Yeni, varsayılan sorgularda seçilmeyen `reviewSubmission`, kullanıcının onaylayıp incelemeye gönderdiği başlık/metin/medya/revizyon kopyasıdır; `reviewStatus` başvurunun durumunu taşır.

Yayındaki bir bölümün otomatik kaydı yayını değiştirmez. Yayın işlemi `expectedRevision` gerektirir; güncel olmayan veya sürüm belirtmeyen istek 409 döner. Web ve mobil bu alanı gönderir. Başlık ve içerik birlikte yayınlanır. Bölüm ve eser görünürlüğü aynı MongoDB transaction içinde güncellenir; hata durumunda eski yayın ve çalışma sürümü korunur. Mevcut transaction gereksinimi (replica set) devam eder.

Moderasyon gerekiyorsa mevcut yayın görünür kalır. Kuyrukta çalışma metni yerine sabit başvuru gösterilir. Onay yalnızca bu başvuruyu yayınlar; daha yeni yazılan metin özel taslakta kalır. Ret mevcut yayını kaldırmaz. Yayından kaldırma ayrı, açık onaylı eylemdir. Önceden yayınlanmış kayıtlar toplu dönüşüm olmadan çalışır; eski `pending_review` kayıtları da mevcut inceleme yoluyla desteklenir.

Okur endpoint'i yalnızca yayınlanmış başlık/metni döndürür. Mevcut misafir politikası korunur: misafir bölüm başlıklarını görür; tam metin üyelik gerektirir. Özel taslak ve inceleme metni misafir listelerine girmez.

## Doğrulama

Son çalıştırma: 24 Ekim 2026. Seçilen yedi backend test dosyasında 161 test, mobil test paketinde 79 test geçti. Mobil TypeScript/lint kontrolleri ve web üretim derlemesi başarılı.

- Backend: `node scripts/test-all.mjs tests/publishedDraft.integration.test.js tests/chapterSave.test.js tests/chapterOrder.test.js tests/chapterAccess.test.js tests/chapterEditing.integration.test.js tests/chapterMedia.test.js tests/contentModeration.integration.test.js` — ayrı yerel MongoDB replica setinde.
- Mobil: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`. `MOBILE_EDITOR_BROWSER` kurulu Chrome yoluna ayarlanarak dokuz gerçek tarayıcı editör testi de çalıştırıldı.
- Web: `npm.cmd run build` başarılı. Mevcut büyük paket boyutu uyarısı devam ediyor.
- Testler: uzun Türkçe metin, diyalog/listeli HTML, seçimle biçimlendirme, yapıştırma, geri al/yinele, tema sırasında DOM/seçim, çevrimdışı yeniden açılış, kayıt/yayınlama yarışları, başarısız yayınlama transaction'ı, eski yayın ile yeni çalışma metninin ayrılığı, sabit moderasyon başvurusu ve ret.

Fiziksel Android/iOS cihazında klavye üstü yerleşim, Gboard/iOS önerileri ve IME, seçim tutamaçları, Android geri düğmesi, safe area ve tablet görünümü doğrulanmadı. Tarayıcı testleri bu kontrollerin yerine geçmez. Cihazlar arası koruma revizyon kontrolü ve açık kurtarma seçimiyle sağlanır; otomatik birleştirme/ortak canlı düzenleme yoktur. Tek bir yazar çalışma sürümü ve tek bekleyen inceleme başvurusu tutulur.

## Değişen alanlar

- Mobil: `app/write/[id].tsx`, `app/studio/[id].tsx`, `app/_layout.tsx`, `src/components/RichEditor.tsx`, `src/editorDocument.ts`, `src/draftEngine.ts`, `src/sync.tsx`, `src/types.ts` ve ilgili kayıt/çevrimdışı/editör testleri.
- Web: `frontend/src/pages/ChaptersPage.jsx`.
- Backend: Chapter modeli; chapterPublication, chapterReview, chapterEditing servisleri; chapter, works, moderator, admin route'ları; yayın, moderasyon ve web kayıt testleri.

Depoda önceden bulunan ve çalışma sırasında başka işlemlerce değişen dosyalar korunmuştur. Commit veya dağıtım yapılmamıştır.
