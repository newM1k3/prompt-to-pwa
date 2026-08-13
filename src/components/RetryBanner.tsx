import { AlertTriangle, RefreshCw, Mail } from "lucide-react";

interface RetryBannerProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

const SUPPORT_EMAIL = "support@appgenie.app";

/**
 * Shows when a previous generation came back with `needs_review` status.
 * Plain-English message, one-tap retry, and a human contact path.
 */
export default function RetryBanner({ onRetry, isRetrying = false }: RetryBannerProps) {
  return (
    <div className="bg-warning-50 border border-warning-200 rounded-2xl p-5 mb-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-warning-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-h5 text-neutral-900 mb-1">This app needs a second look</h3>
          <p className="text-body-sm text-neutral-600 mb-4">
            Our AI had trouble finishing it. Tap the button below and we&apos;ll
            try again - no charge.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-6 py-3 bg-warning-600 hover:bg-warning-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-touch text-body-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Trying again..." : "Try Again"}
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=My%20app%20needs%20help`}
              className="inline-flex items-center gap-2 px-4 py-3 text-body-sm text-neutral-700 hover:text-neutral-900 font-medium underline-offset-4 hover:underline transition-colors min-h-touch"
            >
              <Mail className="w-4 h-4" />
              Contact us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}