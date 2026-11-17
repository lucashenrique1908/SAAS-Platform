export type AuthApiError = Error & { status?: number };

export async function authRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    headers.set("X-CSRF-Protection", "1");
  }

  const response = await fetch(`/api/auth/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "The request could not be completed.";
    const error = new Error(message) as AuthApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export async function organizationRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    headers.set("X-CSRF-Protection", "1");
  }
  const response = await fetch(`/api/organizations/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "The request could not be completed.";
    const error = new Error(message) as AuthApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export async function organizationUpload<T>(
  path: string,
  file: File,
): Promise<T> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/organizations/${path}`, {
    method: "POST",
    body: form,
    headers: { "X-CSRF-Protection": "1" },
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "The upload could not be completed.";
    const error = new Error(message) as AuthApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export function getActionTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("token");
}
