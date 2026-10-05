import { afterEach, beforeEach, expect, it, vi } from "vitest";
import React from "../../frontend/node_modules/react/index.js";
import { renderToStaticMarkup } from "../../frontend/node_modules/react-dom/server.node.js";
import DevelopmentCoachDialog from "../../frontend/src/components/DevelopmentCoachDialog.jsx";
import DevelopmentCoachPreference from "../../frontend/src/components/DevelopmentCoachPreference.jsx";
import { validDevelopmentResult } from "./fixtures/developmentResult.js";
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
it("shows the shielded beta teaser without consent controls or an initial prompt", () => {
  const html = renderToStaticMarkup(<DevelopmentCoachPreference />);
  expect(html).toContain("Beta"); expect(html).toContain("Çok yakında"); expect(html).toContain("<svg");
  expect(html).not.toContain("<button");
  expect(renderToStaticMarkup(<DevelopmentCoachPreference initialOnly />)).toBe("");
});
it("renders the coach output as escaped text and keeps internal profile/confidence hidden", () => {
  const result = validDevelopmentResult("progress");
  result.headline = '<img src=x onerror="alert(1)">';
  result.profileSnapshot.rhythm = "INTERNAL_SNAPSHOT";
  result.voiceProfile.signatureTraits[0].confidence = "high";
  result.focus = [{ title: "Focus title", reason: "Focus reason", practice: "Focus practice" }];
  result.progress.improved = ["Improved example"];
  const html = renderToStaticMarkup(<DevelopmentCoachDialog state={{ status: "complete", kind: "comparison", result }} onClose={() => {}} />);
  expect(html).toContain("Gelişim Karşılaştırması");
  expect(html).toContain("Test evidence"); expect(html).toContain("Focus practice");
  expect(html).toContain("Improved example"); expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img"); expect(html).not.toContain("INTERNAL_SNAPSHOT");
  expect(html).not.toContain("confidence"); expect(html).not.toContain("chapter-history");
});
it("renders loading and error states without inventing a result", () => {
  const html = renderToStaticMarkup(<DevelopmentCoachDialog state={{ status: "loading", message: "Waiting" }} onClose={() => {}} />);
  expect(html).toContain('aria-busy="true"'); expect(html).toContain('role="status"'); expect(html).toContain("Waiting");
  expect(html).not.toContain("Sesinin belirgin özellikleri");
});
