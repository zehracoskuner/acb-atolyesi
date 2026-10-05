# Okuma erişimi

- `GET /api/public/works/:id`: Yayındaki eserin açıklaması, önsözü ve açık metadata alanları. Misafire açıktır; evren kuralları, temalar ve özel notlar dönmez.
- `GET /api/public/works/:id/chapters`: Yalnızca `_id`, `title`, `order`. Bölüm hem eserin yayın listesinde hem yayında olmalı ve o esere ait olmalıdır.
- `GET /api/public/works/:id/chapters/:chapterId`: Cookie veya Bearer oturumu zorunludur. Eser ve bölüm yayında olmalı, bölüm doğru esere ve yayın listesine ait olmalıdır. Yanıt yalnızca seçilen bölümün kimliği, başlığı, sırası ve tam metnidir.
- `/api/chapters` ve `/api/works/:id/chapters`: Yazarın düzenleme listeleri tam metin içermez. Eserin yayın ayarları için ikinci liste ayrıca bölüm durumunu içerir. Editör, tam belgeyi yazar doğrulaması yapan `/api/chapters/:id` üzerinden alır.
- Personel genel okuma yollarından taslak okuyamaz. Mevcut moderasyon kuyruğu, inceleme bekleyen bölümleri yetkili personele sunar.
- Çalışma notları ve beat yolları giriş ve eser sahipliği gerektirir.
- Oturum kullanılan yanıtlarda `Cache-Control: private, no-store` ve `Vary: Cookie, Authorization` bulunur.

Frontend seçilen bölümü ayrıca yükler. Giriş dönüş adresi sekmenin `sessionStorage` alanında saklanır; normal giriş, Google dönüşü ve profil tamamlama sonrasında kullanılır. Yalnızca aynı sitedeki göreli adresler kabul edilir.

Doğrulama: `npm.cmd test --prefix backend` ve `npm.cmd run build --prefix frontend`. HTTP testleri gerçek Express rotalarını ve JWT doğrulamasını kullanır; veritabanı ve dış servisler izoledir.
