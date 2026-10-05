import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { refreshSession, useSession, getSession } from "../lib/session";
import { rememberLoginReturn } from "../lib/loginReturn";
import { EXPLORE_PATH, isPublicPage } from "../lib/routes";
import "../styles/MembershipInvite.css";
import MatureAcknowledgement from "./MatureAcknowledgement";

import { MembershipContext as Context } from "../lib/membershipContext";
export default function SessionProvider({ children }) {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  useEffect(() => { refreshSession(); }, []);
  useEffect(() => {
    const expired = () => {
      if (getSession().status === "guest") setInvite({ path: location.pathname + location.search + location.hash, protectedPage: !isPublicPage(location.pathname), locationKey: location.key });
    };
    window.addEventListener("acb-membership-required", expired);
    return () => window.removeEventListener("acb-membership-required", expired);
  }, [location]);
  const requireMember = useCallback((path = location.pathname + location.search + location.hash, protectedPage = false) => {
    if (session.status === "authenticated") return true;
    if (session.status === "guest") setInvite({ path, protectedPage, locationKey: location.key });
    return false;
  }, [session.status, location.pathname, location.search, location.hash, location.key]);
  function close() {
    setInvite(null);
    if (invite?.protectedPage) navigate(EXPLORE_PATH, { replace: true });
  }
  function authenticate(route) {
    const path = rememberLoginReturn(invite.path);
    setInvite(null);
    navigate(path ? `${route}?returnTo=${encodeURIComponent(path)}` : route);
  }
  return <Context.Provider value={{ ...session, requireMember }}>
    {children}
    <MatureAcknowledgement />
    {invite && invite.locationKey === location.key && session.status === "guest" && <Invitation close={close} authenticate={authenticate} />}
  </Context.Provider>;
}
function Invitation({ close, authenticate }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = document.getElementById("root");
    const wasInert = root.inert;
    root.inert = true;
    dialog.current.showModal();
    return () => { root.inert = wasInert; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="membership-invite" aria-modal="true" aria-labelledby="membership-title" aria-describedby="membership-description" onCancel={e => { e.preventDefault(); close(); }}>
    <h2 id="membership-title">Aramıza katıl :)</h2>
    <p id="membership-description">Burada sana da yer var! İster oku, ister yaz. Hikâyelere eşlik etmek, yazarlara yorum bırakmak ve kendi hikâyeni paylaşmak için hemen üye ol!</p>
    <div className="membership-actions">
      <button autoFocus onClick={() => authenticate("/register")}>Üye ol</button>
      <button onClick={() => authenticate("/login")}>Zaten hesabım var</button>
      <button onClick={close}>Şimdilik keşfet</button>
    </div>
  </dialog>, document.body);
}
