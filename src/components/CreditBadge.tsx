import { useNavigate } from "react-router-dom";
import { useCreditDisplay } from "../hooks/useCredits";

export default function CreditBadge() {
  const { creditsRemaining, isFree, isPro, isDepleted } = useCreditDisplay();
  const navigate = useNavigate();

  const badgeClasses = isDepleted
    ? "bg-error-50 text-error-700 border border-error-200"
    : isPro
      ? "bg-primary-50 text-primary-700 border border-primary-200"
      : isFree
        ? "bg-warning-50 text-warning-700 border border-warning-200"
        : "bg-neutral-100 text-neutral-600 border border-neutral-200";

  const label = isDepleted
    ? "0 — Upgrade"
    : isPro
      ? `Pro · ${creditsRemaining} left`
      : `${creditsRemaining} left`;

  return (
    <button
      onClick={() => navigate("/dashboard")}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium transition-all hover:opacity-80 cursor-pointer ${badgeClasses}`}
      title={
        isDepleted
          ? "No credits remaining. Upgrade to Pro."
          : `${creditsRemaining} credits remaining on ${isPro ? "Pro" : "Free"} plan`
      }
    >
      <span aria-hidden="true">🪙</span>
      <span>{label}</span>
    </button>
  );
}
