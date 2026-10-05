# Web oturumları

Giriş ekranındaki “Oturumu açık tut” varsayılan olarak kapalıdır ve Google girişinde de uygulanır.

- Açık: girişten itibaren 30 gün; tarayıcı yeniden açıldığında korunur.
- Kapalı: kalıcı olmayan çerez; sunucuda en fazla 12 saat. Tarayıcıların oturum geri yükleme özelliği çerezi geri yükleyebilir; 12 saat sınırı yine geçerlidir.
- Çerez: `HttpOnly`, `SameSite=Lax`, `Path=/`, üretimde `Secure`. Üretimde HTTPS ve frontend/API için aynı site yerleşimi gerekir; farklı sitelerde üçüncü taraf çerez politikaları girişi engelleyebilir.
- MongoDB `AuthSession` koleksiyonunda rastgele oturum kimliğinin SHA-256 özeti saklanır. TTL indeksi temizlik içindir; her istekte bitiş tarihi ayrıca denetlenir. Sunucu yeniden başlatılması oturumu kaybettirmez.
- Çıkış mevcut cihazın oturum kaydını siler. Şifre değişimi/sıfırlaması, parola özetiyle bağlı tüm web/native oturumlarını geçersiz kılar. Web üzerinde yeniden giriş mevcut cihazın oturumunu değiştirir.
- Google OAuth tercihi 10 dakikalık imzalı çerez ve tarayıcıya bağlı state ile taşınır. Kimlik bilgisi callback URL'sine veya yeni web girişlerinin JSON yanıtlarına konmaz.
- Yeni web girişleri localStorage/sessionStorage tokenlarını temizler; profil tamamlama yeni bir bağımsız token üretmez. Sekmeler giriş/çıkış değişikliklerini tekrar sunucudan doğrular.

Oturum sözleşmesi: sid içermeyen eski JWT'ler cookie ve Bearer taşımasında reddedilir (401); tekrar giriş gerekir. Varsayılan login/OTP akışı web cookie session'dır. Native istemci açıkça `client: "native"` gönderir; Google native için `/google/mobile` kullanılır. Native token 12 saat geçerli, rastgele sid ile aynı AuthSession kaydına ve parola fingerprint'ine bağlıdır; JSON credential'ı cookie'ye yazılmaz. Logout cookie önceliğiyle mevcut credential'ı, native için Bearer credential'ı iptal eder. Profil tamamlama mevcut session'ı korur, yeni token üretmez. Parola değişimi/sıfırlama/eski parolasız hesaba parola belirleme bütün eski fingerprint'e bağlı session'ları geçersiz kılar. Frontend forgetSession/logoutSession sunucu iptalini bekler; hata halinde çıkışı başarılı saymaz. 401 alındığında yalnız geçersiz yerel state temizlenir. Mobil yenileme akışı ayrı tasarlanmalıdır; legacy bypass yoktur.

Güvenlik referansı: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
