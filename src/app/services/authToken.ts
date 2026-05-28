let accessToken: string | null = null;

export function getStoredAccessToken() {
  return accessToken;
}

export function storeAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function withAuthHeaders(headers: HeadersInit = {}) {
  const token = getStoredAccessToken();
  const nextHeaders = new Headers(headers);

  if (token && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export function getAccessToken() {
  return getStoredAccessToken();
}
