# Gelişim Koçu provider karşılaştırması — 4 Ekim 2026

Mevcut `writer-development-v1` system promptu ve aynı gerçek 3000 kelimelik
baseline örneği kullanıldı. Ham metin, analiz ve refusal içeriği loglanmadı veya
dosyaya kaydedilmedi. Her provider için bir istek yapıldı; production Gemini'de
kaldı. Analiz sayısı/checkpoint değişmedi, günlük hak tüketilmedi.

| Ölçüm | Gemini 2.5 Flash-Lite | GPT-6 Luna (low) |
| --- | --- | --- |
| Sonuç | PROHIBITED_CONTENT; analiz yok | Tamamlandı; refusal yok |
| JSON | Üretilmedi | Strict JSON ve mevcut yerel validator geçti |
| Input / output token | 10910 / 0 | 11519 / 1960 |
| Reasoning token | 0 | 90 (1960 output token içinde) |
| API latency | 0,742 s | 18,879 s |
| Standart token tarifesiyle yaklaşık USD | 0,001091 | 0,0021319 |
| Kalite | Değerlendirilemedi | Ön kontrol yeterli |

Kalite kontrolü: ayrı bir GPT-6 Luna low isteği, örnek metin ve analizi yalnız
bellekte karşılaştırdı. Kanıta dayanma, Türkçe açıklık, uygulanabilirlik ve
kurmacayı edebi olarak ele alma 2/2; uydurma ayrıntı ve örtülü refusal
saptanmadı. Bu aynı modelle ikinci geçiştir, bağımsız insan değerlendirmesi
değildir; tek örnekten genel kalite/refusal oranı çıkarılamaz.
Kalite kontrolünün ek kullanımı 9207 input / 49 output token,
1,476 s ve yaklaşık 0,0009452 USD. OpenAI toplam deney tahmini: 0,0030771 USD.

Maliyetler 4 Ekim 2026 standart tarifelerinden hesaplandı; fatura değildir.
Gemini'nin engellenen isteği için yukarıdaki tutar yalnız token tarifesi
hesabıdır; gerçek ücret doğrulanmadı. Ücretsiz kota, vergi, kur, cache-write
ayarlamaları ve sözleşme indirimleri dahil değildir.

- [OpenAI GPT-6 Luna: model, low reasoning ve fiyat](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Google standart fiyatlar](https://ai.google.dev/gemini-api/docs/pricing)

OpenAI adapterı `services/developmentOpenAIProvider.js` içindedir. Responses API,
`reasoning.effort=low`, `store=false`, strict JSON, mevcut system promptu,
timeout/abort, sıfır otomatik retry ve sanitize hata kodları kullanır.
Production route/service bu adapterı import etmez. Yeni runtime seçim/fallback
veya model değişimi eklenmedi. Kurulu OpenAI SDK kullanıldı; bağımlılık değişmedi.

`scripts/compare-development-providers.mjs --live --work <authorized-work-id>
--report <metadata-path>` yalnız açıkça yetkilendirilmiş örnekte çalıştırılır.
MongoDB salt okunur; koç onayı ve devam eden istek kontrolü vardır. Çıktı sadece
sayılar, durum kodları ve kalite puanları içerir. JSON ölçüm kaydı:
`DEVELOPMENT_PROVIDER_COMPARISON.json`.
