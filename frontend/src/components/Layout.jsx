import { useSession } from "../lib/session";
import { Outlet, useLocation } from "react-router-dom";
import { TourManager } from "./tour/TourManager";
import { membershipStep } from "../lib/terms";
export default function Layout() {
  const location = useLocation();
  const { status, user } = useSession();
  const userId = user?._id || user?.id;
  return <>
    <Outlet />
    {status === "authenticated" && userId && !membershipStep(user) &&
      <TourManager key={`${userId}:${location.key}`} userId={String(userId)} currentPath={location.pathname}
        routeKey={location.key} legacyCompleted={user.tourCompleted} serverProgress={user.tourProgress} />}
  </>;
}
