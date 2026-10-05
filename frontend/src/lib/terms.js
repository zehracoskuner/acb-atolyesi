// The displayed document and submitted version must change together.
// Backend parity is covered by termsAcceptance.test.js.
export const TERMS_VERSION = "2026-09-16-draft-1";
export const TERMS_PATH = "/kullanim-sartlari";
export const ETHICS_PATH = "/etik-kurallar";
export const TERMS_ACCEPT_PATH = "/sozlesme-kabul";

export function membershipStep(user) {
  if (user?.profileComplete === false || !Number.isInteger(user?.birthYear)) return "/profili-tamamla";
  if (user?.requiresTermsAcceptance !== false) return TERMS_ACCEPT_PATH;
  return null;
}
