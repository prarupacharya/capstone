export const ACCESS_TOKEN_KEY = "capstone.accessToken";

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getAccessToken() {
  return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function saveAccessToken(accessToken: string) {
  getSessionStorage()?.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearAccessToken() {
  getSessionStorage()?.removeItem(ACCESS_TOKEN_KEY);
}

export function hasAccessToken() {
  return Boolean(getAccessToken());
}
