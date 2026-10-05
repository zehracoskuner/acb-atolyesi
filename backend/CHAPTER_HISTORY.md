# Bölüm kaydı ve geçmişi

## Manuel checkpoint

`POST /api/chapters/:id/checkpoint`, `expectedRevision` ve isteğe bağlı en fazla
80 karakterlik `label` alır. Eser sahipliği ve güncel revision doğrulanır.
Mevcut ChapterVersion belgesinde yalnızca `isCheckpoint` ve `label` güncellenir;
bölüm içeriği, revision, yayın durumu ve kayıt zamanı değiştirilmez. Eski bir
bölümün henüz snapshot'ı yoksa aynı transaction içinde mevcut kayıtlı metnin
baseline sürümü oluşturulur. Tekrar işaretlemek yeni bir sürüm üretmez.

İstemci önce mevcut güvenli save akışını bekler. Kayıt sırasında yeni düzenleme
olmuşsa veya conflict/recovery varsa checkpoint oluşturmaz. Sürümler panelindeki
geri yükleme aynı revision kontrollü restore akışını kullanır.

PUT /api/chapters/:id gövdesi `expectedRevision`, `title`, `content` alır.
Eksik/geçersiz sürüm 400; eski sürüm 409 ve sahibine `current` döndürür.
Başarı yanıtı `item`, `revision`, `savedAt` içerir. Aynı içerik tekrar
gönderildiğinde yeni sürüm veya yeni kayıt zamanı üretilmez.

Kayıt, değiştirilmeyen ChapterVersion belgeleri ve yayından kaldırma aynı
MongoDB transaction içinde, majority write concern ile tamamlanır. Replica set
veya transaction destekleyen sharded cluster gerekir. Standalone veritabanında
işlem başarısız olur; transaction olmadan kaydetmeye geri dönüş yapılmaz.
Yeni koleksiyonun `{ chapter: 1, revision: -1 }` unique indeksinin kurulması
gereklidir. Canlı bağlantı/topoloji/indeksler bu çalışma sırasında doğrulanmadı.

Yeni bölüm ile ilk sürümü aynı transaction içinde oluşturulur.
Eski bölümler sürüm 0 kabul edilir. İlk değişiklik sırasında eski içerik de
aynı transaction içinde korunur; geçmişe dönük toplu veri işlemi yoktur.
Sürüm listesi 50 kayıtlık sayfalarla okunur (`before`); okuma ve geri yükleme
eser sahibiyle sınırlıdır, personel rolü bu yetkiyi sağlamaz.
Geri yükleme mevcut sürümü korur, yeni taslak sürüm oluşturur ve inceleme
alanlarını temizler. Mevcut metinle aynı sürümü geri yüklemek gereksiz kopya
üretmemek için reddedilir. Otomatik silme/TTL politikası eklenmedi.

İstemci her isteğin yerel düzenleme sayacını ve kayıt sürümünü izler. Yeni
yazılan metin eski yanıtla temizlenmez. 409 sonrası kullanıcı karşılaştırma
yapmadan otomatik kayıt devam etmez. Yerel taslak anahtarları kullanıcı/eser/
bölüm/düzenleyici bazındadır; başka sekmenin taslağı temizlenmez. Yerel taslak
sunucu metninin üzerine kendiliğinden uygulanmaz. Tarayıcı depolaması kapalı
veya doluysa arayüz bunu bildirir. Yerel kopyalar şifreli bir kasa değildir;
aynı tarayıcı profilinin depolama alanında tutulurlar.

## Yedekleme sınırı

Sürüm geçmişi aynı veritabanında bulunur; bağımsız yedek değildir. Depoda
mongodump, zamanlanmış veritabanı yedeği veya doğrulanmış geri dönüş tatbikatı
bulunamadı. Eser indirme işlevi metin dışa aktarımıdır; bütün veritabanının
yedeği değildir. Barındırma sağlayıcısının yedek ayarlarına erişilmedi;
kurtarma süresi veya veri kurtarma garantisi verilmez. Canlı veri işlemi ve
deploy yapılmadı.

## Testler

`npm test` izole route, istemci kayıt ve yerel taslak testlerini çalıştırır.
İzole transaction taklidi rollback akışını sınar; gerçek MongoDB atomikliği
iddiasının yerine geçmez. Gerçek entegrasyon için yalnızca yerel replica set:

```powershell
$env:CHAPTER_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'
npm test -- tests/chapterHistory.integration.test.js
```

Bu test `.env`/uygulama bağlantısını okumaz; rastgele `acb_chapter_test_*`
veritabanı oluşturup yalnızca kendi test veritabanını temizler. Değişken
tanımlı değilse üç entegrasyon testi açıkça atlanır. Bu çalışma sırasında
geçici yerel MongoDB 7.0.14 replica set üzerinde üç test de geçti: eşzamanlı
kayıt/geri yükleme, ilk sürümle birlikte oluşturma ve sürüm yazımı hatasında
gerçek transaction rollback. Bu sonuç canlı ortam topolojisini doğrulamaz.

## Geçmiş arayüzü ve gelişim hazırlığı

UI teknik numaraları göstermez. “Bu anı sakla”, önce normal save receipt ile
doğrulanan metni kaydeder; ardından aynı ChapterVersion üzerinde isCheckpoint
ve label metadata alanlarını günceller. Aynı HTML için ikinci snapshot oluşmaz.
“Bu metinden devam et” önce mevcut taslağı korur, expectedRevision ile restore
eder; yeni snapshot restoredFromRevision ve geriye uyumlu restoredFrom taşır.

Güncel yayın notu: kullanıcıya açık Geçmiş/sürüm özelliği
`shared/features.js` içindeki `CHAPTER_HISTORY_ENABLED=false` ile kapalıdır.
Geçmiş düğmesi ve drawer gösterilmez; versions/checkpoint/restore API işlemleri
404 döner. İç snapshot/revision kayıt güvenliği korunur. Aşağıdaki mimari
açıklamalar kodun gelecekte yeniden kullanılabilmesi için tutulmuştur.

GET /api/chapters/development/:workId yalnızca eser sahibine uygunluk döndürür.
Work üzerinde developmentNewWords, developmentInitializedAt,
lastDevelopmentAnalysisAt, lastDevelopmentWordCheckpoint,
developmentAnalysisCount ve eligibleForDevelopmentReview tutulur.
Yeni eser sıfırdan başlar. Eski eser ilk erişimde, değişiklik uygulanmadan önce,
kayıtlı bölüm metinleri üzerinden bir kere başlatılır; 20.000 kelime de tek
uygunluk üretir. Bu geçmiş veride yazım/import kaynağı bilinmediği için yalnız
bu ilk eski-eser başlangıcı toplam metni kullanır.

Normal/odak/karşılaştırma editörleri uygun input olaylarındaki pozitif
kelime artışlarını toplar. Paste/drop sayılır; undo ve programatik yüklemeler sayılmaz.
IME kompozisyonu bitince bir kez hesaplanır. PUT eligibleWordDelta gönderir;
geçerli receipt yalnız gönderilen snapshot sayacını onaylar. Sunucu artışı
Chapter + ChapterVersion + Work transaction içinde uygular. Stale, başarısız,
aynı metinli kayıt ve restore sayılmaz; eşzamanlı farklı bölüm kayıtları Work
yazımıyla serileşir. Silme sayacı azaltmaz. Uygunluk 3000’de hazır olur ve
yalnız başarılı gelişim analizi checkpoint'i ilerletebilir.

Input kaynağı bir UX sinyalidir, sahteciliğe dayanıklı bir ölçüm değildir.
Kaynağı bilinmeyen kurtarılmış taslaklar ve çakışma çözümü tekrar sayılmaz;
bu durumlarda kelimeler eksik sayılabilir, fakat metin kurtarma korunur.
Gelişim Koçu altyapısı ve başarı transaction'ı için DEVELOPMENT_COACH.md belgesine bakın.
Nihai prompt beklenirken endpoint yalnız bağlam hazırlar, hak tüketmez.
