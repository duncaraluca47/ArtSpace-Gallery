import { useState, type FormEvent } from "react";
import { Link } from "react-router";

const apiBaseUrl = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error("Unable to send reset email.");
      }

      setSuccessMessage("If that email exists, a reset link has been sent");
    } catch {
      setErrorMessage("Unable to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_35%),linear-gradient(180deg,_#f8f5ef_0%,_#ffffff_45%,_#f4efe4_100%)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(44,44,44,0.12)] backdrop-blur">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-[#A07C1A]">ArtSpace Access</p>
          <h1 className="text-4xl text-[#2C2C2C]">Forgot Password</h1>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            Enter your email address and we will send a password reset link if an account exists.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#2C2C2C]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[#2C2C2C] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              placeholder="you@example.com"
              required
            />
          </div>

          {successMessage && (
            <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
              {successMessage}
            </p>
          )}

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
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[#666666]">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-[#A07C1A] transition-colors hover:text-[#8B6812]">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}