// Keep in sync with frontend/src/lib/terms.js; termsAcceptance.test.js checks this.
// A content change requires a new version. This release is a legal-review draft.
export const TERMS_VERSION = "2026-09-16-draft-1";

export function hasCurrentTerms(user) {
  return user?.termsVersion === TERMS_VERSION && !!user?.termsAcceptedAt;
}

export function termsStatus(user) {
  return {
    termsVersion: user.termsVersion ?? null,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    currentTermsVersion: TERMS_VERSION,
    requiresTermsAcceptance: !hasCurrentTerms(user),
  };
}

export function validateTermsAcceptance(req, res, next) {
  if (req.body?.termsAccepted !== true) {
    return res.status(400).json({
      code: "TERMS_ACCEPTANCE_REQUIRED",
      message: "Devam etmek için Kullanıcı Sözleşmesi'ni açıkça kabul etmelisiniz.",
      currentTermsVersion: TERMS_VERSION,
    });
  }
  if (req.body.termsVersion !== TERMS_VERSION) {
    return res.status(409).json({
      code: "TERMS_VERSION_MISMATCH",
      message: "Sözleşme sürümü değişti. Sayfayı yenileyip güncel metni okuyarak yeniden kabul edin.",
      currentTermsVersion: TERMS_VERSION,
    });
  }
  next();
}

// Never take the version to persist or the acceptance time from the client.
export function newTermsAcceptance() {
  return { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() };
}
