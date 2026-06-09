// src/data/writingConstraints.js
// Başlıklı kısıt kütüphanesi. skill etiketleri focus/koç taksonomisiyle uyumlu —
// böylece Kör Nokta Haritası "zayıf nokta = X" deyince constraintForSkill(X) ile reçete verebilir.

export const CONSTRAINT_CATEGORIES = [
  {
    id: "nesne", title: "Nesne & Betimleme", skill: "betimleme",
    focus: "Nesneyle ruh hâlini görünür kılmak",
    items: [
      "Bir nesneyi, sahibinin ruh hâlini ele verecek şekilde betimle — o ruh hâlini hiç adlandırmadan.",
      "Bir odayı sadece üç detayla anlat; o üç detay orada yaşayanın tüm hayatını sezdirsin.",
      "Sıradan bir nesneyi (bir kaşık, bir anahtar) öyle anlat ki okur ona dokunmak istesin.",
      "Bir manzarayı betimle ama tek bir görsel sıfat ('güzel', 'muhteşem') kullanma.",
      "Bir mekânı, içinde geçmişte yaşanmış bir kavganın izlerini taşıyacak şekilde anlat — kavgadan hiç söz etmeden.",
    ],
  },
  {
    id: "atmosfer", title: "Atmosfer", skill: "atmosfer",
    focus: "Olay olmadan gerilim kurmak",
    items: [
      "Hiçbir tehlike göstermeden bir huzursuzluk yarat.",
      "Güneşli, kalabalık bir günü tekinsiz hissettir.",
      "Bir mekânı 'birazdan bir şey olacak' duygusu verecek şekilde kur — hiçbir şey olmadan.",
      "Sessizliği bir karakter gibi yaz: odadaki sessizlik baskı yapsın.",
      "Aynı sokağı önce güvenli, sonra sadece detay ekleyerek ürkütücü göster.",
    ],
  },
  {
    id: "diyalog", title: "Diyalog", skill: "diyalog",
    focus: "Doğal ve katmanlı konuşma",
    items: [
      "İki kişi tartışsın ama asıl konuyu bir kez bile telaffuz etmesin.",
      "Sadece diyalog yaz, hiç 'dedi/sordu' etiketi kullanma — yine de kimin konuştuğu hep belli olsun.",
      "Bir karakter bir şeyi sürekli 'evet' diyerek reddetsin.",
      "İki kişi vedalaşsın; biri gittiğine sevinsin, diğeri yıkılsın — ama ikisi de bunu söylemesin.",
    ],
  },
  {
    id: "ses", title: "Karakter Sesi", skill: "diyalog",
    focus: "Her karakterin ayrı sesi",
    items: [
      "Aynı haberi üç karaktere anlattır; biri saklasın, biri abartsın, biri geçiştirsin.",
      "Bir karakterin eğitim düzeyini doğrudan söylemeden konuşma biçiminden sezdir.",
      "Bir karakter hiç uzun cümle kurmasın; yine de derin biri gibi görünsün.",
      "Bir karakter çok kibar konuşsun ama cümleleri tehdit gibi dursun.",
      "Aynı repliği ('Gerçekten iyiyim.') üç farklı karaktere söylet; üçü üç ayrı insan gibi dursun.",
    ],
  },
  {
    id: "altmetin", title: "Alt Metin", skill: "altmetin",
    focus: "Söylenmeyeni hissettirmek",
    items: [
      "Kibar bir sohbet yaz ki aslında bir güç savaşı olsun.",
      "İki karakter 'sorun yok' desin ama sahnede büyük bir sorun olduğu hissedilsin.",
      "Bir karakter yalan söylesin; okur yalanı sezsin, karşısındaki sezmesin.",
      "Bir aşk itirafını, 'hava soğumuş' gibi tamamen alakasız bir cümleyle yaptır.",
    ],
  },
  {
    id: "duygu", title: "Duygu — Gösterme", skill: "duygu",
    focus: "Duyguyu etiketlemeden göstermek",
    items: [
      "'Üzgün' demeden derin bir yas hissi ver.",
      "Korkuyu sadece bedenle göster: kalp, eller, nefes — ama 'korktu' yok.",
      "Bir sevinç anını, karakterin yaptığı küçük ve saçma bir hareketle anlat.",
      "Öfkeyi, kırılan bir nesne ya da bir sessizlikle göster — bağırmadan.",
    ],
  },
  {
    id: "karakter", title: "Karakter", skill: "karakter",
    focus: "Karakteri davranışla ele vermek",
    items: [
      "Bir karakterin sosyal sınıfını, doğrudan söylemeden tek sahnede belli et.",
      "Bir karakterin eski bir yarasını, bugünkü küçük bir davranışından sezdir.",
      "Bir karakteri sadece çantasının içindekilerle tanıt.",
      "Kötü bir karakteri, okurun bir an ona hak vereceği şekilde yaz.",
    ],
  },
  {
    id: "arzu", title: "Arzu & Çatışma", skill: "karakter",
    focus: "Arzu ve engel — karakterin motoru",
    items: [
      "Bir karakter bir şeyi çok istesin ama istemiyormuş gibi davransın.",
      "İki karakter aynı şeyi istesin; biri açıkça, diğeri gizlice peşinde olsun.",
      "Karakterin sahne boyunca tek amacı olsun ama her cümlede ona doğrudan yaklaşamasın.",
      "Bir karakterin küçük bir isteğini, büyük bir iç yarasına bağla.",
      "Bir karakter doğru şeyi yapmak istesin ama yanlış yöntemi seçsin.",
    ],
  },
  {
    id: "ic_celiski", title: "İç Çelişki", skill: "karakter",
    focus: "Aynı anda iki şey isteyen karakter",
    items: [
      "Karakterin aynı anda hem gitmek hem kalmak istediği bir an yaz.",
      "Bir karakter sevdiğine zarar verecek doğruyu söylemek zorunda kalsın.",
      "Karakterin inandığı şeyle yaptığı şey çelişsin; bunu açıklamadan göster.",
      "Karakter güçlü görünmeye çalışsın ama küçük bir hareket onu ele versin.",
    ],
  },
  {
    id: "bakis", title: "Bakış Açısı & Mesafe", skill: "bakis",
    focus: "Bakış açısı ve anlatı mesafesi",
    items: [
      "Aynı sahneyi iki karakterin gözünden yaz; ikisi de 'haklı' görünsün.",
      "Anlatıyı uzak ve soğuk başlat, sahnenin ortasında karakterin tam içine gir.",
      "Bir olayı, onu yanlış anlayan bir karakterin gözünden anlat — okur doğruyu görsün.",
    ],
  },
  {
    id: "ritim", title: "Ritim & Cümle", skill: "ritim",
    focus: "Cümle ritmi ve tempo",
    items: [
      "Her cümle tam yedi kelime olsun.",
      "Uzun, nefes nefese bir cümlenin ardına üç kelimelik bir cümle koy; vuruşu hisset.",
      "Bir gerilim sahnesini gittikçe kısalan cümlelerle yaz.",
      "Bir paragraf yaz, içinde hiç sıfat olmasın — yine de canlı olsun.",
    ],
  },
  {
    id: "tekrar", title: "Tekrar & Çeşitlilik", skill: "tekrar",
    focus: "Tekrarı kırıp çeşitlilik kurmak",
    items: [
      "Bir paragraf yaz; aynı özneyi iki kez yazma, zamir ya da başka yolla çöz.",
      "Bir sahne yaz; hiçbir cümle aynı kelimeyle başlamasın.",
      "Sık kullandığın bir koltuk-değneği kelimeyi seç, onu hiç kullanmadan bir paragraf yaz.",
    ],
  },
  {
    id: "zaman", title: "Zaman", skill: "zaman",
    focus: "Zamanı germek ve sıkıştırmak",
    items: [
      "Bir yılı tek bir paragrafa sığdır.",
      "Bir saniyeyi bir paragraf boyunca uzat.",
      "Bir sahneyi sondan başa doğru anlat.",
    ],
  },
  {
    id: "duyular", title: "Duyular", skill: "duyular",
    focus: "Görme dışındaki duyularla yazmak",
    items: [
      "Bir sahneyi sadece koku ve sesle yaz; hiç görsel detay olmasın.",
      "Bir karakteri, ona hiç bakmadan, sadece çıkardığı seslerle tanıt.",
      "Bir yemeği öyle anlat ki okurun ağzı sulansın — ama 'lezzetli' deme.",
    ],
  },
  {
    id: "sahne_amaci", title: "Sahne Amacı", skill: "kurgu",
    focus: "Sahnenin neden var olduğu",
    items: [
      "Bir sahne yaz; başında ve sonunda karakterin durumu değişmiş olsun.",
      "Karakter bir bilgi öğrensin ama bu bilgi onu rahatlatmak yerine zora soksun.",
      "Bir konuşmada güç dengesi başta A'dayken sonda B'ye geçsin.",
      "Sahnede büyük bir olay olmasın ama karakterin kararı değişsin.",
    ],
  },
  {
    id: "okur_etkisi", title: "Okur Etkisi", skill: "etki",
    focus: "Okurun zihninde belirli bir etki yaratmak",
    items: [
      "Okurun merak duymasını hedefle; bilgi verme, sadece eksik bırak.",
      "Okurun bir karakterden şüphelenmesini sağla ama açık kanıt verme.",
      "Okuru önce yanlış anlatmaya, sonra son cümlede fikrini değiştirmeye yönelt.",
      "Okurun bir karaktere kızmasını sağla; sonra onu haklı çıkaran tek bir detay ekle.",
    ],
  },
  {
    id: "bicim", title: "Biçimsel Kısıtlar", skill: "ritim",
    focus: "Biçimsel sınırlamayla yaratıcılık",
    items: [
      "Hiç zarf (hızlıca, yavaşça, aniden…) kullanma.",
      "Her cümle farklı bir harfle başlasın.",
      "Aynı sahneyi '-di'li geçmiş yerine geniş zamanla yaz.",
    ],
  },
];

// Rastgele seçim / skill filtresi için düz liste
export const ALL_CONSTRAINTS = CONSTRAINT_CATEGORIES.flatMap((c) =>
  c.items.map((text) => ({
    text, category: c.id, title: c.title, skill: c.skill, focus: c.focus,
  }))
);

// Kör Nokta Haritası bunu çağıracak: belirli bir beceriye yönelik kısıt
export function constraintForSkill(skill) {
  const pool = ALL_CONSTRAINTS.filter((x) => x.skill === skill);
  const src = pool.length ? pool : ALL_CONSTRAINTS;
  return src[Math.floor(Math.random() * src.length)];
}