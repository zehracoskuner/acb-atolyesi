// src/constants/constants.js

// AI Koçluk Sekmeleri (Sağ Panel)
export const TABS = { 
    ILHAM: "ilham", 
    SOHBET: "sohbet", 
    YORUM: "yorum" 
};

// Works Sidebar Sekmeleri (Sol Panel)
export const WORK_TABS = {
    ANAHAT: "anahat",
    KARAKTER: "karakter",
    ORTAM: "ortam",
    DOSYALAR: "dosyalar"
};

// Ton ve AI davranışı seçenekleri
export const TONES = [
  { value: "", label: "— Ton yok —" },
  { value: "romantik", label: "Romantik" },
  { value: "dramatik", label: "Dramatik" },
  { value: "mizahi", label: "Mizahi" },
  { value: "gerilim", label: "Gerilim" },
  { value: "melankolik", label: "Melankolik" },
];

export const STYLES = [
  { value: "coach", label: "Yazar Koçu (dengeli)" },
  { value: "friendly", label: "Dostane Editör (yumuşak)" },
  { value: "harsh", label: "Sert Eleştirmen (keskin)" },
];
