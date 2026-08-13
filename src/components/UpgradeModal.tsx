import { Download, Infinity, ShieldCheck } from "lucide-react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: "download" | "limit";
  appName?: string;
}

export default function UpgradeModal({ isOpen, onClose, feature, appName }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay">
      <div className="bg-white rounded-3xl shadow-modal max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        {feature === "download" ? (
          <>
            <div className="text-center mb-6">
              <span className="text-4xl">📥</span>
            </div>
            <h2 className="text-h2 text-neutral-900 text-center mb-2">
              You built something worth keeping.
            </h2>
            <p className="text-body text-neutral-500 text-center mb-6">
              Downloading the source code — the actual files that run your app — is a{" "}
              <strong>Pro feature.</strong>
            </p>

            <p className="text-body-sm text-neutral-500 text-center mb-6">
              Here&apos;s the deal. On the Free plan, your app lives on our servers and works perfectly.
              You can use it, share it, and show it off. The little &ldquo;Built with MJW Apps&rdquo; tag
              is our way of saying &ldquo;we helped make this happen.&rdquo;
            </p>

            <p className="text-body-sm text-neutral-700 text-center font-semibold mb-6">
              With Pro, the app is yours. You get:
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">The full source code</p>
                  <p className="text-caption text-neutral-500">Every file, ready to host anywhere</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">No watermark</p>
                  <p className="text-caption text-neutral-500">Clean, professional, branded as yours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Infinity className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">Unlimited apps</p>
                  <p className="text-caption text-neutral-500">Build one for inventory, one for scheduling, one for customers</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Download className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">Download anytime</p>
                  <p className="text-caption text-neutral-500">Re-download any app you&apos;ve built, past or future</p>
                </div>
              </div>
            </div>

            {/* Comparison table */}
            <div className="rounded-2xl border border-neutral-200 overflow-hidden mb-6">
              <div className="grid grid-cols-2">
                <div className="p-3 bg-neutral-50 text-caption font-semibold text-neutral-700">Free</div>
                <div className="p-3 bg-primary-50 text-caption font-semibold text-primary-700">Pro</div>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Use your app online</div>
                <div className="p-3 text-caption text-neutral-800 border-t border-neutral-100">Everything above</div>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Share it with your team</div>
                <div className="p-3 text-caption text-neutral-800 border-t border-neutral-100 font-semibold">$29 / month</div>
              </div>
              <div className="grid grid-cols-2">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Download source code</div>
                <div className="p-3 text-caption text-primary-700 border-t border-neutral-100 font-semibold">✕ → ✓</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-h2 text-neutral-900 text-center mb-2">
              You&apos;ve used your free credits this month.
            </h2>
            <p className="text-body text-neutral-500 text-center mb-4">
              On the Free plan, you get 5 credits every month — one credit per
              app. You&apos;ve used all of yours.
            </p>

            <p className="text-body text-neutral-600 text-center font-semibold mb-6">
              Upgrade to Pro for 200 credits every month.
            </p>

            {appName && (
              <div className="bg-success-50 border border-success-200 rounded-2xl p-4 mb-6 text-center">
                <p className="text-caption text-success-700">Your latest app</p>
                <p className="text-body-lg text-success-800 font-semibold">{appName}</p>
                <p className="text-caption text-success-600">Status: ✓ Working</p>
              </div>
            )}

            {/* Comparison table */}
            <div className="rounded-2xl border border-neutral-200 overflow-hidden mb-6">
              <div className="grid grid-cols-3">
                <div className="p-3 text-caption font-semibold text-neutral-500" />
                <div className="p-3 bg-neutral-50 text-caption font-semibold text-neutral-700 text-center">Free</div>
                <div className="p-3 bg-primary-50 text-caption font-semibold text-primary-700 text-center">Pro</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Credits / month</div>
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100 text-center">5</div>
                <div className="p-3 text-caption text-primary-700 border-t border-neutral-100 text-center font-semibold">200</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Source code</div>
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100 text-center">—</div>
                <div className="p-3 text-caption text-primary-700 border-t border-neutral-100 text-center font-semibold">✓ Download</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Watermark</div>
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100 text-center">On preview</div>
                <div className="p-3 text-caption text-primary-700 border-t border-neutral-100 text-center font-semibold">Removed</div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100">Price</div>
                <div className="p-3 text-caption text-neutral-600 border-t border-neutral-100 text-center">Free</div>
                <div className="p-3 text-caption text-primary-700 border-t border-neutral-100 text-center font-semibold">$29/month</div>
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => {
            window.location.href = "/settings?upgrade=pro";
          }}
          className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-lg rounded-xl transition-all shadow-button hover:shadow-lg mb-3 min-h-touch"
        >
          Upgrade to Pro — $29/month
        </button>
        <p className="text-center text-caption text-success-700 font-medium mb-4">
          First 7 days free. Cancel anytime.
        </p>

        <button
          onClick={onClose}
          className="w-full text-center text-caption text-neutral-400 hover:text-neutral-600 transition-colors py-2"
        >
          No thanks — keep using my app online →
        </button>

        <p className="text-center text-caption text-neutral-300 mt-6">
          You can cancel anytime. Your existing apps stay live.
        </p>
      </div>
    </div>
  );
}
