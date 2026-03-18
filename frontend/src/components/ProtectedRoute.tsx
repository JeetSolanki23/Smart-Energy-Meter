import { Navigate } from "react-router-dom";
import { getToken, getRole } from "@/lib/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "user" | "admin";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const token = getToken();
  const role = getRole();

  if (!token) {
    return <Navigate to={requiredRole === "admin" ? "/admin/login" : "/login"} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "admin" ? "/admin/dashboard" : "/dashboard"} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
