// src/constants/constants.js

// Atölye Sağ Panel Sekmeleri
export const TABS = {
  ILHAM: "ilham",
  SOHBET: "sohbet",
  YORUM: "yorum",
  KOC: "koc",
};

// Works Sidebar Sekmeleri (Sol Panel)
export const WORK_TABS = {
  ANAHAT: "anahat",
  KARAKTER: "karakter",
  ORTAM: "ortam",
  DOSYALAR: "dosyalar",
};

// Ton ve AI davranışı seçenekleri
export const TONES = [
  { value: "", label: "— Ton yok —" },
  { value: "romantik", label: "Romantik" },
  { value: "dramatik", label: "Dramatik" },
  { value: "mizahi", label: "Mizahi" },
  { value: "gerilim", label: "Gerilim" },
  { value: "melankolik", label: "Melankolik" },
  { value: "lirik", label: "Lirik" },
  { value: "fantastik", label: "Fantastik" },
  { value: "noir", label: "Noir" },
];

export const STYLES = [
  { value: "coach", label: "Yazar Koçu (dengeli)" },
  { value: "friendly", label: "Dostane Editör (yumuşak)" },
  { value: "harsh", label: "Sert Eleştirmen (keskin)" },
];