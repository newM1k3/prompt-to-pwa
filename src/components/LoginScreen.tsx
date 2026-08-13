import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/usePocketBase";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    if (isRegistering && password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await register(email, password, passwordConfirm);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message || "Authentication failed";

      if (/failed to authenticate/i.test(message)) {
        setError("Invalid email or password.");
      } else if (/already exists/i.test(message)) {
        setError("An account with this email already exists.");
      } else if (/validation/i.test(message)) {
        setError("Please check your email and password and try again.");
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError(null);
    setPasswordConfirm("");
  };

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-primary mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-h2 text-neutral-900 mb-2">App Genie</h1>
          <p className="text-body text-neutral-500">
            {isRegistering ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 shadow-card"
        >
          {/* Error Banner */}
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 rounded-xl px-4 py-3 text-body-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-body-sm font-medium text-neutral-700 mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 bg-white text-input focus:border-primary focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-body-sm font-medium text-neutral-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 rounded-xl border-2 border-neutral-200 bg-white text-input focus:border-primary focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
                autoComplete={
                  isRegistering ? "new-password" : "current-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password (register only) */}
          {isRegistering && (
            <div>
              <label
                htmlFor="login-password-confirm"
                className="block text-body-sm font-medium text-neutral-700 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                <input
                  id="login-password-confirm"
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-neutral-200 bg-white text-input focus:border-primary focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-lg rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-touch"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isRegistering ? "Creating account..." : "Signing in..."}
              </>
            ) : isRegistering ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>

          {/* Toggle Mode */}
          <p className="text-center text-body-sm text-neutral-500 pt-2">
            {isRegistering
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary hover:text-primary-700 font-semibold transition-colors"
            >
              {isRegistering ? "Sign In" : "Create Account"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
