import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useOptionalAuth } from "../context/AuthContext";

type RegisterFormState = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterFormErrors = Partial<Record<keyof RegisterFormState, string>>;

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const register = auth?.register;
  const verifyRegistrationEmail = auth?.verifyRegistrationEmail;
  const user = auth?.user ?? null;
  const isReady = auth?.isReady ?? true;
  const [values, setValues] = useState<RegisterFormState>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isReady && user) {
    return <Navigate to="/" replace />;
  }

  const handleChange =
    (field: keyof RegisterFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setServerError(null);
    };

  const validate = () => {
    const nextErrors: RegisterFormErrors = {};

    if (values.username.trim().length < 3) {
      nextErrors.username = "Username must be at least 3 characters long.";
    }

    if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (values.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters long.";
    }

    if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    if (needsVerification) {
      if (!verifyRegistrationEmail || !pendingUsername) {
        setServerError("Registration verification is not available.");
        return;
      }

      if (verificationCode.trim().length !== 6) {
        setServerError("Enter the 6-digit verification code.");
        return;
      }

      setIsSubmitting(true);

      try {
        await verifyRegistrationEmail(pendingUsername, verificationCode.trim());
        setVerificationSuccess("Email verified. You can now log in.");
        navigate("/login", { replace: true });
      } catch (error) {
        const maybeError = error as { message?: string };
        setServerError(maybeError.message ?? "Unable to verify email.");
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      if (!register) {
        setServerError("Registration data is valid. Authentication backend is not part of this assignment.");
        return;
      }

      const result = await register({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      setPendingUsername(values.username.trim());
      setPendingEmail(values.email.trim());
      const needsVerif = Boolean(result.verificationRequired);
      setNeedsVerification(needsVerif);
      setVerificationCode("");

      if (!needsVerif && auth?.login) {
        // Attempt to sign the user in automatically after registration when verification is not required
        try {
          const loginResult = await auth.login({ username: values.username.trim(), password: values.password } as any);

          if (loginResult && (loginResult as any).accessToken) {
            navigate("/");
            return;
          }
        } catch {
          // ignore — fall through to verification success message
        }
      }

      // Do not expose development fallback verification codes in the UI.
      setVerificationSuccess("We sent a verification code to your email. Enter it below to finish registration.");
    } catch (error) {
      const maybeError = error as { status?: number; message?: string; fieldErrors?: { username?: string; email?: string } };

      if (maybeError.status === 409) {
        const fieldErrors = maybeError.fieldErrors ?? {};
        setErrors({
          username: fieldErrors.username,
          email: fieldErrors.email,
        });

        if (!fieldErrors.username && !fieldErrors.email) {
          setServerError(maybeError.message ?? "Username or email already taken.");
        }
      } else {
        setServerError(maybeError.message ?? "Unable to register.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_35%),linear-gradient(180deg,_#f8f5ef_0%,_#ffffff_45%,_#f4efe4_100%)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(44,44,44,0.12)] backdrop-blur">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-[#A07C1A]">ArtSpace Access</p>
          <h1 className="text-4xl text-[#2C2C2C]">Register</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Create an account, then confirm the email verification code before logging in.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {!needsVerification ? (
            <>
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={values.username}
                  onChange={handleChange("username")}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  placeholder="Choose a username"
                />
                {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={handleChange("email")}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={handleChange("password")}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  placeholder="Create a password"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                  placeholder="Re-enter your password"
                />
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
              </div>
            </>
          ) : (
            <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
              <div>
                <p className="text-sm font-medium text-[#2C2C2C]">Verification pending</p>
                <p className="mt-1 text-sm leading-6 text-[#666666]">
                  Enter the 6-digit code sent to {pendingEmail ?? "your email"} for username {pendingUsername ?? "your account"}.
                </p>
              </div>

              <div>
                <label htmlFor="verificationCode" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                  Code
                </label>
                <input
                  id="verificationCode"
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
            </div>
          )}

          {serverError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {serverError}
            </p>
          )}

          {verificationSuccess && (
            <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
              {verificationSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (needsVerification ? "Verifying..." : "Creating account...") : needsVerification ? "Verify Code" : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[#666666]">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-[#A07C1A] transition-colors hover:text-[#8B6812]">
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}
