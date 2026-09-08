export const ACCESS_TOKEN_KEY = "capstone.accessToken";

function getSessionStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    // Some non-browser runtimes (including JSDOM's opaque origins) expose a
    // window without an addressable session storage area.
    return null;
  }
}

export function getAccessToken() {
  try {
    return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveAccessToken(accessToken: string) {
  try {
    getSessionStorage()?.setItem(ACCESS_TOKEN_KEY, accessToken);
  } catch {
    // Authentication still works in browsers with usable storage; storage
    // failures must not prevent the application shell from rendering.
  }
}

export function clearAccessToken() {
  try {
    getSessionStorage()?.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Ignore unavailable or read-only storage environments.
  }
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
