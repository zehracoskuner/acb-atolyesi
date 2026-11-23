# Beğeni kontrolü — 9 Ekim 2026

İnceleme sırasında beğeni akışı her yerde tutarlı değildi. Eser, bölüm, yorum ve günlük beğenilerindeki sorunlar çalışma alanında düzeltildi.

## Bulunan ve düzeltilen sorunlar

| Alan | Sorun | Düzeltilen davranış |
| --- | --- | --- |
| Eser / bölüm sayacı | Bölüm işlemi eser beğenilerini sayımdan çıkarıyor; paralel sayım ve yazma eski toplamı kaydedebiliyordu. | Eserin toplamı doğrudan eser beğenileri + bölüm beğenileri olarak tek transaction içinde güncelleniyor. |
| Beğeniyi silme | Kayıt yokken bile sayaç azaltılıyordu; veritabanında negatif değer kalabiliyordu. | Tekrarlanan silme sayacı bozmaz; toplam gerçek kayıtlarla yeniden hesaplanır. |
| Tekrarlanan istek / hızlı tıklama | Toggle isteğinin tekrar gönderilmesi beğeniyi geri alabiliyor, yanıtlar ekranda yarışabiliyordu. | Tüm butonlar açık `liked` durumu gönderir, ortak işlem kilidi kullanır. Eski toggle istemcileri desteklenir. |
| Yorumlar | Atomik yazmanın yanıtı önceki okumadan hesaplanıyor; yayımlanmayan içeriğin yorumları beğenilebiliyordu. | Yanıt güncellenmiş kayıttan gelir; yayın, silinme ve okuma erişimi kontrol edilir. |
| Günlükler | Oku/değiştir/kaydet akışı eşzamanlı işlemlerde yanlış sayaç/durum döndürebiliyordu. | Beğeni dizisi tek atomik işlemle değiştirilir; bildirim yalnızca yeni beğenide çıkar. |
| Profil / öne çıkan günlükler | Bazı listelerde `likedByMe` eksik veya her zaman `false` idi. `/logs/my` dinamik rotaya takılıyordu. | İzleyicinin gerçek durumu döner; kendi günlükleri rotası erişilebilir. |
| Bölüm erişimi / akış | Yayın listesinden çıkarılan veya moderasyon bekletmesine alınan bölümler ikincil uçlardan beğenilebiliyor ve akışta görünebiliyordu. | Bölümün durumu, eserin yayın listesi ve yaş erişimi denetlenir; akış aynı sınırları uygular. |
| Bölüm silme | Silinen bölümün beğenileri ve eser toplamına katkısı kalıyordu. | Bölüm, beğenileri, yayın listesi ve toplam tek transaction ile güncellenir. |
| Arayüz | Okuyucu, eser detayı, profil, eski/yeni akış farklı mantıklar kullanıyordu. | Ortak `useLike` kullanılır; hata halinde kesin eski durum geri gelir, negatif sayı gösterilmez, aynı içeriğin kartları aynı durumu paylaşır. Geç yanıtlar başka içerik/hesaba uygulanmaz. |

Eser toplamı benzersiz beğenen kişi sayısı değildir: aynı kullanıcı eser ve farklı bölümleri ayrı ayrı beğenebilir. Bölüm ve yorum sayaçları yalnızca ilgili içeriğe aittir.

## Doğrulama

- `backend`: `node scripts/test-all.mjs` — **71 dosyada 776 test geçti**. Testler izole yerel MongoDB üzerinde çalıştırıldı; transaction testleri replica set kullanır.
- Yeni testler: `backend/tests/likes.integration.test.js` ve `backend/tests/likeState.test.js`.
- Kapsam: paralel kullanıcılar/istekler, tekrar gönderme, rollback, bildirim tekilliği, misafir okuma/yazma, yaş ve gizlilik sınırları, bölüm silme yarışı, eski istemci uyumu, arayüz hata kurtarma, geç yanıtlar ve ortak kart durumu.
- `frontend`: üretim derlemesi ve değiştirilen JavaScript/JSX dosyaları için ESLint.

## Kontrolün sınırı

Canlı site ve canlı veritabanı bu çalışmada test edilmedi; dağıtım yapılmadı. Önceden bozulmuş eser sayaçları topluca değiştirilmedi. Yeni bir beğeni ekleme/kaldırma işlemi ilgili eserin sayacını gerçek kayıtlarla onarır. Eski silinmiş bölümlere ait kayıtlar için canlı veritabanında ayrıca veri denetimi gerekir. Transaction kullanılan diğer mevcut özelliklerde olduğu gibi MongoDB replica set gerekir.
