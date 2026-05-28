import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

const apiBaseUrl = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validate = () => {
    if (newPassword.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (newPassword !== confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          token,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("This link has expired. Please request a new one.");
      }

      navigate("/login", {
        replace: true,
        state: { message: "Password reset! Please log in" },
      });
    } catch (error) {
      const maybeError = error as { message?: string };
      setErrorMessage(maybeError.message ?? "This link has expired. Please request a new one.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const missingToken = !email || !token;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_35%),linear-gradient(180deg,_#f8f5ef_0%,_#ffffff_45%,_#f4efe4_100%)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(44,44,44,0.12)] backdrop-blur">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-[#A07C1A]">ArtSpace Access</p>
          <h1 className="text-4xl text-[#2C2C2C]">Reset Password</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Choose a new password for {email || "your account"}.
          </p>
        </div>

        {missingToken ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            This link has expired. Please request a new one.
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                placeholder="Enter a new password"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
                placeholder="Re-enter your password"
                required
              />
            </div>

            {errorMessage && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-base font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Updating..." : "Reset password"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-sm text-[#666666]">
          <Link to="/login" className="font-medium text-[#A07C1A] transition-colors hover:text-[#8B6812]">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}