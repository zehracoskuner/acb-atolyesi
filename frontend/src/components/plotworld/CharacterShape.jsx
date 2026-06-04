// components/plotworld/CharacterShape.jsx

// 1. Tldraw'dan T (Validator) objesini de import et
import { ShapeUtil, HTMLContainer, T, Rectangle2d} from "tldraw"; 

const stringOrEmpty = {
  validate: (v) => {
    if (typeof v === "string") return v;
    return "";
  },
};

export class CharacterShapeUtil extends ShapeUtil {
  static type = "character";

  // 2. Props yapısını Tldraw'un beklediği Validator formatına çevir
  static props = {
  name:   T.string,
  color:  T.string,
  role:   stringOrEmpty,   // boş string gelirse crash yok
  charId: stringOrEmpty,
  w:      T.number,
  h:      T.number,
};

  getDefaultProps() {
    return {
      name:   "Karakter",
      color:  "#6d28d9",
      role:   "",
      charId: "",
      w:      80,
      h:      96,
    };
  }

  getGeometry(shape) {
    const { w, h } = shape.props;
    return new Rectangle2d({
      width: w,
      height: h,
      isFilled: true,
    });
  }

  component(shape) {
    // ... Buranın aşağısı (component ve indicator kısımları) senin kodunla tamamen aynı kalacak.
    // Daire, İsim, Rol vs. kısımlarına dokunmana gerek yok.
    const { name, color, role } = shape.props;
    const initials = name
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <HTMLContainer
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            6,
          pointerEvents:  "none",
          userSelect:     "none",
          width:          "100%",
          height:         "100%",
        }}
      >
        <div
          style={{
            width:           60,
            height:          60,
            borderRadius:    "50%",
            background:      color,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            fontSize:        20,
            fontWeight:      700,
            color:           "#fff",
            fontFamily:      "DM Sans, sans-serif",
            boxShadow:       `0 2px 8px ${color}55`,
            flexShrink:      0,
          }}
        >
          {initials}
        </div>
        <div
          style={{
            fontSize:    12,
            fontWeight:  600,
            color:       "#1c1917",
            fontFamily:  "DM Sans, sans-serif",
            textAlign:   "center",
            lineHeight:  1.2,
            maxWidth:    80,
            overflow:    "hidden",
            textOverflow:"ellipsis",
            whiteSpace:  "nowrap",
          }}
        >
          {name}
        </div>
        {role && (
          <div
            style={{
              fontSize:   10,
              color:      "#a8998a",
              fontFamily: "DM Sans, sans-serif",
              textAlign:  "center",
            }}
          >
            {role}
          </div>
        )}
      </HTMLContainer>
    );
  }

  indicator(shape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        style={{ fill: "none", stroke: shape.props.color, strokeWidth: 1.5 }}
      />
    );
  }
}