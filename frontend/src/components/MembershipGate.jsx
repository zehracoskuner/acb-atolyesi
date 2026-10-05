import { isPublicPage } from "../lib/routes";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { membershipStep } from "../lib/terms";
import { rememberLoginReturn } from "../lib/loginReturn";
import { refreshSession } from "../lib/session";
import { useMembership } from "../lib/membershipContext";
import TopBar from "./TopBar";
import SayfaYukleniyor from "./SayfaYukleniyor";

export default function MembershipGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user, error, requireMember } = useMembership();
  const path = location.pathname + location.search + location.hash;
  const publicPage = isPublicPage(location.pathname);
  const step = status === "authenticated" ? membershipStep(user) : null;
  useEffect(() => {
    if (step) { rememberLoginReturn(path); navigate(step, { replace: true }); }
    else if (status === "guest" && !publicPage) requireMember(path, true);
  }, [status, path, publicPage, step, navigate, requireMember]);
  if (status === "checking" || step) return <SayfaYukleniyor />;
  if (status === "error") return <><TopBar /><main className="terms-screen"><div className="terms-card"><p role="alert">{error || "Oturum doğrulanamadı."}</p><button onClick={() => refreshSession()}>Tekrar dene</button></div></main></>;
  if (status === "guest" && !publicPage) return <><TopBar /><main className="terms-screen"><button onClick={() => requireMember(path, true)}>Aramıza katıl :)</button></main></>;
  return <Outlet />;
}
