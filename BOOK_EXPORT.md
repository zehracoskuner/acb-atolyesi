# Kitabımı indir

Eser yönetiminde ve bölüm editöründe DOCX / UTF-8 TXT indirme bulunur.
`GET /api/works/:id/download?format=docx|txt` oturum kontrolünden sonra eserin
`user` alanını doğrular. Başka kullanıcıya ait ve bulunamayan eserler aynı 404
yanıtını alır. Dosyalar yalnızca bellekte üretilir; herkese açık dosya veya
kalıcı indirme bağlantısı oluşturulmaz. Yanıt `private, no-store` kullanır.

## İçerik ve sürümler

- Eser başlığı, gerçek bölüm başlıkları ve kayıtlı bölüm metinleri alınır.
  Tüm yayın durumları kapsanır. Yayın görünümünün özel başlıkları, özet,
  önsöz, çalışma notları, kullanıcı ve AI/moderasyon alanları alınmaz.
- Kısa, salt okunur MongoDB transaction'ı `snapshot` read concern kullanır.
  Bölüm kimlikleri ve `revision` değerleri başlangıçta sabitlenir; metinler
  aynı snapshot içinden okunur. Üretim başlamadan transaction kapatılır.
  Sonraki düzenleme, silme ve eklemeler çıktıdaki sürümleri değiştirmez.
  Mevcut `ChapterVersion` kayıtları değiştirilmez. Henüz geçmiş kaydı olmayan
  eski bölümler de güncel kayıtlı metinlerinden eksiksiz alınır.
- `order`, `createdAt`, `_id` sıralaması deterministiktir. Bölüm sürükleme
  işlemi `PUT /api/works/:id/chapter-order` ile tam bölüm listesini doğrular
  ve sırayı atomik kaydeder. Metni ve sürüm geçmişini değiştirmez.
- Mevcut sürüm kaydı gibi replica set / sharded MongoDB gerekir. Snapshot
  desteklenmiyorsa, eksik bölüm varsa veya üretim başarısızsa hata döner;
  karışık sürümler üretebilen sıradan okumalara geri düşülmez.
- Editörde “Önce kaydet ve indir” tüm bölümlerin kayıtlarını bekler.
  Başarısız kayıt, sürüm çakışması, kurtarılmamış yerel taslak, kayıt
  sırasında düzenleme veya bölüm listesinin değişmesi indirmeyi durdurur.
  “Kayıtlı sürümü indir” seçeneği yerel değişiklikleri içermediğini açıklar.

## Dosya üretimi

`docx` gerçek, düzenlenebilir OOXML üretir; HTML dosyasına DOCX uzantısı
verilmez ve altChunk kullanılmaz. Mevcut `sanitize-html` temizleyicisi ve
onunla aynı ana sürümdeki `htmlparser2` ile HTML ayrıştırılır. İki çıktı aynı
paragraf modelini kullanır. Türkçe/Unicode, paragraflar, satır sonları,
başlıklar, kalın/eğik/altı/üstü çizili yazı, hizalama ve listeler desteklenir.
TXT'de HTML etiketleri bulunmaz; metin olarak yazılmış `<`/`>` korunur.

## Doğrulama

```powershell
cd backend
npm.cmd test
$env:BOOK_DB_TEST='1'
$env:MONGOMS_DOWNLOAD_DIR="$PWD/node_modules/.cache/mongodb-binaries"
npm.cmd test -- tests/bookDownload.integration.test.js tests/bookExport.test.js
cd ../frontend
npm.cmd run build
```

Entegrasyon testi geçici, gerçek MongoDB replica set açar; uygulamanın
veritabanına bağlanmaz. İlk çalıştırma MongoDB binary indirmesi gerektirir.
Test kapsamı: sahiplik/oturum, taslaklar, sıra, eşzamanlı yazma-silme-ekleme,
eksik bölüm, üretim hatası, boş eser, Türkçe/özel karakterler, biçimlendirme,
kayıt başarısızlığı ve kayıt sırasında yeni düzenlemeler. DOCX, bağımsız
Mammoth okuyucusuyla açılır; 80 bölüm / 12.000 paragrafın metni kaynakla
birebir karşılaştırılır. ZIP CRC ve OOXML biçim öğeleri de kontrol edilir.

Chrome'da mobil genişlikte indirme paneli, kaydedilmemiş değişiklik uyarısı,
başarısız kayıtta sıfır indirme isteği ve Türkçe dosya adıyla gerçek tarayıcı
indirmesi ayrıca doğrulandı. Word/LibreOffice masaüstü görüntülemesi bu
ortamda yapılmadı. Deploy yapılmadı.

Son toplu koşu: **196 test geçti**, başka görevin isteğe bağlı sürüm geçmişi
entegrasyon paketindeki **2 test atlandı**. Bu özelliğin 22 dosya/indirme
testinin tamamı (6 gerçek MongoDB testi dâhil) geçti. Ön yüz üretim derlemesi
başarılı; mevcut CSS `@import` sırası ve büyük bundle uyarıları devam ediyor.

## Bu iş kapsamında değişen dosyalar

- `backend/routes/works.js`, `backend/server.js`
- `backend/services/bookSnapshot.js`, `backend/services/bookExport.js`
- `backend/package.json`, `backend/package-lock.json`
- `backend/tests/bookExport.test.js`, `backend/tests/bookDownload.integration.test.js`
- `frontend/src/pages/WorkStudioPage.jsx`, `frontend/src/pages/ChaptersPage.jsx`
- `frontend/src/components/BookDownload.jsx`, `frontend/src/styles/BookDownload.css`
- `frontend/src/lib/api.js`, `frontend/src/lib/bookDownload.js`
- `backend/BOOK_EXPORT.md`

Teknik başvuru: [MongoDB snapshot](https://www.mongodb.com/docs/manual/reference/read-concern-snapshot/),
[docx Packer](https://docx.js.org/api/classes/Packer.html).
