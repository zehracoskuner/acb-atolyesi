// src/components/AdminGuard.jsx
import { useSession } from "../lib/session";
import { Navigate } from "react-router-dom";


// Sadece admin geçer
export function AdminGuard({ children }) {
  const { user, status } = useSession();
  const token = status === "authenticated";

  if (!token || !user)       return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

// Admin veya moderatör geçer
export function ModeratorGuard({ children }) {
  const { user, status } = useSession();
  const token = status === "authenticated";

  if (!token || !user) return <Navigate to="/login" replace />;
  if (!["admin", "moderator"].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Geriye dönük uyumluluk — default export hâlâ AdminGuard
export default AdminGuard;