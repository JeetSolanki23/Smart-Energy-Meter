const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

function toReadableMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length ? text : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = toReadableMessage(item);
      if (parsed) return parsed;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    // FastAPI validation errors: [{ msg, loc, type }]
    if (typeof obj.msg === "string" && obj.msg.trim()) {
      return obj.msg;
    }

    const preferredKeys = ["message", "detail", "error", "reason"];
    for (const key of preferredKeys) {
      if (key in obj) {
        const parsed = toReadableMessage(obj[key]);
        if (parsed) return parsed;
      }
    }
  }

  return null;
}

function getApiErrorMessage(endpoint: string, statusCode: number, payload: unknown): string {
  const fromPayload = toReadableMessage(payload);
  if (fromPayload) return fromPayload;

  const isAuthRoute = endpoint.startsWith("/auth");
  if (isAuthRoute && statusCode === 404) {
    return "Login service not found. Please check backend route or use the correct login page.";
  }

  if (isAuthRoute && statusCode === 401) {
    return "Invalid email or password.";
  }

  if (statusCode === 422) {
    return "Please check the form fields and try again.";
  }

  return `HTTP ${statusCode}`;
}

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

  let errorBody: unknown = null;
  if (!res.ok) {
    errorBody = await res
      .json()
      .catch(async () => ({ message: (await res.text().catch(() => "")).trim() || null }));

    // Handle auth expiry/invalid token eagerly, but don't force logout on generic 403 business rules.
    const isAuthRoute = endpoint.startsWith("/auth");
    const hasSessionToken = Boolean(token);
    const parsedMessage = toReadableMessage(errorBody)?.toLowerCase() || "";
    const shouldForceLogout =
      !isAuthRoute &&
      hasSessionToken &&
      (res.status === 401 ||
        (res.status === 403 && (parsedMessage.includes("invalid") || parsedMessage.includes("expired") || parsedMessage.includes("token"))));

    if (shouldForceLogout) {
      const role = getRole();
      clearAuth();
      window.location.href = role === "admin" ? "/admin/login" : "/login";
      throw new Error("Session expired. Please login again.");
    }

    throw new Error(getApiErrorMessage(endpoint, res.status, errorBody));
  }

  return res.json();
}
