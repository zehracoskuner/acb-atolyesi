# Telif başvurusu akışı

Mevcut Report koleksiyonu ve /api/reports kullanılır. Yeni şikâyet koleksiyonu veya canlı veri dönüşümü yoktur. Mükerrer başvuru indeksi değişmedi; itirazlar aynı belgenin appeals alanına eklenir.

## Kullanım ve yetki

- Eser/bölümde “Eserim izinsiz paylaşılmış” mevcut ReportModal'ı telif seçili açar. Özgün eser bağlantısı/açıklaması ve gerekçe zorunludur. Hedef içerik ekrandan alınır.
- /basvurular: başvurularım ve içeriğim hakkındaki kararlar; 50 kayıtlık sayfalama, ayrıntı, tarihlenmiş geçmiş, ek bilgi yanıtı ve gerekçeli itiraz.
- Yönetici panelindeki mevcut Şikayetler > Detay: inceleme başlatma, ek bilgi isteme, özel not, gerekçeli karar ve itiraz kararı.
- 5 Ekim 2026 yetki kararı: Moderatör telif dosyalarının listesini, ayrıntısını ve kanıtlarını okuyabilir; telif akışını yalnız admin yönetir ve karara bağlar. Moderatör diğer yorum şikâyetlerini yönetebilir. Taraf olan admin kendi dosyasında karar veremez.
- Başvuran kendi beyanlarını/geçmişini görür. İçerik sahibi ilk karar sonrasında yalnızca ortak geçmişi, kararları ve kendi itirazını görür. İletişim bilgileri, özel kanıt, diğer tarafın itiraz metni ve adminNote kullanıcı yanıtlarında bulunmaz.

## Durum ve karar

received → reviewing → awaiting_information → reviewing → decided.

decided → appeal_review → decided. Aynı karara her taraf bir kez itiraz edebilir; iki tarafın itirazı aynı incelemede toplanır. Her yeni gerekçeli karara yeniden itiraz mümkündür.

Karar sonucu (upheld/dismissed/inconclusive) ve uygulanan işlem (none/notice) ayrıdır. notice dosyada kayıtlı uyarıdır; User.warnings veya hesap cezası değildir. Karar içerik silmez, hesabı cezalandırmaz ve AI çağrısı yapmaz.

Her mutasyon revision değerini taşır. MongoDB koşullu tek-belge güncellemesi karar, geçmiş ve sürümü birlikte kaydeder; çakışan yazı 409 döner. Bildirimler kayıttan sonra oluşturulur. Bildirim teslim edilemese de karar /basvurular ekranından erişilebilir; otomatik bildirim yeniden deneme kuyruğu eklenmedi.

Eski pending → Alındı, resolved/dismissed → Karar verildi olarak okunur. Eski kayıt için olmayan kanıt/gerekçe uydurulmaz. Karar dizisi bulunmayan eski kayıtlar için ekranda gerekçe bulunmadığı belirtilir; yeni akışta bildirilen kararlar itiraza açılır.

## Kanıt

Başvuruda yerel yayındaki eser/bölüm/yorumun metni, kimliği, mevcut güncelleme/sürüm bilgisi ve alınma zamanı Report.evidenceSnapshot içinde tutulur. Varsayılan sorgudan çıkarılır; yalnızca yetkili personel ayrıntı uç noktası seçer. Eser silinirken rapor silinmez. Büyük eserlerde 8 MiB sınırı aşılırsa ilgili bölümden başvuru istenir. Dış bağlantılar metin olarak saklanır, sunucudan ziyaret edilmez. Arayüz ACB'nin dış sitelerde içerik kaldıramayacağını belirtir.

## Tek yönlendirici

admin.js içindeki eski tekrarlı rapor uçları adminReports yönlendiricisine bağlandı. /api/admin/reports genel admin bağlamasından önce bağlanır; özel admin yolu da aynı denetimleri kullanır. Eski resolve/dismiss/warn/comment kısayolları telif dosyalarında engellenir. Başka bir yorum şikâyetindeki toplu kapatma telif dosyasını kapatmaz.

## Doğrulama

backend altında: `npm.cmd test -- --run tests/reportWorkflow.integration.test.js`

7 HTTP/MongoDB entegrasyon testi geçti: başvuru ve mükerrerlik, takip, ek bilgi, gerekçe zorunluluğu, iki tarafın itirazı, yetkisiz erişim, gizlilik, eşzamanlı karar, bildirim hatası, kanıtın düzenleme sonrası korunması, eski durumlar, özel admin yolu ve diğer yorum şikâyetlerinin regresyonu.

Test geçici loopback MongoMemoryServer kullanır; .env veya canlı Mongo URI okunmaz. Yerelde bulunan backend/node_modules/.cache/mongodb-binaries/mongod-x64-win32-7.0.14.exe kullanıldı. Testteki açık Vitest giriş yolu kurulu Windows sürümünün bare-import çözümleme hatasını aşar.

Frontend üretim derlemesi ve ReportModal, ReportCase, ReportsPage, useReport, main için ESLint geçti. Derleme mevcut CSS @import sırası ve büyük paket uyarıları veriyor. Tarayıcı üzerinden uçtan uca görsel test yapılmadı.

## Bu görevde değişen dosyalar

Backend: models/Report.js, models/Notification.js; routes/reports.js, routes/adminReports.js, routes/admin.js; server.js; services/reportWorkflow.js (yeni), services/notificationService.js; tests/reportWorkflow.integration.test.js (yeni); REPORT_WORKFLOW.md (bu dosya).

Frontend: components/ReportModal.jsx, components/ReportCase.jsx ve ReportCase.css (yeni), components/TopBar.jsx; hooks/useReport.js; pages/ReportsPage.jsx (yeni), pages/AdminPanel.jsx, pages/ModeratorPanel.jsx, pages/StoryDetailsPage.jsx, pages/Read.jsx, pages/Bildirimler.jsx; main.jsx.

routes/moderator.js incelendi; telif kararları buraya eklenmedi. WorkReadPage mevcut Read dışa aktarımı üzerinden aynı başvuru işlemini alır. Çalışma alanında önceden bulunan diğer değişiklikler korunmuştur. Deploy ve canlı veri dönüşümü yapılmamıştır.
