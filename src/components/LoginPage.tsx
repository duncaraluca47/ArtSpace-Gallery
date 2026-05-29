import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useOptionalAuth } from "../context/AuthContext";

const LOGIN_STAGE = {
  credentials: "credentials",
  emailVerification: "emailVerification",
  emailOtp: "emailOtp",
  totp: "totp",
} as const;

type LoginStage = (typeof LOGIN_STAGE)[keyof typeof LOGIN_STAGE];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useOptionalAuth();
  const login = auth?.login;
  const sendLoginOtp = auth?.sendLoginOtp;
  const verifyLoginOtp = auth?.verifyLoginOtp;
  const verifyLoginTotp = auth?.verifyLoginTotp;
  const resendRegistrationVerification = auth?.resendRegistrationVerification;
  const verifyRegistrationEmail = auth?.verifyRegistrationEmail;
  const user = auth?.user ?? null;
  const isReady = auth?.isReady ?? true;
  const [stage, setStage] = useState<LoginStage>(LOGIN_STAGE.credentials);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [stepToken, setStepToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [legacyErrors, setLegacyErrors] = useState<{ email?: string; password?: string }>({});
  const [legacySuccessMessage, setLegacySuccessMessage] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const locationState = location.state as { message?: string } | null;

  useEffect(() => {
    setErrorMessage(null);
  }, [password, totpToken, username, verificationCode]);

  useEffect(() => {
    setLegacySuccessMessage(null);
  }, [username, password]);

  useEffect(() => {
    setVerificationNotice(null);
  }, [verificationCode, totpToken, username, password]);

  useEffect(() => {
    setVerificationSent(false);
  }, [username]);

  useEffect(() => {
    setLegacyErrors({});
  }, [username, password]);

  if (isReady && user) {
    return <Navigate to="/" replace />;
  }

  const resetToCredentials = () => {
    setStage(LOGIN_STAGE.credentials);
    setVerificationCode("");
    setTotpToken("");
    setStepToken(null);
    setVerificationSent(false);
  };

  const sendVerificationCode = async () => {
    if (!resendRegistrationVerification) {
      throw new Error("Registration verification is not available.");
    }

    await resendRegistrationVerification(username.trim());
    setVerificationSent(true);
    setVerificationNotice("A verification code has been sent to your email.");
    setStage(LOGIN_STAGE.emailVerification);
  };

  const startLoginFlow = async () => {
    if (!login || !sendLoginOtp || !verifyLoginOtp || !verifyLoginTotp) {
      throw new Error("Authentication backend is not available.");
    }

    const startResult = await login({ username, password } as any);

    if (startResult && (startResult as any).accessToken) {
      navigate("/");
      return;
    }

    setStepToken((startResult as any).stepToken);
    await sendLoginOtp((startResult as any).stepToken);
    setStage(LOGIN_STAGE.emailOtp);
    setVerificationCode("");
    setVerificationNotice("A verification code has been sent to your email.");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (stage === LOGIN_STAGE.emailVerification) {
      if (!verifyRegistrationEmail) {
        setErrorMessage("Registration verification is not available.");
        return;
      }

      if (verificationCode.trim().length !== 6) {
        setErrorMessage("Enter the 6-digit verification code.");
        return;
      }

      setIsSubmitting(true);

      try {
        await verifyRegistrationEmail(username.trim(), verificationCode.trim());
        setVerificationNotice("Email verified. Continuing sign-in...");
        await startLoginFlow();
      } catch (error) {
        const maybeError = error as { message?: string };
        setErrorMessage(maybeError.message ?? "Unable to verify email.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!login || !sendLoginOtp || !verifyLoginOtp || !verifyLoginTotp) {
      const nextErrors: { email?: string; password?: string } = {};

      if (!username.trim()) {
        nextErrors.email = "Email is required.";
      }

      if (!password.trim()) {
        nextErrors.password = "Password is required.";
      }

      setLegacyErrors(nextErrors);
      setLegacySuccessMessage(Object.keys(nextErrors).length === 0 ? "Form is valid. Authentication backend is not part of this assignment." : null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (stage === LOGIN_STAGE.credentials) {
        await startLoginFlow();
        return;
      }

      if (!stepToken) {
        throw new Error("Missing login step token.");
      }

      if (stage === LOGIN_STAGE.emailOtp) {
        const result = await verifyLoginOtp(stepToken, verificationCode);

        if ("stepToken" in result) {
          setStepToken(result.stepToken);
          setStage(LOGIN_STAGE.totp);
          setTotpToken("");
          return;
        }

        navigate("/");
        return;
      }

      await verifyLoginTotp(stepToken, totpToken);
      navigate("/");
    } catch (error) {
      const maybeError = error as { status?: number; message?: string };
      if (maybeError.status === 403) {
        setErrorMessage(null);
        try {
          if (!verificationSent) {
            await sendVerificationCode();
          }
        } catch (sendError) {
          const maybeSendError = sendError as { message?: string };
          setErrorMessage(maybeSendError.message ?? "Verify your email address before logging in.");
          return;
        }

        setErrorMessage(null);
        return;
      }

      setErrorMessage(maybeError.message ?? "Unable to log in.");

      if (maybeError.status === 401) {
        if (stage !== LOGIN_STAGE.credentials) {
          resetToCredentials();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryLabel =
    stage === LOGIN_STAGE.credentials ? "Login" : stage === LOGIN_STAGE.emailOtp ? "Verify Email Code" : "Verify TOTP";

  const heading =
    stage === LOGIN_STAGE.credentials ? "Login" : stage === LOGIN_STAGE.emailOtp ? "Email Verification" : "Authenticator Verification";

  const emailVerificationHeading = "Verify Your Email";

  const helperText =
    stage === LOGIN_STAGE.credentials
      ? `Use your ${login ? "username" : "email"} and password to start the sign-in flow.`
      : stage === LOGIN_STAGE.emailVerification
        ? "We sent a code to your email. Enter it to verify the account, then we will continue sign-in."
      : stage === LOGIN_STAGE.emailOtp
        ? "Enter the 6-digit code sent to your email."
        : "Enter the 6-digit code from your authenticator app.";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_35%),linear-gradient(180deg,_#f8f5ef_0%,_#ffffff_45%,_#f4efe4_100%)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(44,44,44,0.12)] backdrop-blur">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-[#A07C1A]">ArtSpace Access</p>
          <h1 className="text-4xl text-[#2C2C2C]">{stage === LOGIN_STAGE.emailVerification ? emailVerificationHeading : heading}</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">{helperText}</p>
        </div>

        {locationState?.message && (
          <p className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {locationState.message}
          </p>
        )}

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {stage === LOGIN_STAGE.credentials && (
            <>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  {login ? "Username" : "Email"}
                </label>
                {login ? (
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    placeholder="Your username"
                    required
                  />
                ) : (
                  <input
                    id="username"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                    placeholder="user@example.com"
                    required
                  />
                )}
                {!login && legacyErrors.email && <p className="mt-1 text-sm text-red-600">{legacyErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  placeholder="Enter your password"
                  required
                />
                {!login && legacyErrors.password && <p className="mt-1 text-sm text-red-600">{legacyErrors.password}</p>}
              </div>
            </>
          )}

          {stage === LOGIN_STAGE.emailVerification && (
            <div>
              <label htmlFor="verificationCode" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                Verification code
              </label>
              <input
                id="verificationCode"
                name="verificationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.35em] text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                placeholder="123456"
                required
              />
            </div>
          )}

          {stage === LOGIN_STAGE.emailOtp && (
            <div>
              <label htmlFor="verificationCode" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                Email verification code
              </label>
              <input
                id="verificationCode"
                name="verificationCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.35em] text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                placeholder="123456"
                required
              />
            </div>
          )}

          {stage === LOGIN_STAGE.totp && (
            <div>
              <label htmlFor="totpToken" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                Authenticator code
              </label>
              <input
                id="totpToken"
                name="totpToken"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpToken}
                onChange={(event) => setTotpToken(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.35em] text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                placeholder="123456"
                required
              />
            </div>
          )}

          {errorMessage && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          {legacySuccessMessage && (
            <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
              {legacySuccessMessage}
            </p>
          )}

          {verificationNotice && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
              {verificationNotice}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : primaryLabel}
          </button>
        </form>

        {stage !== LOGIN_STAGE.credentials && (
          <button
            type="button"
            onClick={resetToCredentials}
            className="mt-4 w-full rounded-xl border border-[#D4AF37]/30 px-4 py-3 text-sm font-medium text-[#A07C1A] transition hover:bg-[#D4AF37]/8"
          >
            Restart sign-in
          </button>
        )}

        {stage === LOGIN_STAGE.credentials && (
          <div className="mt-4 text-center text-sm text-[#666666]">
            <Link to="/forgot-password" className="mb-2 block font-medium text-[#A07C1A] transition-colors hover:text-[#8B6812]">
              Forgot password?
            </Link>
            Need an account?{" "}
            <Link to="/register" className="font-medium text-[#A07C1A] transition-colors hover:text-[#8B6812]">
              Register here
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
