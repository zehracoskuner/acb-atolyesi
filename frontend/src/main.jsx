import SessionProvider from "./components/SessionProvider";
import { EXPLORE_PATH } from "./lib/routes";
import ReportsPage from "./pages/ReportsPage";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import "./styles/ActionControls.css";
import "./styles/Responsive.css";
import SayfaYukleniyor from "./components/SayfaYukleniyor";
import { AdminGuard, ModeratorGuard } from "./components/AdminGuard";
import Layout from "./components/Layout";
import MembershipGate from "./components/MembershipGate";

// ── Lazy sayfalar ──────────────────────────────────────────────────────────
const Register              = lazy(() => import("./pages/Register"));
const Login                 = lazy(() => import("./pages/Login"));
const Dashboard             = lazy(() => import("./pages/Dashboard"));
const Home                  = lazy(() => import("./pages/Home"));
const Beginner              = lazy(() => import("./pages/Beginner"));
const Landing               = lazy(() => import("./pages/Landing"));
const Read                  = lazy(() => import("./pages/Read"));
const NotesPad              = lazy(() => import("./pages/NotesPad"));
const WorkStudioPage        = lazy(() => import("./pages/WorkStudioPage"));
const ChaptersPage          = lazy(() => import("./pages/ChaptersPage"));
const CharacterUniversePage = lazy(() => import("./pages/CharactersPage"));
const WorkHomePage          = lazy(() => import("./pages/WorkNotes"));
const ExplorePage           = lazy(() => import("./pages/ExplorePage"));
const StoryHomePage         = lazy(() => import("./pages/StoryDetailsPage"));
const ProfilePage           = lazy(() => import("./pages/ProfilePage"));
const StudioHub             = lazy(() => import("./pages/StudioPage"));
const AuthCallback          = lazy(() => import("./pages/AuthCallBack"));
const Bildirimler           = lazy(() => import("./pages/Bildirimler"));
const Ayarlar               = lazy(() => import("./pages/Ayarlar"));
const SifremiUnuttum        = lazy(() => import("./pages/SifremiUnuttum"));
const SifreSifirla          = lazy(() => import("./pages/SifreSifirla"));
const Feed                  = lazy(() => import("./pages/Feed"));
const ProfilTamamla         = lazy(() => import("./pages/ProfilTamamla"));
const PlotWorld             = lazy(() => import("./pages/PlotWorld"));
const EmailDogrula          = lazy(() => import("./pages/EmailDogrula"));
const SceneDetailPage       = lazy(() => import("./pages/SceneDetailPage"));
const LibraryPage           = lazy(() => import("./pages/Library"));
const AdminPanel            = lazy(() => import("./pages/AdminPanel"));
const KullaniciSozlesmesi   = lazy(() => import("./pages/KullaniciSozlesmesi"));
const GizlilikPolitikasi    = lazy(() => import("./pages/GizlilikPolitikasi"));
const EtikKurallar          = lazy(() => import("./pages/EtikKurallar"));
const ModeratorPanel        = lazy(() => import("./pages/ModeratorPanel"));
const SozlesmeKabul          = lazy(() => import("./pages/SozlesmeKabul"));

// ── Uygulama ───────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SessionProvider>
    <Suspense fallback={<SayfaYukleniyor />}>
      <Routes>

        {/* Auth — Topbar yok */}
        <Route path="/"                element={<Navigate to={EXPLORE_PATH} replace />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/sifremi-unuttum" element={<SifremiUnuttum />} />
        <Route path="/sifre-sifirla"   element={<SifreSifirla />} />
        <Route path="/auth/callback"   element={<AuthCallback />} />
        <Route path="/verify-email"    element={<EmailDogrula />} />
        <Route path="/profili-tamamla" element={<ProfilTamamla />} />
        <Route path="/sozlesme-kabul" element={<SozlesmeKabul />} />
        {/* Legal documents must be readable before accepting and without a session. */}
        <Route path="/kullanim-sartlari" element={<KullaniciSozlesmesi />} />
        <Route path="/gizlilik" element={<GizlilikPolitikasi />} />
        <Route path="/etik-kurallar" element={<EtikKurallar />} />

        {/* Topbar + Tour */}
        <Route element={<MembershipGate />}>
        <Route element={<Layout />}>
          <Route path="/basvurular/:id?" element={<ReportsPage />} />
          <Route path="/dashboard"                   element={<Dashboard />} />
          <Route path="/home"                        element={<Home />} />
          <Route path="/notes"                       element={<NotesPad />} />
          <Route path="/bildirimler"                 element={<Bildirimler />} />
          <Route path="/ayarlar"                     element={<Ayarlar />} />
          <Route path="/beginner"                    element={<Beginner />} />
          <Route path="/landing"                     element={<Landing />} />
          <Route path="/kesfet" element={<Navigate to={EXPLORE_PATH} replace />} />
          <Route path="/kutuphane" element={<Navigate to="/library" replace />} />
          <Route path={EXPLORE_PATH}                      element={<ExplorePage />} />
          <Route path="/library"                     element={<LibraryPage />} />
          <Route path="/studio"                      element={<StudioHub />} />
          <Route path="/feed"                        element={<Feed />} />
          <Route path="/profile/me"                  element={<ProfilePage />} />
          <Route path="/profile/:id"                 element={<ProfilePage />} />
          <Route path="/story/:workId"               element={<StoryHomePage />} />
          <Route path="/read/:workId"                element={<Read />} />
          <Route path="/work/:workId"                element={<WorkStudioPage />} />
          <Route path="/work/:workId/chapters"       element={<ChaptersPage />} />
          <Route path="/work/:workId/characters"     element={<CharacterUniversePage />} />
          <Route path="/work/:workId/plot"           element={<PlotWorld />} />
          <Route path="/work/:workId/scene/:sceneId" element={<SceneDetailPage />} />
          <Route path="/work/:workId/notlarım"       element={<WorkHomePage />} />

          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminPanel />
              </AdminGuard>
            }
          />
        </Route>

        {/* Panel sayfaları — kendi layout'ları var, Topbar istemez */}
        <Route
          path="/moderator"
          element={
            <ModeratorGuard>
              <ModeratorPanel />
            </ModeratorGuard>
          }
        />
        </Route>

      </Routes>
    </Suspense>
  </SessionProvider>
  </BrowserRouter>
);
