const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function getRole(): string | null {
  return localStorage.getItem("auth_role");
}

export function setAuth(token: string, role: "user" | "admin") {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_role", role);
}

export function clearAuth() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_role");
}

export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle token expiry
  if (res.status === 401 || res.status === 403) {
    const role = getRole();
    clearAuth();
    window.location.href = role === "admin" ? "/admin/login" : "/login";
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
