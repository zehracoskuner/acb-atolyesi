# Yazar Gelişim Koçu — altyapı raporu

## Geçici beta kalkanı

`shared/features.js` → `DEVELOPMENT_COACH_LAUNCH_ENABLED=false`. Ayarlarda kalkan
ikonlu Beta / Çok yakında kartı, Bölümler araçlarında pasif beta öğesi görünür.
İlk giriş sorusu, açma kontrolleri, analiz/arşiv/son analiz girişleri ve durum
polling'i devre dışıdır. Analiz API'leri ve doğrudan servis çağrısı, provider'a
ve kayıt/kota işlemine ulaşmadan `DEVELOPMENT_COMING_SOON` döner. Tercih açma
PATCH'i de engellenir; kapatma ve saklanan tercih okunması korunur. Veritabanı
kayıtları ve altyapı silinmez. Karakter Arkı'nın mevcut consent/provider akışı
değişmez. Gelecekte açmak için launch flag ayrı olarak etkinleştirilmelidir;
yalnız env'de enabled=true yapmak bu kalkanı aşmaz.

## Güncel production provider — 4 Ekim 2026

Yalnız Development Coach varsayılanı OpenAI'ye geçirildi. Seçim:
`DEVELOPMENT_COACH_PROVIDER=openai`, `DEVELOPMENT_COACH_MODEL=gpt-6-luna`,
`DEVELOPMENT_ANALYSIS_TIMEOUT_MS=90000`. `OPENAI_API_KEY` gerekir. Reasoning
`low` sabittir; `store=false`, SDK logları kapalı ve otomatik retry/fallback yok.
Provider/model env üzerinden açıkça değiştirilebilir; bilinmeyen provider veya
geçersiz model/timeout ayarı kapalı biçimde hata verir. Gemini adapterı korunur.
`GEMINI_MODEL` Karakter Arkı için bağımsız kaldı. Sahne Panosu AI launch flag'i
`PLOTWORLD_SCENE_AI_ENABLED=false` olarak korundu.

Mevcut prompt ve strict JSON/local validator kullanılır. Consent, 3000 yeni
eligible kelime, kayan 24 saatte iki başarı, kullanıcı kilidi, idempotency ve
başarı checkpoint transaction'ı korunur. Refusal/timeout/provider hatası analiz
kaydı veya hak tüketimi oluşturmaz. UI'ya çıkan hata mesajları provider/model
adı içermez. Kullanıcı metni veya analiz içeriği loglanmaz.

Doğrulama: production seçim yolunda gerçek OpenAI çağrısı, yapay 3000 kelimeyle
STOP/completed ve geçerli baseline üretti (11526 input / 1206 output token).
İzole MongoDB testleri varsayılan OpenAI yolu için başarı, refusal ve timeout'u
SDK transportuyla çalıştırdı; kayıt/checkpoint/kota ve kilit durumları doğrulandı.
Tam tur: 56 dosya, 586 test geçti, önceden görülen 3 kapsam dışı hata kaldı
(`guestRendering`, `tourLayout`, `feedbackAndQueues`). Karakter Arkı ve launch
flag kontrolleri geçti. Frontend production build başarılı; mevcut bundle
büyüklüğü uyarısı sürüyor. Yerel sunucu yeni ayarla yeniden başlatıldı.
Uzak canlı dağıtım veya uzak ortam değişkeni güncellemesi yapılmadı; deployment
ortamında yukarıdaki değişkenler ve OpenAI anahtarı uygulanmalıdır.

Aşağıdaki ayrıntılar önceki uygulama ve karşılaştırma geçmişini de içerir.

## Açık onay, ayarlar, not arşivi ve sürümler

- `User.settings.developmentCoach`: `undecided` (varsayılan), `enabled`, `disabled`.
  Eski kullanıcılar da kendiliğinden izinli sayılmaz. İlk Bölümler girişinde kısa
  tanıtım ve Evet/Hayır seçimi bir pencerede görünür. Başarılı seçimden sonra
  pencere kapanır; sonraki girişlerde ve üst barda hatırlatma gösterilmez.
  Tercih sunucuya kaydedilir; Ayarlar'da
  aynı bileşen üzerinden değişir ve açıklayıcı geri bildirim verilir.
- `GET/PATCH /api/user/development-coach` yalnız oturum sahibinin tercihini okur/yazar.
  Analiz servisi izin yoksa 403 döner; istemci düğmesini gizlemekle yetinmez.
  Provider öncesi ve sonrası yeniden kontrol edilir. Devam eden istek sırasında
  kapatma 500 ms aralıkla kontrol edilir ve transport abort edilir. Daha önce
  izinliyken sağlayıcıya gönderilmiş verinin geri alınabildiği iddia edilmez.
- Paste/drop metinleri mevcut eligible katkı ve örneklem akışına dahildir.
  Prompt, metnin klavyeyle mi yapıştırılarak mı girildiğine göre ayırım yapmaz;
  kullanıcının promptuna ek ölçüt eklenmedi. Tekrar içerik koruması devam eder.
- Koç açıkken ve en az bir analiz varsa sol bölüm panelinin altında
  **Gelişim koçu notlarım** bulunur. Kapalıyken veya ilk analizden önce alan
  ayrılmaz. Yeniden açıldığında eski notlar tekrar görünür. Sonuçlar ayrı
  koleksiyonda birikir; yenilemede ve koç kapatıldığında kaybolmaz. Arşiv okuması
  AI çağırmaz. `GET /api/chapters/development/:workId/analyses` sahiplik kontrolüyle
  20'şer kayıt ve sequence cursor kullanır. Farklı eser/kullanıcı notları karışmaz.
- Geçmiş/sürüm özelliği `shared/features.js` içindeki
  `CHAPTER_HISTORY_ENABLED=false` ile arayüzde ve public API'de kapalıdır.
  Listeleme, önizleme, checkpoint ve restore 404 döner. Kodlar korunur.
  İç revision/snapshot yazımı autosave, çatışma ve tekrar-sayım güvenliği için
  sürer; kullanıcının erişebildiği sürüm özelliği çalışmaz.

Yeni dosyalar: `shared/features.js`, `services/developmentConsent.js`,
`DevelopmentCoachPreference.jsx`, `DevelopmentCoachArchive.jsx`,
`tests/developmentPreferences.test.js`. User modeli, user/chapter route'ları,
koç servisi/provider, Ayarlar, ChaptersPage, CSS ve ilgili testler güncellendi.

Kullanıcının sağladığı nihai prompt, metni korunarak JavaScript sabitine alındı.
`writer-development-v1` prompt sürümü ve verilen JSON şemasına uygun validator
Seçilen adapter'a bağlandı. Feature flag kapalıyken yalnız `prepared` yanıtı
döner; açıkken doğrulanmış sonuç atomik olarak kaydedilir ve kullanıcıya gösterilir.

## Prompt entegrasyonu — güncel kullanım

Backend ortamında `DEVELOPMENT_COACH_ENABLED=true`, `OPENAI_API_KEY`,
`DEVELOPMENT_COACH_PROVIDER=openai`, `DEVELOPMENT_COACH_MODEL=gpt-6-luna`
ayarlanır. `DEVELOPMENT_ANALYSIS_TIMEOUT_MS=90000` varsayılandır
(1000–180000 ms). Yerel `.env` ve çalışan servis güncellendi; uzak deployment
ayarları değiştirilmedi. Gerçek sağlayıcı çağrısı yapay test örneğiyle doğrulandı.

Sistem promptu OpenAI `instructions` (Gemini seçilirse `systemInstruction`),
eser/metin/önceki profil verisi ayrı user
JSON içeriğidir. `comparison` iç modu prompta `progress` olarak aktarılır.
Önceki snapshot yanında son değerlendirmenin özet/kanıt/odak bilgisi gönderilir.
Kullanıcı kimliği ve eser/bölüm kimlikleri sağlayıcıya gönderilmez.

Provider structured JSON ister; yerel validator zorunlu alanları, tipleri,
confidence değerlerini, mod eşleşmesini ve 5/4/3 trait, 2 odak sınırlarını
doğrular. Fazladan alanlar, eksik JSON, yarıda kesilmiş ve engellenmiş yanıtlar
başarı sayılmaz. String/liste/input/output boyut sınırları uygulanır. Semantik
kanıt doğruluğunu validator'ın garanti ettiği iddia edilmez.
Timeout transport AbortSignal ile uygulanır; otomatik retry yoktur.
SDK hata metinleri ve kimlik bilgileri istemciye aktarılmaz.

`GET /api/chapters/development/:workId/latest` yalnız eser sahibine son sonucu
döndürür, AI çağırmaz. Başarılı POST da kaydedilmiş sonucu döndürür. Sonuç ekranı
ses özellikleri, değişimler ve en fazla iki odağı gösterir; confidence ve dahili
profileSnapshot gösterilmez. Metinler React ile escape edilir. Sonuç Araçlar →
Son gelişim değerlendirmesi yolundan tekrar açılır. Başarı sonrası eligibility
sıfırlanabilir; önceki analiz döneminden geciken save receipt düğmeyi geri açamaz.

Bu entegrasyonda eklenen dosyalar: `services/developmentResult.js`,
`../frontend/src/components/DevelopmentCoachDialog.jsx`,
`../frontend/src/styles/DevelopmentCoach.css`, `tests/developmentProvider.test.js`,
`tests/developmentRendering.test.jsx`, `tests/fixtures/developmentResult.js`.
Provider, prompt, coach servisi, status/route, ChaptersPage, env örneği ve ilgili
testler de güncellendi. Aşağıdaki dosya listesi ilk altyapı kurulumunu da kapsar.

## Dosyalar

Yeni:
- `config/development.js`: merkezi 3000 eşiği, günlük başarı limiti ve feature flag.
- `models/DevelopmentAnalysis.js`: ayrı başarılı analiz koleksiyonu.
- `models/DevelopmentGate.js`: kullanıcı genelinde kalıcı kilit ve kota zamanı.
- `models/DevelopmentFingerprint.js`: eser kapsamında normalize metin hash'leri.
- `models/DevelopmentSample.js`: revision kaynaklı katkı örnekleri/checkpoint aralığı.
- `services/developmentWriting.js`: sunucuda katkı kabulü ve tekrar koruması.
- `services/developmentCoach.js`: doğrulama, bağlam, provider ve atomik başarı akışı.
- `services/developmentProvider.js`: tek Gemini adapter ve konfigürasyon noktası.
- `prompts/writerDevelopmentCoach.js`: kullanıcı promptu, sürüm ve validator export'u.
- `tests/developmentCoach.integration.test.js`: gerçek yerel replica-set testleri.
- Bu rapor.

Güncellenen:
- `models/Chapter.js`: bölümün ömür boyu en yüksek kelime sayısı.
- `services/developmentProgress.js`: türetilen uygunluk ve 3000 eşiği.
- `services/chapterHistory.js`: aynı kayıt transaction'ında katkı kabulü.
- `routes/chapter.js`: `eligibleWordDelta`, gelişim POST endpoint'i ve AI limiter.
- `../frontend/src/pages/ChaptersPage.jsx`: input kaynağı, receipt sayacı, hazırlık UI.
- `tests/chapterSave.test.js`, `tests/chapterHistory.integration.test.js`,
  `tests/chapterAccess.test.js`: yeni sözleşme, eşik ve storage test doubles.
- `../frontend/scripts/verify-writing.mjs`: gerçek tarayıcı kontrolleri.
- `scripts/test-all.mjs`: isteğe bağlı test filtrelerini runner'a iletme.
- `.env.example`, `CHAPTER_HISTORY.md`: güncel konfigürasyon/sözleşme.

Mevcut kullanıcı değişiklikleri korunmuştur. Paket/SDK silinmemiştir.

## Eligibility ve 3000 kelime hesabı

Tek yetkili hesap: `developmentNewWords - lastDevelopmentWordCheckpoint >= 3000`.
`developmentNewWords` monoton kabul edilmiş toplamdır; son analizden beri biriken
miktar bu farktır. Mevcut Work alanları korunur. `eligibleForDevelopmentReview`
türetilmiş cache olarak aynı transaction'da güncellenir; endpoint client flag'ine
veya cache'e güvenmeden farkı hesaplar. Yeni eser sıfırdan başlar. Eski, henüz
başlatılmamış eser mevcut kayıtlı yazısıyla bir kere baseline kazanır. Önceden
başlatılmış 3000–4999 kelimelik eserler ilk okumada yeni eşiğe göre uygun olur.

Typing, paste, drop, tamamlanan IME olayları pozitif kelime farkı gönderir.
İsim frontend/backend/testlerde `eligibleWordDelta` olmuştur. Undo, restore,
hydration, refresh draft restore ve conflict recovery katkı talep etmez.
İstek snapshot'ı ancak geçerli save receipt ile onaylanır; istek sürerken yeni
yazılan metin sonraki kayda kalır. Sunucuda Chapter, ChapterVersion, Work,
fingerprint ve sample kayıtları tek transaction'dır. Başarısız kayıt katkı bırakmaz.

Sunucu client delta'sını bölümün tarihsel en yüksek kelime sayısına göre yeni net
büyümeyle sınırlar. Normalize Unicode/boşluk ve HTML'den çıkarılan metnin SHA-256
hash'leri, aynı içeriğin yeniden yüklenmesini ve kaydedilmiş uzun katkının tekrar
yapıştırılmasını eser genelinde engeller. Geçmişi olan bölümün high-water'ı ilk
kayıtta revision'lardan tembel biçimde alınır. 32 kelimeden kısa ek parçalar
parça hash'iyle elenmez; normal tekrar eden sözcükler engellenmez. Tam metin
hash'i ve high-water koruması bunlarda da uygulanır.

Sınır: bu bir intihal/detaylı diff sistemi değildir. Silme sonrası yeni yazı
eski bölüm uzunluğunu aşana kadar ihtiyatlı biçimde eksik sayılabilir; aynı
uzunlukta yeniden yazım da katkı üretmez. Parçaları değiştirerek yapılan tüm
kasıtlı kopyalama biçimlerini tespit ettiği iddia edilmez. Metin kurtarma ve
revision güvenliği bu muhasebeden bağımsız kalır.

Silme ve analiz yapmamak eligibility'yi tüketmez. Kullanıcı düğmeye basmadıkça
provider/analiz POST'u çalışmaz. Uygunluk başlangıç okuması ve save receipt ile gelir.

## API, kota ve yarışlar

- `GET /api/chapters/development/:workId`: sahiplik, uygunluk, pendingWords,
  threshold ve `baseline`/`comparison` bilgisi; UI sürekli sayaç göstermez.
- `POST /api/chapters/development/:workId`: auth → mevcut `aiLimiter` → sahiplik
  → kullanıcı kilidi → kullanıcı genelinde başarı kotası → snapshot context →
  flag/readiness → provider → validator → başarı transaction'ı.
- `DEVELOPMENT_ANALYSIS_DAILY_LIMIT=2`: takvim günü değil kayan 24 saatte en fazla
  iki başarılı analiz. Analizler arasında saat cooldown'u yoktur. Her yeni analiz
  için önceki başarılı checkpoint'ten sonra 3000 yeni eligible kelime gerekir.
  Farklı eserler de aynı kullanıcının kotasını paylaşır. Zaman MongoDB'den alınır.
  429 yanıtı `DEVELOPMENT_DAILY_LIMIT`, açıklayıcı mesaj, `Retry-After` ve `quota`
  taşır. GET durum ve başarılı POST yanıtı da `quota` içerir: `dailyLimit`, `used`,
  `remaining`, `nextAvailableAt`, `retryAfter`. Yalnız commit edilmiş analizler
  sayılır; provider/validation/kayıt hataları ve prepared yanıtı hak tüketmez.
  UI kalan hakkı gösterir; sıfırken başlatmayı kapatır, odak/dakikalık kontrol ve
  hakkın açılma zamanında sunucudan yeniler. Kelime uygunluğu ayrı kalır.
- Kilit MongoDB'de kullanıcı `_id` üzerinde atomik, majority write concern ile
  alınır. İki sekme, çift tıklama ve farklı uygulama süreçlerinde tek çağrı başlar.
  Aynı kullanıcının farklı eserlerde eşzamanlı çağrısı da reddedilir (409).
- Analiz `(workId, sequence)` ve `(workId, checkpointEnd)` unique index'lerine sahiptir.
  Daha önce analiz edilmiş checkpoint provider öncesinde kontrol edilir.
- Başarıda analiz kaydı, kullanıcı kota zamanı/kilit açılması, Work sayısı/zamanı,
  checkpoint ve uygunluk aynı transaction'dadır. Provider transaction dışında;
  MongoDB retry callback'i provider'ı yeniden çalıştırmaz.
- Analiz sürerken kaydedilen yeni yazı korunur: checkpoint yalnız hazırlık
  snapshot'ının sonuna ilerler. Daha sonraki katkılar sonraki değerlendirmeye kalır.
- Timeout, network, provider 429, invalid JSON/result veya persist hatası başarı
  alanlarını değiştirmez. Otomatik provider retry yoktur.

Operasyonel kilit tercihi: otomatik süre dolumu/TTL yoktur. Çöken süreçten kalan
kilit ikinci pahalı çağrı riskine karşı kapalı kalır. Operatör, ilgili token ve
startedAt ile eski çağrının durduğunu doğruladıktan sonra kilidi temizlemelidir.
Adapter transport abort sonrasında promise'in sonlanmasını bekler; halen
çalışan yerel request'i yalnız Promise.race timer'ıyla serbest bırakmaz.
Başarı commit'inden sonra bağlantının kopması halinde istemci yanıtı alamayabilir;
sunucudaki başarılı kayıt korunur; aynı yazıyı yeniden değerlendirmek kelime
checkpoint kontrolüyle, kota doluysa günlük limit kontrolüyle reddedilir.

MongoDB replica set mevcut kayıt sistemi gibi gereklidir. Dağıtımdan önce yeni
koleksiyonların tanımlı index'lerini oluşturun (autoIndex kapalıysa migration
aracınızla). Burada gerçek uygulama veritabanına migration/bağlantı yapılmadı.

## Model ve context

DevelopmentAnalysis: userId, workId, sequence, analyzedAt, kaynak chapterId /
revision / contentHash / örnek kelime sayısı, başlangıç-bitiş checkpoint,
modelIdentifier, promptVersion, analysisVersion, kind, genişletilebilir result
ve opsiyonel profileSnapshot. Work içinde büyüyen analiz array'i yoktur.

İlk çağrı mevcut kayıtlı bölümlerden en fazla 3000 kelimelik başlangıç örneği
hazırlar. Sonrakiler checkpoint sonrası DevelopmentSample katkılarından en yeni
3000 kelimeyi kullanır. Kaynak revision/hash kayıtları örneği izlenebilir kılar.
Boş veya 3000 kelimeden az kullanılabilir örnek provider'a gitmez; hak korunur.
3000 üzerinde birikmiş yazıdan sınırlı örnek seçilir, başarıda hazırlık anına
kadar biriken dönem kapanır. Analiz sırasında gelen yazılar tüketilmez.
Önceki yalnız bir son analizden profileSnapshot (yoksa result) alınır; geçmiş
metinlerin tamamı gönderilmez. Başarı çıktısı en fazla 64 KiB ile sınırlandırılır.

## Topbar ve Geçmiş

Uygun değilken düğme yoktur. Uygunken `✦ Gelişimimi takip et` kalıcı ve hareketsiz
görünür (yalnız açıkça izin vermiş kullanıcıda); sürekli 1824/3000 göstergesi veya kendiliğinden popup yoktur. Tıklama
hazırlık endpoint'ini çağırır; hazırlık/429/hata mesajları aynı dialog'da gösterilir.
İlk Yazar Profili ve Gelişim Karşılaştırması başlıkları ayrılır. Tema ve Odak
mevcut responsive yerlerini korur. Geçmiş/sürüm arayüzü yayın flag'iyle gizlidir;
koç notları onun yerine kullanılmaz, ayrı arşiv bileşeninde saklanır.

## AI entegrasyon haritası

| Alan | Mevcut bağlantı | Bulgular |
| --- | --- | --- |
| Eski review, chat | `routes/ai.js` → `callGemini` | `@google/generative-ai`, GEMINI_MODEL env; mevcut fallback korunur |
| Karakter soruları, ilişki sahnesi | CharactersPage → `/ai/chaos`, `/ai/scene-spark` | Aynı router/provider |
| Butterfly, gap, scene suggest, story coach, arc analysis | PlotWorld panelleri → `/ai/plotworld/*` | Aynı router/provider |
| Sahne koçu/kelebek/güçlendirme | SceneDetailPage → `/ai/plotworld/*` | Aynı router/provider |
| Güncel moderasyon/yayın/görsel akışı | İnsan incelemesi, ContentCase ve chapterReview | Otomatik moderatör AI çağrısı yok |
| Eski moderatör | `utils/aiModerator.js` | `@google/generative-ai`; production route import'u bulunmadı, test mock'ları var |
| `@google/genai` | root/backend package.json | Kodda runtime import bulunmadı; paket silinmedi |
| Yeni Gelişim Koçu | `services/developmentProvider.js` | `@google/generative-ai`, model env'den; ayrı systemInstruction/JSON schema |

Eski moderatörün prompt, mail, bypass ve moderasyon yan etkileri yeni koça
taşınmadı. Yeniden kullanılabilir provider sınırı bağımsız serviste ayrıldı.
Mevcut çalışan AI router'ının prompt/SDK/limiter davranışları değiştirilmedi.

## Prompt bağlama noktası

Tek prompt noktası `prompts/writerDevelopmentCoach.js` içindeki
`WRITER_DEVELOPMENT_COACH_PROMPT`. Route içinde prompt yoktur. Kullanıcının
sağladığı kriterler/üslup korunur. Model deployment konfigürasyonundan seçilir.
Profil özeti verilen JSON içindeki `profileSnapshot` alanından kaydedilir.
Testler fake çıktı/izole transport kullanır; gerçek edebî kaliteyi değerlendirmez.

## Kapasite (fiyat tahmini yok)

3000 yeni uygun kelime bir değerlendirme dönemini açar; kullanıcı basana kadar
otomatik request yoktur. 7000/20000 kelime eklemek aynı gün ek hak üretmez.

| Aktif kullanıcı | Varsayılan limit ile en çok başarılı analiz / kayan 24 saat |
| --- | ---: |
| 1 | 2 |
| 50 | 100 |
| 100 | 200 |
| 500 | 1000 |

Bu başarı sınırıdır; hazırlık ve başarısız denemelerin sayısı değildir. Mevcut
genel AI limiter 30 istek/saat değerinde korunur ve yeni POST'a da uygulanır.
Gelişim success kotası bunun üstünde ayrı MongoDB kontrolüdür. Diğer AI
özellikleri gelişim hakkını tüketmez; ortak limiter sayacını paylaşabilir.
Mevcut limiter'ın process-local store sınırı değiştirilmedi; gelişim success
kotası/kilidi ise çok süreçte ortaktır. Farklı kullanıcılar paralel çalışabilir;
küresel provider concurrency kuyruğu eklenmedi.

100/500 kullanıcıda eşik veya kullanıcı günlük limitini değiştirmek gerekmez.
Ürün politikası değişirse merkezi threshold/günlük limit ayarlanabilir. Provider
etkinleştirilmeden önce o sağlayıcının kapasitesine göre adapter concurrency,
timeout ve servis kapasitesi belirlenmeli; çok instance için genel limiter'a
ortak store kararı ayrıca verilmelidir. Bu görev fiyat veya model varsaymaz.

## Doğrulama

Sağlayıcı engeli teşhisi: onaylı gerçek 3000 kelimelik örnek, Gemini'den
`promptFeedback.blockReason=PROHIBITED_CONTENT` ve boş candidates döndürdü.
Yapay 3000 kelimelik örnek aynı modelde STOP ve geçerli baseline sonucu verdi.
Bu durum artık genel incomplete hatasına karışmaz: 422
`DEVELOPMENT_PROVIDER_BLOCKED` ve açık içerik filtresi mesajı döner.
MAX_TOKENS ayrı `DEVELOPMENT_OUTPUT_LIMIT` hatasıdır. Filtreli/kesilmiş yanıt
kaydedilmez ve hak tüketmez. Otomatik tekrar yoktur. Loglar yalnız model,
finish/block reason ve token sayılarını içerir; metin, sonuç, anahtar ve
sağlayıcının serbest metin açıklaması yazılmaz. İlgili 3 dosyada 43 test geçti.

Günlük limit güncellemesi: ilgili 7 dosyada 70 test geçti. Chrome akışında
1/2 → 0/2 kalan hak, sıfırken düğmenin kapanması ve sunucu hakkı yenilenince
yeniden açılması doğrulandı. Frontend derlemesi başarılı. Genel turda 552
testten 6'sı başarısızdı; koç tercih testindeki eksik `optionalAuth` mock'u
düzeltildi ve ilgili tur geçti. Kapsam dışı kalan 4 hata: arcAnalysis hata
status beklentisi, feedbackAndQueues rapor bölümlendirmesi, guestRendering
üyelik görünümü ve tourLayout hesap oturumu beklentisi. Aşağıdaki sayılar önceki
özellik doğrulamasının kaydıdır.

- Onay/ayar/arşiv/sürüm kapatma sonrası izole yerel MongoDB replica set tam turu:
  **46 dosya / 496 test geçti**.
- Gerçek JWT doğrulaması ve MongoDB ile `/api/user/development-coach`
  GET/PATCH: oturumsuz 401, aç/kapat 200, geçersiz tercih 400; tercih kalıcı.
- Güncel tarayıcı turu gerçek Ayarlar sayfasını kullanır. İlk seçim sonrası
  pencerenin kapanması, üst barda hatırlatma olmaması, boş/kapalı arşivin
  görünmemesi ve tekrar açıldığında saklanan notların okunması doğrulandı.
- `npm.cmd run build`: başarılı. Mevcut büyük bundle uyarısı sürüyor.
- Gerçek Chrome, izole API fixture: 2999/3000, receipt/autosave, paste/drop/IME,
  restore/undo/recovery, hazırlık POST'u, 429 mesajı, başarılı sonuç, eligibility
  sıfırlanması, son sonucu AI çağrısı olmadan tekrar açma, mobil Tema/Odak ve
  ilk onay/Hayır, Ayarlar’dan açma-kapatma, kapatıldığında arşivin gizlenmesi
  ve yeniden açıldığında eski notların okunması,
  Geçmiş düğmesinin gizliliği ve atölye akışları. Gerçek provider'a çağrı yapılmadı.
- Adapter testlerinde gerçek kurulu SDK ve mock fetch; gerçek MongoDB transaction, kilit ve yarış davranışı
  çalıştırıldı. Testler uygulama `.env`/MONGO_URI'sini kullanmaz.
- Test komutları: `node scripts/test-all.mjs` ve
  `node scripts/test-all.mjs tests/developmentCoach.integration.test.js tests/chapterHistory.integration.test.js tests/chapterSave.test.js tests/chapterAccess.test.js`.
- Tarayıcı komutu: `node scripts/verify-writing.mjs`; dışarıda kurulu Playwright
  için `PLAYWRIGHT_MODULE` file URL desteği var. Harici font/network erişim
  uyarıları kontrolleri etkilemedi.
