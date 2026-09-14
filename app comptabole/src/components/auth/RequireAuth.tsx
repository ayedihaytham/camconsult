import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";

export function RequireAuth() {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status !== "authed") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}
