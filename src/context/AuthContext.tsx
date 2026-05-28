import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { clearAccessToken, getAccessToken, storeAccessToken } from "../app/services/authToken";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
};

export type LoginCredentials = {
  username: string;
  password: string;
};

export type LoginStartResult = {
  stepToken: string;
  requiresEmailOtp: boolean;
  requiresTotp: boolean;
};

export type LoginOtpSendResult = {
  verificationCode?: string;
};

export type LoginOtpResult =
  | {
      stepToken: string;
      requiresTotp: true;
    }
  | AuthUser;

export type RegisterCredentials = {
  username: string;
  email: string;
  password: string;
};

export type RegisterResult = {
  verificationRequired: true;
  verificationCode?: string;
};

export type RegisterConflictResponse = {
  error?: string;
  fieldErrors?: {
    username?: string;
    email?: string;
  };
};

export type AuthContextValue = {
  user: AuthUser | null;
  login: (credentials: LoginCredentials) => Promise<LoginStartResult | LoginSessionResponse>;
  sendLoginOtp: (stepToken: string) => Promise<LoginOtpSendResult>;
  verifyLoginOtp: (stepToken: string, code: string) => Promise<LoginOtpResult>;
  verifyLoginTotp: (stepToken: string, token: string) => Promise<AuthUser>;
  register: (credentials: RegisterCredentials) => Promise<RegisterResult>;
  verifyRegistrationEmail: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  isReady: boolean;
  tokenVersion: number;
};

type AuthError = Error & { status?: number };

const apiBaseUrl = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;
const INACTIVITY_TIMEOUT_MS = 15 * 60_000;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function parseJsonResponse<T>(response: Response) {
  return (await response.json()) as T;
}

async function refreshAccessToken() {
  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await parseJsonResponse<{ accessToken: string }>(response);
  storeAccessToken(data.accessToken);
  return data.accessToken;
}

type LoginSessionResponse = {
  accessToken: string;
  user: AuthUser;
};

function isLoginSessionResponse(value: LoginSessionResponse | LoginStartResult): value is LoginSessionResponse {
  return "accessToken" in value;
}

function getTokenExpiryMs(token: string) {
  const payload = token.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: number };

    if (typeof decoded.exp !== "number") {
      return null;
    }

    return decoded.exp * 1000;
  } catch {
    return null;
  }
}

function createAuthError(status: number, message: string) {
  const error = new Error(message) as AuthError;
  error.status = status;
  return error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tokenVersion, setTokenVersion] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const refreshInProgressRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const clearAuthState = useCallback(() => {
    clearAccessToken();
    clearTimers();
    setUser(null);
    setTokenVersion((current) => current + 1);
  }, [clearTimers]);

  const scheduleTimers = useCallback((token: string | null) => {
    clearTimers();

    if (!token) {
      return;
    }

    const expiryMs = getTokenExpiryMs(token);

    if (expiryMs !== null) {
      const refreshDelay = Math.max(expiryMs - Date.now() - ACCESS_TOKEN_REFRESH_BUFFER_MS, 0);
      refreshTimerRef.current = window.setTimeout(() => {
        void refreshAccessTokenFlow();
      }, refreshDelay);
    }

    inactivityTimerRef.current = window.setTimeout(() => {
      toast.warning("You were logged out due to inactivity");
      void logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimers]);

  const refreshAccessTokenFlow = useCallback(async () => {
    if (refreshInProgressRef.current) {
      return null;
    }

    refreshInProgressRef.current = true;

    try {
      const token = await refreshAccessToken();

      if (!token) {
        clearAuthState();
        return null;
      }

      setTokenVersion((current) => current + 1);
      scheduleTimers(token);
      return token;
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [clearAuthState, scheduleTimers]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const restoreSession = useCallback(async () => {
    try {
      const refreshedToken = await refreshAccessTokenFlow();

      if (!refreshedToken) {
        return;
      }

      const retryResponse = await fetch(`${apiBaseUrl}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${refreshedToken}`,
        },
      });

      if (retryResponse.ok) {
        const data = await parseJsonResponse<{ success: true; user: AuthUser }>(retryResponse);
        setUser(data.user);
      } else {
        clearAuthState();
      }
    } catch {
      clearAuthState();
    } finally {
      setIsReady(true);
    }
  }, [clearAuthState, refreshAccessTokenFlow]);

  const completeLoginSession = useCallback((data: LoginSessionResponse) => {
    storeAccessToken(data.accessToken);
    setTokenVersion((current) => current + 1);
    scheduleTimers(data.accessToken);
    setUser(data.user);
    return data.user;
  }, [scheduleTimers]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const handleActivity = () => {
      const token = getAccessToken();

      if (!token) {
        return;
      }

      scheduleTimers(token);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [scheduleTimers]);

  const login = useCallback(async ({ username, password }: LoginCredentials) => {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorMessage = response.status === 401 ? "Invalid username or password." : response.status === 403 ? "Please verify your email before logging in." : "Unable to log in.";
      throw createAuthError(response.status, errorMessage);
    }

    const data = await parseJsonResponse<LoginStartResult | LoginSessionResponse>(response);

    if (isLoginSessionResponse(data)) {
      // Complete the session immediately when the server returns an access token
      completeLoginSession(data);
      return data;
    }

    return data;
  }, [scheduleTimers]);

  const sendLoginOtp = useCallback(async (stepToken: string) => {
    const response = await fetch(`${apiBaseUrl}/auth/login/send-otp`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ stepToken }),
    });

    if (!response.ok) {
      const errorMessage = response.status === 401 ? "Unable to verify your login session." : "Unable to send verification code.";
      throw createAuthError(response.status, errorMessage);
    }

    return parseJsonResponse<LoginOtpSendResult>(response);
  }, []);

  const verifyLoginOtp = useCallback(async (stepToken: string, code: string) => {
    const response = await fetch(`${apiBaseUrl}/auth/login/verify-otp`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ stepToken, code }),
    });

    if (!response.ok) {
      const errorMessage = response.status === 401 ? "Invalid verification code" : "Unable to verify your code.";
      throw createAuthError(response.status, errorMessage);
    }

    const data = await parseJsonResponse<LoginSessionResponse | LoginStartResult>(response);

    if (isLoginSessionResponse(data)) {
      return completeLoginSession(data);
    }

    return data;
  }, [completeLoginSession]);

  const verifyLoginTotp = useCallback(async (stepToken: string, token: string) => {
    const response = await fetch(`${apiBaseUrl}/auth/login/verify-totp`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ stepToken, token }),
    });

    if (!response.ok) {
      const errorMessage = response.status === 401 ? "Invalid TOTP code" : "Unable to verify TOTP.";
      throw createAuthError(response.status, errorMessage);
    }

    const data = await parseJsonResponse<LoginSessionResponse>(response);
    return completeLoginSession(data);
  }, [completeLoginSession]);

  const register = useCallback(async ({ username, email, password }: RegisterCredentials) => {
    const response = await fetch(`${apiBaseUrl}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        const data = await parseJsonResponse<RegisterConflictResponse>(response);
        const errorMessage = data.error ?? "Username or email already taken";
        const error = createAuthError(response.status, errorMessage) as AuthError & RegisterConflictResponse;
        error.fieldErrors = data.fieldErrors;
        throw error;
      }

      const errorMessage = "Unable to register.";
      throw createAuthError(response.status, errorMessage);
    }

    return parseJsonResponse<RegisterResult>(response);
  }, []);

  const verifyRegistrationEmail = useCallback(async (username: string, code: string) => {
    const response = await fetch(`${apiBaseUrl}/auth/verify-email`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, code }),
    });

    if (!response.ok) {
      const errorMessage = response.status === 401 ? "Invalid verification code" : response.status === 404 ? "Account not found." : "Unable to verify email.";
      throw createAuthError(response.status, errorMessage);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login,
    sendLoginOtp,
    verifyLoginOtp,
    verifyLoginTotp,
    register,
    verifyRegistrationEmail,
    logout,
    isAdmin: user?.role === "admin",
    hasPermission(permission) {
      return Boolean(user?.permissions.includes(permission));
    },
    isReady,
    tokenVersion,
  }), [isReady, login, logout, register, sendLoginOtp, tokenVersion, user, verifyLoginOtp, verifyLoginTotp, verifyRegistrationEmail]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}