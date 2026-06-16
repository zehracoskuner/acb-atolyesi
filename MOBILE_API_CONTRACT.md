# MOBILE API CONTRACT — ACB Atölyesi
> Gerçek dosyalardan türetilmiştir. Tarih: 2026-06-16.  
> Flutter client için eksiksiz referans. Hafızadan tahmin içermez.

---

## 1. BASE URL + ROUTE MOUNT YAPISI

```
Prod backend  : https://xn--acbatlyesi-icb.com   (SITE_URL env)
Railway domain: process.env.RAILWAY_PUBLIC_DOMAIN  (otomatik)
Dev backend   : http://localhost:5000

Tüm API uçları : <baseUrl>/api/...
```

**Route mount tablosu** (server.js'den):

| Prefix | Dosya | Auth |
|--------|-------|------|
| `/api/auth` | routes/auth.js | Karma (login/register=açık) |
| `/api/public` | routes/public.js | Açık (opsiyonel Bearer) |
| `/api/user` | routes/user.js | Zorunlu auth (tümü) |
| `/api/profile` | routes/profile.js | Açık |
| `/api/works` | routes/works.js | Karma |
| `/api/chapters` | routes/chapter.js | Zorunlu auth |
| `/api/upload` | routes/upload.js | Açık (rate-limited) |
| `/api/feed` | routes/feed.js | `/` = auth, `/discover` = açık |
| `/api/search` | routes/search.js | Açık |
| `/api/notifications` | routes/notifications.js | Zorunlu auth |
| `/api/library` | routes/library.js | Zorunlu auth |

---

## 2. AUTH

### 2.1 Register

```
POST /api/auth/register
Content-Type: application/json

Body:
{
  "kullaniciAdi": "string",   // 3-30 kar, /^[a-zA-Z0-9_]{3,30}$/
  "email":        "string",   // format + MX kaydı kontrolü yapılır
  "sifre":        "string"    // min 6 karakter
}

Başarı → 201
{ "message": "Hesap oluşturuldu. Doğrulama e-postası gönderildi." }

Hata örnekleri:
400 { "message": "Tüm alanları doldurun." }
400 { "message": "Şifre en az 6 karakter olmalı." }
400 { "message": "Kullanıcı adında geçersiz karakter var (3-30 karakter, harf/rakam/_)." }
400 { "message": "Bu e-posta adresi geçersiz veya mevcut değil." }   ← MX kaydı yok
409 { "message": "E-posta zaten kullanılıyor." }
409 { "message": "Kullanıcı adı zaten kullanılıyor." }
```

> NOT: Kayıt sonrası **token döndürülmez**. E-posta doğrulandıktan sonra login yapılmalı.

---

### 2.2 Login

```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "string",
  "sifre": "string"
}

Başarı → 200
{
  "token": "eyJhbGci...",        // JWT, 30 gün geçerli
  "user": {
    "_id":             "6654abc123...",
    "kullaniciAdi":    "yazar42",
    "email":           "yazar@example.com",
    "avatarUrl":       "https://res.cloudinary.com/...",
    "emailVerified":   true,
    "authProvider":    "local",    // "local" | "google" | "both"
    "profileComplete": true,
    "tourCompleted":   false,
    "role":            "user"      // "user" | "moderator" | "admin" | "banned"
  }
}

Hata örnekleri:
401 { "message": "E-posta veya şifre hatalı." }
403 {
      "code":    "EMAIL_NOT_VERIFIED",
      "message": "E-posta adresiniz henüz doğrulanmadı. Lütfen gelen kutunuzu kontrol edin."
    }
400 {
      "message":  "Bu e-posta adresiyle şifre belirlenmemiş. Google ile giriş yapabilirsin.",
      "provider": "google"
    }
```

---

### 2.3 E-posta Doğrulama

```
// Link e-postada gelir, tarayıcıda açılır. Mobil derin link desteği gerekebilir.
GET /api/auth/verify-email?token=<hex-token>
→ Redirect: <SITE_URL>/verify-email?status=success | invalid | error
```

```
// Yeniden gönder
POST /api/auth/resend-verification
Body: { "email": "string" }

200 { "message": "Doğrulama e-postası tekrar gönderildi." }
// Güvenlik: hesap yoksa veya zaten doğrulandıysa aynı yanıt döner (enumeration koruması)
```

---

### 2.4 Kullanıcı adı müsaitlik kontrolü

```
GET /api/auth/check-username?q=<kullaniciAdi>
→ 200 { "available": true,  "message": "Kullanıcı adı müsait!" }
→ 200 { "available": false, "message": "Bu kullanıcı adı alınmış." }
→ 200 { "available": false, "message": "En az 3 karakter olmalı." }
```

---

### 2.5 Şifre Sıfırlama

```
POST /api/auth/forgot-password
Body: { "email": "string" }
200 { "message": "Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi." }

POST /api/auth/reset-password
Body: { "token": "string", "newPassword": "string" }
200 { "message": "Şifren başarıyla güncellendi." }
400 { "message": "Geçersiz veya süresi dolmuş bağlantı." }
```

---

### 2.6 /auth/me

```
GET /api/auth/me
Authorization: Bearer <token>

200 {
  "user": {
    "_id":             "6654abc123...",
    "kullaniciAdi":    "yazar42",
    "email":           "yazar@example.com",
    "avatarUrl":       "https://...",
    "emailVerified":   true,
    "authProvider":    "local",
    "profileComplete": true,
    "tourCompleted":   false,
    "role":            "user"
  }
}
```

---

### 2.7 Google OAuth — MOBİL İÇİN ÖNEMLİ

**Mevcut durum:** Sunucuda `passport-google-oauth20` ile browser redirect akışı kullanılıyor.  
- `GET /api/auth/google` → Google'a yönlendirir  
- `GET /api/auth/google/callback` → JWT'yi `#token=...` fragment ile SITE_URL'e yönlendirir

**Mobil için `id_token` doğrulayan endpoint MEVCUT DEĞİL.**  
Flutter'dan Google Sign-In ile giriş yapmak için backend'e ek endpoint eklenmeli:

```javascript
// Eklenecek endpoint — backend/routes/auth.js
import { OAuth2Client } from "google-auth-library";
const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google/mobile", async (req, res) => {
  const { idToken } = req.body;
  const ticket = await gClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  // payload.email, payload.sub (googleId), payload.picture
  // ... mevcut passport-google stratejisindeki aynı upsert mantığı
});
```

**Flutter tarafında:**
- `google_sign_in` paketi kullanılır
- `googleUser.authentication.idToken` sunucuya gönderilir
- `google-services.json` içinde `android_client_id` (SHA-1 fingerprint ile oluşturulan)
- `GOOGLE_CLIENT_ID` env değişkeni → Flutter'ın `serverClientId` parametresi

---

### 2.8 Profil Tamamlama (Google kullanıcısı)

Google ile ilk kayıtta `profileComplete: false` döner. Token zaten verilmiştir  
(callback fragment'ında). Bu token ile:

```
POST /api/auth/complete-profile
Authorization: Bearer <token>
Body: { "kullaniciAdi": "string" }   // 3-30 kar, /^[a-zA-Z0-9_]{3,30}$/

200 {
  "token": "eyJhbGci...",   // YENİ token (kullaniciAdi artık belirli)
  "user": { /* login ile aynı şekil */ }
}

400 { "message": "Geçerli bir kullanıcı adı gir (3-30 karakter, harf/rakam/_)." }
400 { "message": "Profil zaten tamamlanmış." }
409 { "message": "Bu kullanıcı adı alınmış." }
```

**Mobil akış:**
1. Google Sign-In → id_token → `POST /api/auth/google/mobile`
2. Yanıttaki `user.profileComplete === false` ise → kullanıcı adı ekranı
3. `POST /api/auth/complete-profile` → yeni token → ana ekran

---

### 2.9 Token Mekanizması

`ensureAuth` middleware'i (`middlewares/ensureAuth.js`):
- **Önce** `req.cookies.token` kontrol edilir
- **Sonra** `Authorization: Bearer <token>` header'ı kontrol edilir
- **Çerez OLMADAN**, yalnızca `Authorization: Bearer <token>` header'ı tek başına **çalışır**
- Native mobil uygulamada çerez yoktur → Bearer token yeterlidir
- Token payload: `{ id, email, role }`, imza `JWT_SECRET`, süre `30d`
- `role: "banned"` ise `ensureAuth` direkt `403` döner

---

## 3. ESER OKUMA

### 3.1 Explore Feed (Auth gerektirmez)

```
GET /api/public/explore
(veya)
GET /api/feed/discover?genres=Fantastik,Gotik

// /api/public/explore
200 {
  "items": [
    {
      "_id":          "6654...",
      "title":        "Karanlık Orman",
      "description":  "Bir dedektifin...",
      "coverImage":   "https://res.cloudinary.com/...",
      "isAnonymous":  false,
      "author": {
        "_id":      "6642...",
        "username": "yazar42",
        "avatarUrl": "https://..."
      },
      "chapterCount": 5,
      "genre":        "Gotik",       ← universe.genre (tekil, eski alan)
      "updatedAt":    "2026-06-10T..."
    }
  ]
}
```

```
// /api/feed/discover (önerilen — daha zengin)
GET /api/feed/discover?genres=Fantastik,Gotik

200 {
  "works": [
    {
      "_id":          "6654...",
      "title":        "Karanlık Orman",
      "coverImage":   "https://...",
      "chapterCount": 5,
      "universe":     { "genres": ["Gotik", "Korku & Karanlık"] },
      "isAnonymous":  false,
      "author": {
        "_id":          "6642...",
        "kullaniciAdi": "yazar42",
        "avatarUrl":    "https://..."
      },
      "updatedAt": "2026-06-10T..."
    }
  ],
  "writers": [
    {
      "_id":          "6642...",
      "kullaniciAdi": "yazar42",
      "avatarUrl":    "https://...",
      "bio":          "Karanlık kurgu yazarı",
      "followerCount": 128
    }
  ]
}
```

---

### 3.2 Discover (Sayfalandırmalı, filtreli)

```
GET /api/works/discover
Query parametreleri (hepsi opsiyonel):
  q       = "arama metni"         // title veya description'da regex arama
  genres  = "Fantastik,Gotik"     // virgülle ayrılmış, ALL_GENRES listesine göre filtrelenir
  page    = 1                     // varsayılan 1
  limit   = 20                    // varsayılan 20, max 50
  sort    = "newest" | "popular"  // varsayılan "newest"

200 {
  "items": [ /* serializeWork() formatı — bkz. §3.4 */ ],
  "pagination": {
    "total":      142,
    "page":       1,
    "limit":      20,
    "totalPages": 8
  }
}
```

---

### 3.3 Takip Akışı (Auth gerekli)

```
GET /api/feed?page=1
Authorization: Bearer <token>

200 {
  "items": [
    // ─── LOG tipi ───
    {
      "_id":       "665a...",
      "type":      "log",
      "createdAt": "2026-06-10T...",
      "author": {
        "_id":          "6642...",
        "kullaniciAdi": "yazar42",
        "avatarUrl":    "https://..."
      },
      "content":     "Bugün 2000 kelime yazdım!",
      "visibility":  "public",
      "relatedWork": { "_id": "6654...", "title": "Karanlık Orman" },
      "likeCount":   7,
      "likedByMe":   false
    },
    // ─── CHAPTER tipi ───
    {
      "_id":       "665b...",
      "type":      "chapter",
      "createdAt": "2026-06-09T...",
      "author": {
        "_id":          "6643...",
        "kullaniciAdi": "roman_yazar",
        "avatarUrl":    "https://..."
      },
      "chapter": { "_id": "665c...", "title": "Fırtınadan Önce", "order": 3 },
      "work":    { "_id": "6655...", "title": "Sis Vadisi",      "coverImage": "https://..." }
    }
  ],
  "hasMore": true,
  "total":   45,
  "isEmpty": false
}
// Sayfa başına 15 öğe; merge = log + chapter, tarih sıralı
```

---

### 3.4 Eser Detayı (Public — Auth gerekmez)

```
GET /api/public/works/:id       // _id (MongoDB ObjectId) kullanılır — slug YOK

200 {
  "item": {
    "_id":                 "6654abc...",
    "title":               "Karanlık Orman",
    "description":         "Eski bir dedektifin...",
    "preface":             "<p>Bu hikaye...</p>",
    "coverImage":          "https://res.cloudinary.com/acb-covers/image/upload/...",
    "isAnonymous":         false,
    "author": {
      "_id":      "6642...",       // isAnonymous=true ise { _id: null, username: "Anonim" }
      "username": "yazar42",
      "avatarUrl": "https://..."
    },
    "universe": {
      "genres": ["Gotik", "Polisiye"],
      "tone":   "Karanlık",
      "rules":  "",
      "themes": "Kader, ihanet"
    },
    "publishedChapterIds": ["665c...", "665d...", "665e..."],
    "customChapterTitles": {
      "665c...": "Prologue: Sis"
    },
    "updatedAt": "2026-06-10T..."
  }
}
```

---

### 3.5 Work Nesnesinin TAM Alan Listesi (Model)

| Alan | Tip | Açıklama |
|------|-----|---------|
| `_id` | ObjectId | MongoDB kimliği |
| `id` | ObjectId | _id ile aynı (serializeWork alias) |
| `title` | String | Eser adı |
| `description` | String | Kısa açıklama |
| `status` | `"draft"` \| `"published"` \| `"archived"` | Otomatik: 0 published bölüm → draft |
| `universe.genres` | String[] | Max 5, ALL_GENRES listesinden |
| `universe.tone` | String | "Karanlık", "Mizahi" vb. |
| `universe.rules` | String | Evren kuralları |
| `universe.themes` | String | "Kader, ihanet" vb. |
| `language` | String | Varsayılan "tr" |
| `tags` | String[] | Serbest etiketler |
| `color` | String | UI rengi, varsayılan "purple" |
| `preface` | String | Önsöz (HTML olabilir) |
| `isAnonymous` | Boolean | Yazar adı gizli mi? |
| `contentWarning` | Boolean | İçerik uyarısı var mı? |
| `coverImage` | String | Cloudinary URL |
| `publishedChapterIds` | ObjectId[] | Yayınlanan bölüm ID sırası |
| `customChapterTitles` | `{ [chapterId]: string }` | Özel bölüm başlıkları |
| `likeCount` | Number | Toplam beğeni |
| `createdAt` | Date | ISO 8601 |
| `updatedAt` | Date | ISO 8601 |
| `author` | Object | Populate: `{_id, kullaniciAdi, avatarUrl}` |

**ALL_GENRES tam listesi:**
```
"Fantastik", "Bilim Kurgu", "Distopya / Ütopya", "Tarihi Kurgu",
"Mitolojik Kurgu", "Alternatif Tarih",
"Polisiye", "Psikolojik Gerilim", "Suç Kurgu", "Korku & Karanlık",
"Gotik", "Gizem",
"Romantizm", "Aile & Nesil", "Büyüme Romanı", "Trajedi", "Dram",
"Mizah & Yergi", "Dini", "Spritüel",
"Lirik Şiir", "Epik Şiir", "Deneme", "Anı & Otobiyografi", "Günlük",
"Macera", "Seyahat Yazını", "Destansı Fantezi", "Açık Dünya"
```

---

### 3.6 Eser Arama

```
GET /api/search/works?q=karanlık&genre=Gotik

200 {
  "items": [
    {
      "_id":          "6654...",
      "title":        "Karanlık Orman",
      "description":  "...",
      "coverImage":   "https://...",
      "chapterCount": 5,
      "genre":        "Gotik",
      "author":       { "_id": "...", "kullaniciAdi": "yazar42", "avatarUrl": "..." },
      "updatedAt":    "..."
    }
  ]
}
// Minimum 2 karakter, max 20 sonuç
```

---

### 3.7 Tür Listesi (Sayı ile)

```
GET /api/works/genres

200 {
  "genres": [
    { "genre": "Fantastik",   "count": 45 },
    { "genre": "Bilim Kurgu", "count": 23 },
    ...
  ]
}
```

---

## 4. ESER YAZMA

### 4.1 Eser Oluştur

```
POST /api/works
Authorization: Bearer <token>

Body:
{
  "title":       "Yeni Hikayem",
  "genres":      ["Fantastik", "Gotik"],   // ALL_GENRES içinden, max 5
  "description": "Hikayenin özeti",
  "coverImage":  "https://..."             // opsiyonel, önce /api/upload yap
}

201 {
  "item": { /* serializeWork() — §3.4 şekli */ }
}
```

---

### 4.2 Eser Güncelle

```
PATCH /api/works/:id
Authorization: Bearer <token>

Body (hepsi opsiyonel, yalnızca gönderilen güncellenir):
{
  "title":               "Güncellendi",
  "description":         "Yeni özet",
  "genres":              ["Gotik"],
  "language":            "tr",
  "tags":                ["vampir", "karanlık"],
  "color":               "purple",
  "preface":             "<p>Önsöz metni</p>",
  "isAnonymous":         false,
  "contentWarning":      true,
  "coverImage":          "https://res.cloudinary.com/...",
  "publishedChapterIds": ["665c...", "665d..."],   // SIRA ÖNEMLİ
  "customChapterTitles": { "665c...": "Prologue" }
}

200 {
  "message": "Çalışma güncellendi.",
  "item":    { /* serializeWork() */ }
}
```

> **KRİTİK — publishedChapterIds güvenlik kuralı:**  
> Backend, listedeki ID'lerin gerçekten bu esere ait VE `status: "published"` olduğunu doğrular.  
> Taslak veya reddedilmiş bölüm ID'si gönderirseniz listeden sessizce çıkarılır.  
> `work.status` bu listeden otomatik türetilir: boş → `"draft"`, 1+ → `"published"`.  
> Frontend'den `status` göndermek etkisizdir.

---

### 4.3 Eser Sil

```
DELETE /api/works/:id
Authorization: Bearer <token>

200 { "message": "Çalışma ve bölümleri silindi." }
// Bölümler de CASCADE silinir
```

---

### 4.4 Tüm Bölümleri Taslağa Al (Yayından Çek)

```
PUT /api/works/:id/unpublish-all
Authorization: Bearer <token>

200 {
  "message":        "Hikaye ve tüm bölümler taslağa alındı.",
  "etkilenenBolum": 3
}
```

---

### 4.5 Kapak Görseli Yükleme

```
POST /api/upload
// ensureAuth YOKTUR — rate limit ile korunuyor (20/saat/IP)
// Body: multipart/form-data
// Alan adı: "file"
// İzin verilen türler: image/jpeg, image/png, image/webp, image/gif
// Max boyut: 5 MB

200 {
  "url":     "https://res.cloudinary.com/acb-covers/image/upload/v.../dosya.jpg",
  "message": "Resim başarıyla yüklendi!"
}

400 { "message": "Dosya 5MB'dan büyük olamaz." }
400 { "message": "Sadece JPEG, PNG, WEBP veya GIF yüklenebilir." }
400 {
  "message":  "Kapak fotoğrafı uygun değil: Açık cinsel içerik tespit edildi.",
  "rejected": true
}
```

> **Akış:** multipart → AI kapak kontrolü → Cloudinary upload → URL döner.  
> AI hata verirse kapak yükleme engellenmez (fail-open).  
> Base64 YOKTUR; yalnızca `multipart/form-data`.  
> Dönen URL'yi `PATCH /api/works/:id` gövdesindeki `coverImage` alanına yaz.

---

## 5. BÖLÜM OKUMA

### 5.1 Yayınlanmış Bölüm Listesi (Public — Auth gerekmez)

```
GET /api/public/works/:workId/chapters

200 {
  "items": [
    {
      "_id":        "665c...",
      "work":       "6654...",
      "title":      "Fırtınadan Önce",
      "content":    "<p>Orman karanlıktı...</p>",  // HTML string
      "order":      1,
      "status":     "published",
      "reviewNote": "",
      "createdAt":  "2026-06-01T...",
      "updatedAt":  "2026-06-05T..."
    }
  ]
}
// Yalnızca publishedChapterIds içinde VE status="published" olan bölümler döner
// Sıralama: chapter.order ASC (yayın sırası değil, anlatı sırası)
// Eser draft ise [] döner
```

---

### 5.2 Yazarın Kendi Bölümleri (Auth gerekli — tüm statüler)

```
// Yol 1 — work sahibi için tüm bölümler
GET /api/chapters?workId=<workId>
Authorization: Bearer <token>

200 {
  "items": [
    {
      "_id":        "665c...",
      "title":      "Fırtınadan Önce",
      "order":      1,
      "status":     "draft",          // draft | published | pending_review | rejected
      "content":    "<p>...</p>",
      "updatedAt":  "...",
      "reviewNote": ""               // red/uyarı notu
    }
  ]
}

// Yol 2 — work rotasından
GET /api/works/:workId/chapters
Authorization: Bearer <token>

200 { "items": [ /* aynı yapı */ ] }
```

---

### 5.3 Tek Bölüm (Yazar — Auth gerekli)

```
GET /api/chapters/:id
Authorization: Bearer <token>

200 {
  "item": {
    "_id":        "665c...",
    "work":       "6654...",
    "title":      "Fırtınadan Önce",
    "content":    "<p>Orman karanlıktı ve...</p>",
    "order":      1,
    "status":     "rejected",
    "reviewNote": "Grafik şiddet ihlali.",
    "reviewedBy": "6610...",
    "reviewedAt": "2026-06-08T...",
    "createdAt":  "2026-06-01T...",
    "updatedAt":  "2026-06-09T..."
  }
}
```

---

### 5.4 Content Alanı Formatı

- `content` alanı **HTML string**'dir.
- Okuyucu tarafında `WebView` veya Flutter HTML render kütüphanesi gerekir (`flutter_html` vb.).
- İzin verilen taglar §7'de listelenmiştir.

---

## 6. BÖLÜM YAZMA + YAYINLAMA

### 6.1 Yeni Bölüm Oluştur (Taslak)

```
POST /api/chapters
Authorization: Bearer <token>

Body:
{
  "workId": "6654...",
  "title":  "Fırtınadan Önce"    // opsiyonel; yoksa "Bölüm N" atanır
}

201 {
  "item": {
    "_id":    "665c...",
    "work":   "6654...",
    "title":  "Fırtınadan Önce",
    "content": "",
    "order":  4,
    "status": "draft",
    ...
  }
}
```

---

### 6.2 Bölüm Güncelle (İçerik Kaydet)

```
PUT /api/chapters/:id
Authorization: Bearer <token>

Body:
{
  "title":   "Yeni Başlık",         // opsiyonel
  "content": "<p>Yeni içerik...</p>" // opsiyonel; sanitizer'dan geçer (§7)
}

200 {
  "item":               { /* chapter nesnesi */ },
  "message":            "Kaydedildi.",
  "draftedFromPublished": false
}

// Eğer bölüm yayında/incelemede/reddedilmişti VE content değiştirildiyse:
200 {
  "item":               { "status": "draft", ... },
  "message":            "Kaydedildi. Değişikliklerin yayına girmesi için bölümü tekrar yayınlaman gerekiyor.",
  "draftedFromPublished": true
}
```

> **ÖNEMLİ:** Yayında veya incelemede olan bölümde `content` değiştirilirse  
> bölüm otomatik `"draft"` statüsüne düşer ve `publishedChapterIds`'den çıkarılır.  
> `work.status` da yeniden hesaplanır.

---

### 6.3 Yayınlama / Taslağa Alma

```
PATCH /api/chapters/:id/status
Authorization: Bearer <token>

Body:
{
  "status": "published",   // veya "draft"
  "workId": "6654..."      // opsiyonel — chapter.work'tan alınır
}
```

**Olası yanıtlar:**

#### A) Taslağa Al

```
Body: { "status": "draft" }

200 { "item": { "status": "draft", ... }, "message": "Bölüm taslağa alındı." }
```

#### B) Yayınla → TEMİZ (AI: clean)

```
Body: { "status": "published" }

200 {
  "item":    { "status": "published", ... },
  "message": "Bölüm yayınlandı.",
  "status":  "published"
}
// work.publishedChapterIds'e eklenir, work.status → "published"
```

#### C) Yayınla → İNCELEMEDE (AI: review VEYA contentBanned kullanıcı)

```
202 {
  "item":    { "status": "pending_review", ... },
  "status":  "pending_review",
  "pending": true,
  "message": "Bölümünüz incelemeye alındı. 6 saat içinde size geri dönüş yapılacaktır."
  // contentBanned ise: "Bölümünüz moderatör onayına gönderildi..."
}
// work'a eklenmez — moderatör onayı gerekli
```

#### D) Yayınla → REDDEDİLDİ (AI: reject)

```
422 {
  "item":     { "status": "rejected", "reviewNote": "Grafik şiddet ihlali.", ... },
  "status":   "rejected",
  "rejected": true,
  "message":  "Bölüm içerik politikamıza aykırı olduğu için yayınlanamıyor. Düzenleyerek tekrar deneyebilirsiniz."
}
```

#### E) İçerik boş → Yayınlanamaz

```
400 { "message": "Bölüm içeriği boş, yayınlanamaz." }
```

---

### 6.4 Mobil Durum Ayrımı — Bölüm Status Haritası

```
chapter.status    HTTP kod  pending  rejected  Kullanıcıya göster
─────────────────────────────────────────────────────────────────
"published"       200       —        —         ✓ Yayında
"pending_review"  202       true     —         ⏳ İncelemede
"rejected"        422       —        true      ✗ Reddedildi (reviewNote okunabilir)
"draft"           200       —        —         ✎ Taslak
```

---

### 6.5 syncWorkStatus ve publishedChapterIds Kuralı

- `work.status` doğrudan set edilemez — **tek kural:** `publishedChapterIds.length > 0` → `"published"`, `0` → `"draft"`
- Bölüm silindiğinde, taslağa alındığında veya düzenlendiğinde backend otomatik olarak `publishedChapterIds`'den çıkarır ve `work.status`'u günceller
- Mobilde `work.status`'u asla manuel hesaplamayın; sunucudan gelen değere güvenin

---

### 6.6 Bölüm Sil

```
DELETE /api/chapters/:id
Authorization: Bearer <token>

200 { "message": "Bölüm silindi." }
// work.publishedChapterIds'den otomatik çıkarılır
```

---

## 7. İÇERİK SANİTİZASYON KONTRATI (KRİTİK)

`utils/sanitizeHtml.js` — mobil editörün ürettiği HTML burada süzülür.  
Flutter editörü **yalnızca aşağıdaki tag ve style değerlerini** üretmeli.

### 7.1 İzin Verilen HTML Taglar (Tam Liste)

```
Blok:  p, div, br, h1, h2, h3, blockquote, ul, ol, li
Inline: span, b, strong, i, em, u, s, strike, del
```

### 7.2 İzin Verilen Attribute'lar

- **Yalnızca** `style` attribute'u tüm taglarda kabul edilir.
- `href`, `src`, `class`, `id`, `on*` (tüm event handlerlar) → düşürülür.
- Hiçbir URL şemasına (`http://`, `javascript:` vb.) izin verilmez.

### 7.3 İzin Verilen `style` Değerleri (Tam Liste)

| CSS Özelliği | İzin Verilen Değerler |
|---|---|
| `text-align` | `left`, `right`, `center`, `justify` |
| `text-decoration` | `underline`, `line-through`, `none` |
| `font-weight` | `normal`, `bold`, `100`–`900` (100'er artım) |
| `font-style` | `normal`, `italic` |

Diğer tüm CSS özellikleri (`color`, `font-size`, `background`, `margin` vb.) → düşürülür.

### 7.4 Mobil Editör Uyumu Özeti

```
İZİN VERİLEN:
<p>Normal paragraf</p>
<p style="text-align:center">Ortalanmış</p>
<strong>Kalın</strong>
<em>İtalik</em>
<u>Altı çizili</u>
<s>Üstü çizili</s>
<h1>Başlık 1</h1>
<h2>Başlık 2</h2>
<h3>Başlık 3</h3>
<ul><li>Madde</li></ul>
<ol><li>Numara</li></ol>
<blockquote>Alıntı</blockquote>
<span style="font-weight:bold">Kalın span</span>
<br>

ENGELLENECEK (sanitizer siler):
<a href="...">Link</a>            ← href düşürülür, metin kalır
<img src="...">                   ← img tag yok
<div style="color:red">           ← color düşürülür, div kalır
<p style="font-size:18px">        ← font-size düşürülür
<script>...</script>              ← tag + içerik birlikte silinir
```

**Flutter editör önerisi:** `flutter_quill` Delta formatından HTML üretirken  
yukarıdaki allowlist'e uygun bir serializer kullanın. `quill_html_editor` veya  
`re_editor` gibi HTML-native çalışan kütüphaneler tercih edilebilir.

---

## 8. MODERASYON

### 8.1 AI Moderasyon Motoru

- **Model:** Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`)
- **API:** Google Generative AI (`@google/generative-ai`)
- **Kuyruklama:** Async seri kuyruk, istek arası min 3.5 sn bekleme
- **Kuyruk dolunca:** Bypass → `severity: "clean"` (fail-open)

### 8.2 Severity Akışları

```
severity     Bölüm status     work'a eklenir  Kullanıcıya bildirim
──────────────────────────────────────────────────────────────────
clean        → published      EVET            —
review       → pending_review HAYIR           "6 saat içinde dönüş" bildirimi
reject       → rejected       HAYIR           E-posta + bildirim + reviewNote
```

### 8.3 Fail-Open Davranışı

AI API hata verirse (timeout, rate limit, ağ hatası):
```javascript
return { severity: "clean", violations: [], reason: null };
```
Bölüm doğrudan yayınlanır. Admin e-posta ile bilgilendirilir (15 dk cooldown).

### 8.4 contentBanned Kullanıcı Akışı

Kullanıcının `contentBanned: true` flag'i varsa:
- AI moderasyon **atlanır**
- Bölüm direkt `"pending_review"` statüsüne düşer
- Mod kuyruğuna yazılır, staff e-posta + bildirim alır
- Kullanıcıya `202` + `pending: true` yanıtı döner
- Kullanıcı banlandığını **bilmez** — sadece "incelemeye alındı" görür

### 8.5 Kapak Moderasyonu

```
POST /api/upload sonrasında AI kapak kontrolü yapılır:
reject → 400 { "message": "Kapak fotoğrafı uygun değil: ...", "rejected": true }
review → upload devam eder (şüphede engelleme yapılmaz)
clean  → upload devam eder
```

---

## 9. BİLDİRİMLER

### 9.1 Liste

```
GET /api/notifications?limit=30
Authorization: Bearer <token>

200 {
  "items": [
    {
      "_id":       "665f...",
      "recipient": "6642...",
      "sender": {
        "_id":          "6643...",
        "username":     "roman_yazar",
        "kullaniciAdi": "roman_yazar"
      },
      "type":      "chapter_approved",
      "work":      { "_id": "6654...", "title": "Karanlık Orman" },
      "log":       null,
      "text":      "\"Fırtınadan Önce\" bölümünüz onaylandı ve yayına alındı! ✓",
      "read":      false,
      "createdAt": "2026-06-10T..."
    }
  ],
  "unreadCount": 3
}
// TTL: 90 gün sonra otomatik silinir
```

### 9.2 Bildirim Tipleri (Tam Enum)

| type | Açıklama | sender |
|------|----------|--------|
| `like` | Eser beğenildi | Kullanıcı |
| `comment` | Yorum yapıldı | Kullanıcı |
| `follow` | Takip edildi | Kullanıcı |
| `log_like` | Günlük beğenildi | Kullanıcı |
| `log_comment` | Günlük yorumu | Kullanıcı |
| `chapter_pending` | Bölüm incelemeye alındı | `null` (sistem) |
| `chapter_approved` | Bölüm onaylandı | `null` (sistem) |
| `chapter_rejected` | Bölüm reddedildi | `null` (sistem) |
| `comment_removed` | Yorum moderatörce kaldırıldı | `null` (sistem) |
| `warning` | Kullanıcıya uyarı | `null` (sistem) |

### 9.3 Okundu İşaretleme

```
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
200 { "ok": true }

PATCH /api/notifications/read-all
Authorization: Bearer <token>
200 { "ok": true }
```

---

## 10. PROFİL

### 10.1 Başka Kullanıcının Profili (Public — Auth opsiyonel)

```
// :id = ObjectId VEYA kullaniciAdi (büyük/küçük harf duyarsız)
GET /api/public/profile/:id
Authorization: Bearer <token>   // opsiyonel — isFollowedByMe için gerekli

200 {
  "user": {
    "_id":           "6642...",
    "username":      "yazar42",
    "kullaniciAdi":  "yazar42",
    "bio":           "Karanlık kurgu yazarı",
    "location":      "İstanbul",
    "website":       "https://...",
    "avatarUrl":     "https://res.cloudinary.com/...",
    "bannerImage":   "https://...",
    "followerCount": 128,
    "followingCount": 34,
    "followers":     ["6643...", "6644..."],   // ObjectId dizisi
    "following":     ["6641..."],
    "createdAt":     "2025-01-15T...",
    "isFollowedByMe": false   // Bearer token yoksa her zaman false
  }
}
```

### 10.2 Başka Kullanıcının Eserleri (Public)

```
GET /api/public/profile/:id/works

200 {
  "items": [
    {
      "_id":          "6654...",
      "title":        "Karanlık Orman",
      "coverImage":   "https://...",
      "status":       "published",
      "chapterCount": 5,
      "totalWords":   0,
      "genre":        "Gotik",
      "updatedAt":    "..."
    }
  ]
}
// Yalnızca status="published" eserler
```

### 10.3 Takip Et / Takipten Çık (Toggle)

```
POST /api/public/profile/:id/follow
Authorization: Bearer <token>

// Takip etmiyorsa → takip eder
200 { "following": true,  "followerCount": 129 }

// Zaten takip ediyorsa → takipten çıkar
200 { "following": false, "followerCount": 128 }

400 { "message": "Kendinizi takip edemezsiniz." }
```

### 10.4 Kendi Profili (Auth gerekli)

```
GET /api/user/profile
Authorization: Bearer <token>

200 {
  "user": {
    "_id":           "6642...",
    "kullaniciAdi":  "yazar42",
    "email":         "yazar@example.com",
    "avatarUrl":     "https://...",
    "bannerImage":   "https://...",
    "bio":           "...",
    "location":      "İstanbul",
    "website":       "https://...",
    "followers":     [...],
    "following":     [...],
    "followerCount": 128,
    "followingCount": 34,
    "role":          "user",
    "contentBanned": false,
    "commentBanned": false,
    "currentStreak": 5,
    "longestStreak": 12,
    "lastWriteDate": "2026-06-15T...",
    "createdAt":     "2025-01-15T..."
  },
  "stats": {
    "totalWorks": 3,
    "totalWords": 0,
    "totalViews": 0,
    "totalLikes": 0
  }
}
```

### 10.5 Profil Güncelle

```
PATCH /api/user/profile
Authorization: Bearer <token>

Body (hepsi opsiyonel):
{
  "kullaniciAdi": "yeni_ad",   // veya "username" (her ikisi de kabul edilir)
  "bio":          "Yeni bio",
  "location":     "Ankara",
  "website":      "https://..."
}

200 { "user": { /* güncellenmiş user */ }, "message": "Profil güncellendi." }
409 { "message": "Bu kullanıcı adı zaten kullanılıyor." }
```

> NOT: Profildeki kullanıcı adı kuralı (auth/register'dan farklı):  
> `PATCH /api/user/profile`'da Türkçe karakterlere (`çÇğĞıİöÖşŞüÜ`) de izin verilir.

### 10.6 Avatar Yükleme

```
POST /api/user/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
Alan adı: "avatar"

200 { "message": "Avatar güncellendi.", "avatarUrl": "https://res.cloudinary.com/..." }
400 { "message": "Dosya seçilmedi." }

// Silmek için:
DELETE /api/user/avatar
200 { "message": "Profil resmi kaldırıldı." }
```

### 10.7 Banner Yükleme

```
POST /api/user/banner
Authorization: Bearer <token>
Content-Type: multipart/form-data
Alan adı: "banner"

200 { "message": "Banner güncellendi.", "bannerImage": "https://..." }

DELETE /api/user/banner
200 { "message": "Kapak resmi kaldırıldı." }
```

> Avatar ve banner yüklemeleri `/api/upload` değil, `/api/user/avatar|banner` üzerinden yapılır.  
> `uploadLimiter` UYGULANMAZ; `generalLimiter` uygulanır (800/15dk).

### 10.8 Kütüphane (Kayıtlı Eserler)

```
GET /api/library
Authorization: Bearer <token>

200 {
  "items": [
    {
      "_id":          "6654...",
      "title":        "Karanlık Orman",
      "coverImage":   "https://...",
      "chapterCount": 5,
      "author":       { "_id": "6642...", "username": "yazar42" },
      "addedAt":      "2026-05-01T..."
    }
  ]
}
// Yalnızca hâlâ yayında olan eserler döner

// Kütüphanede var mı?
GET /api/library/check/:workId
Authorization: Bearer <token>
200 { "inLibrary": true }

// Ekle
POST /api/library
Body: { "workId": "6654..." }
201 { "message": "Kütüphaneye eklendi." }
409 { "message": "Bu eser zaten kütüphanende." }

// Çıkar
DELETE /api/library/:workId
200 { "message": "Kütüphaneden çıkarıldı." }
```

### 10.9 Diğer Kullanıcı Profili (auth gerekli, eski endpoint)

```
GET /api/profile/:id
// User._id ile alınır, library populate edilir
// email döndürülmez
200 { "profile": { ...user, "followerCount": N, "followingCount": M } }
```

---

## 11. HATA & LİMİTLER

### 11.1 Standart Hata Yanıtı

```json
// Tüm hatalar bu yapıdayı izler:
{ "message": "Hata açıklaması." }

// Tek istisna — e-posta doğrulama hatası:
{ "code": "EMAIL_NOT_VERIFIED", "message": "..." }

// Google provider hatası:
{ "message": "...", "provider": "google" }
```

### 11.2 HTTP Durum Kodları

| Kod | Anlam |
|-----|-------|
| 200 | Başarılı |
| 201 | Oluşturuldu |
| 202 | Kabul edildi (incelemeye alındı) |
| 400 | Geçersiz istek / eksik alan |
| 401 | Token yok veya geçersiz |
| 403 | Yetkisiz / banned |
| 404 | Kayıt bulunamadı |
| 409 | Çakışma (duplicate) |
| 422 | İşlem yapılamadı (reject) |
| 429 | Rate limit aşıldı |
| 500 | Sunucu hatası (prod'da stack trace gelmez) |

### 11.3 Rate Limiter Tablosu

| Limiter | Path | Pencere | Max | Anahtar |
|---------|------|---------|-----|---------|
| `generalLimiter` | `/api/*` | 15 dk | 800 | IP |
| `authLimiter` | `/api/auth/login` | 15 dk | 10 | IP (başarılılar sayılmaz) |
| `registerLimiter` | `/api/auth/register` | 60 dk | 5 | IP |
| `writeLimiter` | `/api/logs`, `/api/comments`, `/api/likes`, `/api/inline-comments`, `/api/quotes` | 1 dk | 30 | IP |
| `uploadLimiter` | `/api/upload` | 60 dk | 20 | IP |
| `aiLimiter` | `/api/ai` | 60 dk | 30 | Kullanıcı ID (veya IP) |

### 11.4 429 Yanıt Yapısı

```json
// Express-rate-limit standardHeaders: true ayarında:
{ "message": "Çok fazla istek gönderildi. Lütfen biraz bekle." }

// Header'lar:
RateLimit-Limit:     800
RateLimit-Remaining: 0
RateLimit-Reset:     1749900000   // Unix epoch

// Mobilde: Retry-After veya RateLimit-Reset header'ını okuyarak kullanıcıya
//          kalan süreyi gösterin.
```

---

## 12. MOBİLDE DİKKAT

### 12.1 Çerez Yokluğu

Sunucu cookie hem set eder hem de `Authorization: Bearer` kabul eder.  
Native mobil uygulamada çerez olmadığından **Bearer token yeterlidir**.  
Token'ı Flutter'da `flutter_secure_storage` ile saklayın.

### 12.2 HTML İçerik Render

`chapter.content` ve `work.preface` HTML string'dir.  
Flutter'da render seçenekleri:
- `flutter_html` (önerilen, hafif)
- `webview_flutter` (tam browser ama ağır)
- Allowlist'e uygun custom widget

### 12.3 Editörden HTML Üretme

Mobil editörün ürettiği HTML mutlaka §7'deki allowlist ile sınırlı olmalı.  
Sunucu zaten sanitize eder ama editör de kısıtlanırsa kullanıcı kaybettiği  
formatlamayı görmeden fark eder.

### 12.4 CORS

```javascript
// server.js — kritik satır:
if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
```

`origin` yoksa (curl, mobil native) **CORS izni verilir**. Flutter HTTP  
isteklerinde `Origin` header'ı oluşmaz — CORS sorunu yaşanmaz.

### 12.5 Google Sign-In Kurulumu (Yapılması Gereken)

**Android tarafı:**
1. Firebase Console → SHA-1 fingerprint ekle (debug + release imzası)
2. `google-services.json` indir → `android/app/` altına koy
3. `build.gradle`'da `id 'com.google.gms.google-services'` ekle
4. `google_sign_in` paketi: `serverClientId` → `process.env.GOOGLE_CLIENT_ID` değeri

**Backend tarafı (eklenmesi gerekiyor):**
```javascript
// Aşağıdaki endpoint auth.js'ye eklenmeli:
// POST /api/auth/google/mobile
// Body: { "idToken": "eyJhbGci..." }
// → google-auth-library ile doğrula
// → passport-google stratejisindeki upsert mantığını çalıştır
// → { token, user } döndür
```

**iOS tarafı:**
- `GoogleService-Info.plist` → `ios/Runner/` altına
- `Info.plist`'e `CFBundleURLSchemes` ekle (reversed client ID)

### 12.6 Cloudinary Görselleri

- Tüm `avatarUrl`, `bannerImage`, `coverImage` alanları Cloudinary URL'sidir
- Format: `https://res.cloudinary.com/<cloud_name>/image/upload/<version>/<path>`
- Yeniden boyutlandırma için URL transform eklenebilir: `/w_400,h_600,c_fill/`
- Örnek: `https://res.cloudinary.com/acb-covers/image/upload/w_400,h_400,c_fill/v1/profile/avatar.jpg`

### 12.7 Rate Limit IP Paylaşımı

`app.set("trust proxy", 1)` aktif; Railway proxy'sinin `X-Forwarded-For` başlığına güvenilir.  
Aynı 4G APN'i paylaşan birden fazla kullanıcı `uploadLimiter`'ı aşabilir.  
`aiLimiter` kullanıcı ID'ye göre (IP değil) çalışır — bu sorun yaşanmaz.

### 12.8 Şifre ve E-posta Değişikliği

```
PATCH /api/user/password
Body: { "currentPassword": "...", "newPassword": "..." }   // min 6 kar

PATCH /api/user/change-email
Body: { "newEmail": "...", "currentPassword": "..." }      // şifresi olanlar için zorunlu

// Google kullanıcısı ilk kez şifre belirler:
PATCH /api/user/set-password
Body: { "newPassword": "..." }
→ authProvider "google" → "both" olur
```

### 12.9 Yazma Serisi (Streak)

```
GET /api/user/streak
200 { "currentStreak": 5, "longestStreak": 12, "lastWriteDate": "2026-06-15T..." }

POST /api/user/streak/checkin
200 { "currentStreak": 6, "longestStreak": 12, "lastWriteDate": "2026-06-16T..." }
```

### 12.10 Tur / Onboarding

```
PATCH /api/user/tour-complete
200 { "tourCompleted": true }
```

---

## EK A — Örnek Akışlar (Flutter)

### Kayıt → Giriş Akışı

```
1. POST /api/auth/register       → 201 (token YOK)
2. Kullanıcı e-postayı onaylar   → deep link veya uygulama yeniden açılır
3. POST /api/auth/login          → { token, user }
4. Token'ı SecureStorage'a yaz
5. Sonraki tüm isteklerde: Authorization: Bearer <token>
```

### Google Sign-In Akışı (Backend Endpoint Eklendikten Sonra)

```
1. GoogleSignIn().signIn() → GoogleSignInAuthentication
2. POST /api/auth/google/mobile  { idToken }
3. Yanıttaki user.profileComplete === false ise:
   a. Kullanıcı adı ekranı
   b. POST /api/auth/complete-profile { kullaniciAdi }
   c. Yeni token'ı kaydet
4. Ana ekrana geç
```

### Bölüm Yayınlama Akışı

```
1. POST /api/chapters { workId, title }           → chapter._id alın
2. PUT  /api/chapters/:id { content: "<p>...</p>" } → kaydet
3. PATCH /api/chapters/:id/status { status: "published" }
   → 200 status=published → "Yayınlandı!" toast
   → 202 pending=true     → "İncelemede" banner
   → 422 rejected=true    → "Reddedildi" + chapter.reviewNote göster
4. Reddedildiyse: kullanıcı düzeltir → tekrar PUT (draft'a düşer) → PATCH status
```

### Kapak Yükleme Akışı

```
1. POST /api/upload (multipart, alan: "file")
   → 200 { url: "https://res.cloudinary.com/..." }
   → 400 rejected=true → "Uygunsuz kapak" uyarısı
2. PATCH /api/works/:id { coverImage: url }
```
