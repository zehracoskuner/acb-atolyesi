# Yaşa göre yetişkin içerik erişimi

- Sabit eşik: `birthYear <= 2007`; 2008 ve sonrası, misafirler ve yılı bilinmeyen hesaplar yetişkin eserlere erişemez.
- Mevcut `contentWarning` tercihi Work şemasında Boolean olarak saklanır. Yeni Work/User modeli oluşturulmadı.
- Profil tamamlama doğum tarihi yerine yalnızca yıl alır. Yılı eksik mevcut hesaplar da bu adıma yönlendirilir; tamamlanan yıl aynı API üzerinden değiştirilemez.
- `readerAccess` kimliği veritabanından doğrular ve AsyncLocalStorage ile isteğe bağlar. Work sorgu middleware'i liste, count, distinct, populate ve aggregate okumalarını filtreler. Akıştaki MongoDB lookup sorguları ayrıca filtrelenir. Chapter, alıntı ve okuma ilerlemesi okumaları da ilişkili esere göre korunur.
- Arka plan görevleri okuyucu kapsamı dışında çalışır. Spotlight rotasyonu bütün eserler üzerinde kalır, yanıt okuyucunun yaşına göre filtrelenir. Okuyucu yanıtları `private, no-store` kullanır.
- İlk okuma `428 MATURE_ACKNOWLEDGEMENT_REQUIRED` döndürür. İstemci küçük modalı gösterir; Devam et sunucuda User.matureAcknowledgements alanına `$addToSet` ile workId kaydeder. Kimlik body'den alınmaz. Sonraki oturumlarda aynı kullanıcı ve eser için tekrar onay gerekmez.
- Kartta, başlıkta ve ön incelemede yetişkin içerik etiketi gösterilmez. Onay bölüm metni alınmadan kontrol edilir; doğrudan okuyucu URL'si de aynı kontrolü kullanır.
- Eski düzenleme akışında alan şemada olmadığı için geçmişte kaydedilmemiş tercihler otomatik çıkarılamaz. Yazarın mevcut içerik tercihini yeniden kaydetmesi gerekir; ham veritabanında zaten bulunan `contentWarning: true` kayıtları korunur.

Doğrulama: `npx.cmd vitest run tests/matureAccess.integration.test.js tests/termsAcceptance.test.js tests/feed.integration.test.js tests/chapterAccess.test.js tests/guestRoutes.test.js` ve frontend `npm.cmd run build`.
