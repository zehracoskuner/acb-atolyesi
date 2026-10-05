// Used only by writing/atelier browser verification; never imported by the application.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ChaptersPage from "../src/pages/ChaptersPage.jsx";
import Ayarlar from "../src/pages/Ayarlar.jsx";
import { TourManager } from "../src/components/tour/TourManager.jsx";
const fixtureWork = new URLSearchParams(window.location.search).get("work") || "work1";
const fixturePath = "/work/" + fixtureWork + "/chapters";
createRoot(document.getElementById("root")).render(
  new URLSearchParams(window.location.search).has("preferences") ? <MemoryRouter initialEntries={["/ayarlar"]}><Ayarlar /></MemoryRouter> : <MemoryRouter initialEntries={[fixturePath]}>
    <Routes><Route path="/work/:workId/chapters" element={<ChaptersPage />} /></Routes>
    <TourManager userId="writer1" currentPath={fixturePath} routeKey="fixture" legacyCompleted />
  </MemoryRouter>
);
