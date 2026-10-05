# Çizim kaydı doğrulaması

Kurulu tldraw 4.5.10 korunur. Eski store snapshot'ları ve document/session
snapshot'ları desteklenir. Şekil düzenleme, silme ve Unicode karakter şekilleri
gerçek tldraw store/schema ile test edilir.

Kayıtlar eser bazında sıraya girer. Sunucu expectedRevision ile atomik sürüm
denetimi, mutationId ile tekrarlanabilir kayıt kullanır. Her Cloudinary yüklemesi
ayrı dosyadır; önceki dosya yalnızca veritabanı onayından sonra temizlenir.
Belirsiz veritabanı hatasında dosya silinmez; bakım gerektiren sahipsiz dosya
kalabilir. Yetkilendirme her istekte korunur.

Yerel taslak kullanıcı/eser/düzenleme oturumu bazında ayrılır. Her değişiklikte,
1,2 saniyelik otomatik kayıt beklenmeden yazılır. Son yerel taslak açık kullanıcı
seçimiyle kurtarılır; diğer oturumların taslakları silinmez. Tarayıcı kotası
dolarsa görünür uyarı ve SPA geçişleri için bellek yedeği vardır. Kalıcı tarayıcı
depolaması çalışmıyorsa tarayıcı kapanışı sonrası kurtarma garanti edilemez.

Yeni snapshot sınırı UTF-8 olarak 9 MiB; JSON gövdesi sınırı 10 MiB'dir.
Eski büyük çizimler okunabilir. shared/drawingProtocol.js dağıtıma dahil edilmelidir.
Gerçek Cloudinary hesabının raw yükleme kotası ayrıca doğrulanmalıdır.

Backend dizininde:

```
npx.cmd vitest run tests/drawingController.test.jsx tests/drawingRoutes.test.js tests/drawingPersistence.test.js tests/drawingSnapshot.test.js tests/cloudinaryDrawing.test.js
```

23 test geçti. Kapsam: yükleme hata kapısı, geç yanıtlar, boş yeni çizim,
anında taslak, kayıt sırasında düzenleme, hata/tekrar, onay denetimi, sürüm
çatışması, eser/oturum ayrımı, kota, boyut, yetki, eşzamanlı ilk kayıt ve silme.
Controller testleri hook/editor taklidi; HTTP testleri gerçek Express ile
MongoDB/Cloudinary taklidi; depolama testi Cloudinary transport taklididir.
Gerçek Cloudinary/MongoDB ve oturum açılmış tarayıcı uçtan uca testi yapılmadı.

Frontend derlemesi ve değişen çizim istemci dosyalarının ESLint kontrolü geçti.
Mevcut tur CSS import sırası ve büyük paket uyarıları kapsam dışında bırakıldı.
Ek chapterSave.test.js çalıştırması mevcut session.js dosyasının Node ortamında
window kullanması nedeniyle import aşamasında durdu; bu dosyalar değiştirilmedi.
