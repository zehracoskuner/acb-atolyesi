import { Link } from "react-router-dom";
import "./EtikHatirlatma.css";

/**
 * EtikHatirlatma
 *
 * İki varyant:
 *   variant="yorum"    → yorum kutusunun altında, yapıcı yorum odaklı
 *   variant="paylasim" → ilk/her paylaşım modalında, emeğe saygı odaklı
 *
 * Kullanım:
 *   <EtikHatirlatma variant="yorum" />
 *   <EtikHatirlatma variant="paylasim" />
 */

const CONTENT = {
  yorum: {
    icon: "✍️",
    text: "Yorumun bir yazarın emeğine dokunur.",
    vurgu: "Yapıcı ve saygılı olmayı unutma.",
    link: "/etik-kurallar",
    linkText: "Etik Kurallar",
  },
  paylasim: {
    icon: "📜",
    text: "Emeğine ve yazdıklarına saygı gösteriyoruz.",
    vurgu: "Ayrıntılı bilgi için",
    link: "/kullanim-sartlari",
    linkText: "Kullanıcı Sözleşmesi",
    linkSuffix: "'ni oku.",
  },
};

export default function EtikHatirlatma({ variant = "yorum" }) {
  const c = CONTENT[variant];

  return (
    <div className={`etik-hatirlatma etik-hatirlatma--${variant}`}>
      <span className="etik-hatirlatma__icon">{c.icon}</span>
      <p className="etik-hatirlatma__text">
        {c.text}{" "}
        {variant === "yorum" ? (
          <>
            <span className="etik-hatirlatma__vurgu">{c.vurgu}</span>{" "}
            <Link to={c.link} className="etik-hatirlatma__link">
              {c.linkText}
            </Link>
          </>
        ) : (
          <>
            <span className="etik-hatirlatma__vurgu">{c.vurgu}</span>{" "}
            <Link to={c.link} className="etik-hatirlatma__link">
              {c.linkText}
            </Link>
            {c.linkSuffix}
          </>
        )}
      </p>
    </div>
  );
}