# Adil keşif sırası

`GET /api/feed/spotlight` herkese aynı kalıcı seçimi döndürür. Normal keşif listesinin altı eser sınırı, `updatedAt`, arama ve tür filtreleri bu seçime katılmaz. Tarayıcı seçim yapmaz; MongoDB saati ve döndürülen bitiş anıyla yeniler. Başlık artık “Şimdi öne çıkan”.

## Kurallar

- Katılım: yayındaki eser + eserin yayın listesinde gerçekten kendisine ait, yayındaki en az bir bölüm.
- İlk tur: `firstPublishedAt ASC`, eşitlikte eser kimliği.
- Tur süresi: `max(30 dakika, 24 saat / eser sayısı)`; milisaniyeye yukarı yuvarlanır. 30 dakikaya ilk inişte kalıcı `minimumDurationLocked` açılır. Sonrasında eser sayısı azalsa da 30 dakika kalır. Süre yalnızca tur başında hesaplanır.
- 48 üzerindeki eserler ertesi güne taşar. Gece yarısında sıfırlama yoktur.
- Tur listesi sabittir. Gerçekten ilk kez katılan eserler yayın sırasıyla sona eklenir. Eski eserin yeniden yayına alınması ikinci bir tur hakkı doğurmaz. Geçilmiş sıra geri alınmaz; sonraki turda yeniden değerlendirilir.
- Yeni turlarda sıralama: tamamlanmış gösterim sayısı, ilgili yarım saatlerdeki geçmiş maruziyet, dönüşümlü saat hedefi, son **yeni** bölümün ilk yayın tarihi, eserin ilk yayın tarihi, kimlik. Bütün adaylar turda tam bir yer alır; geçmiş açığını kapatmak için ekstra gösterim verilmez.
- Sabit 24 eser / saatlik düzende saat hedefleri 05 → 17 → 06 → 18 → 07 şeklindedir. Sabit 48 eserde adım 30 dakikadır. Eser sayısı, katılım veya kesintiler değiştiğinde bu kesin saat dizisi korunamaz; geçmişe göre saat dengesi önceliği korunur. Mevcut tur, saatleri düzeltmek için yeniden sıralanmaz.
- Her eser için 48 dilimin hem gösterim adedi hem gerçek süre toplamı tutulur. Kısmi dilimler orantılı kaydedilir. Yayından kaldırma tamamlanmış gösterim sayılmaz; o ana kadar kaydedilmiş süre silinmez.

## Kalıcılık ve işletim

`SpotlightRotation` tek sıra belgesi, `SpotlightHistory` eser başına kalıcı hafıza, `SpotlightShowing` biten/kesilen gösterimlerin denetim kaydıdır. Kullanıcıya bunları silme/sıfırlama uç noktası verilmez. Yayından kaldırmak geçmişi silmez.

Başlangıçta `prepareSpotlight`, ardından 10 saniyelik worker çalışır. Ziyaretçi olmasa da sıra ilerler. API, bitiş sınırında worker'ı beklemeden aynı geçişi tetikleyebilir. İşlem içi birleştirme ve MongoDB transaction içinde ortak belge yazma kilidi, birden fazla sunucunun aynı gösterimi iki kez bitirmesini engeller. Replica set gerektirir; uygulamanın mevcut transaction altyapısını kullanır.

Saat MongoDB `hello.localTime` üzerinden alınır. Kayıtlar UTC, gün içi dilimler İstanbul (UTC+03:00) saatidir. İşçi 60 saniyeden fazla çalışamazsa aradaki süre gösterilmiş kabul edilmez; aynı eserin kalan süresi kesintiden sonra tamamlanır. Geciken geçişte yeni gösterim geriye tarihlenmez, tam süre alır. Bu ölçüm yayın servisinin erişilebilirlik süresidir; tek bir okurun ekranda geçirdiği süre veya bağımsız bir uçtan uca uptime ölçümü değildir.

## Yayın tarihleri ve eski kayıtlar

`Chapter.firstPublishedAt` ilk başarılı yayın kaydında DB saatiyle oluşturulur; aynı bölümü düzenlemek veya yeniden yayınlamak bunu değiştirmez. Bölüm kaydından sonra eserin `firstPublishedAt` minimum, `lastPublishedChapterAt` maksimum ilk bölüm yayın tarihi olarak güncellenir. Yayın isteği bu alanları kullanıcıdan kabul etmez.

Eski kayıtlarda kesin ilk yayın geçmişi yoktur. Bir defalık başlangıç işlemi halen yayındaki bölümlerde önce mevcut inceleme tarihini, yoksa oluşturma tarihini kullanır; `publicationDateEstimated=true` ile işaretler. Geçmişte yayından kaldırılmış ve hakkında yayın bilgisi bulunmayan bölümlerin eski yayın anı yeniden üretilemez. Başlangıç sırası bu eski kayıtlar için tahminidir; yeni yayınlarda gerçek DB saati kullanılır. Canlı veriler geliştirme/test sırasında değiştirilmez; dönüşüm sunucu yeni sürümle başlatıldığında çalışır.

Denetim için eser kimliğiyle `SpotlightHistory` ve `SpotlightShowing` sorgulanabilir. Yönetim paneli arayüzü bu değişikliğe dahil değildir.

## Doğrulama

`npm test -- tests/spotlightSchedule.test.js tests/spotlight.integration.test.js tests/spotlightSync.test.js`

Entegrasyon testleri izole, geçici MongoDB replica set kullanır; uygulamanın `.env` veritabanına bağlanmaz.
