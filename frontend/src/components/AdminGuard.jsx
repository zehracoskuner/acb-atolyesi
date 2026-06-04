// src/components/AdminGuard.jsx
import { Navigate } from "react-router-dom";

function getUser() {
  try {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

// Sadece admin geçer
export function AdminGuard({ children }) {
  const token = localStorage.getItem("token");
  const user  = getUser();

  if (!token || !user)       return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

// Admin veya moderatör geçer
export function ModeratorGuard({ children }) {
  const token = localStorage.getItem("token");
  const user  = getUser();

  if (!token || !user) return <Navigate to="/login" replace />;
  if (!["admin", "moderator"].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Geriye dönük uyumluluk — default export hâlâ AdminGuard
export default AdminGuard;