import { useState } from "react";
import { Download, RefreshCw, Lock } from "lucide-react";
import { pb } from "../hooks/usePocketBase";

interface PreviewSandboxProps {
  previewHtml: string;
  appName: string;
  jobId: string;
  planTier: string;
  onRetry: () => void;
  onDownload: () => void;
}

export default function PreviewSandbox({
  previewHtml,
  appName,
  jobId,
  planTier,
  onRetry,
  onDownload,
}: PreviewSandboxProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPro = planTier === "pro";

  const handleDownload = () => {
    if (!isPro) {
      setShowUpgrade(true);
      return;
    }
    // C4: download-app only accepts GET + ?jobId= and reads the
    // Authorization header server-side — match that contract exactly.
    const token = pb.authStore.token;
    fetch(
      `/.netlify/functions/download-app?jobId=${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    )
      .then(async (res) => {
        if (res.status === 402) {
          // Server says Pro is required (e.g. subscription lapsed) → gate UI
          setShowUpgrade(true);
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ?? "Download failed"
          );
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${appName.replace(/\s+/g, "-").toLowerCase()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onDownload();
      })
      .catch((e) => {
        console.error("Download failed:", e);
        alert("Download failed. Please try again.");
      });
  };

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-neutral-200 px-4 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">{appName}</h2>
          <span className="px-3 py-1 rounded-lg bg-success-50 text-success-700 text-caption font-medium">
            ✓ Ready
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Phone frame */}
        <div className="relative">
          {/* Device bezel */}
          <div className="bg-neutral-800 rounded-[3rem] p-3 shadow-modal">
            <div className="bg-neutral-900 rounded-[2.5rem] p-2">
              {/* Notch */}
              <div className="flex justify-center mb-2">
                <div className="w-32 h-6 bg-neutral-950 rounded-b-2xl" />
              </div>
              {/* Screen */}
              <div className="bg-white rounded-[2rem] overflow-hidden" style={{ width: 390, height: 700 }}>
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts"
                  title={`${appName} Preview`}
                  className="w-full h-full border-0"
                />
              </div>
              {/* Home indicator */}
              <div className="flex justify-center mt-2">
                <div className="w-28 h-1 bg-neutral-700 rounded-full" />
              </div>
            </div>
          </div>
          {/* Watermark for free tier */}
          {!isPro && (
            <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-caption text-neutral-400">
              Built with MJW Apps
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-8 w-full max-w-[390px] space-y-3">
          <button
            onClick={handleDownload}
            className={`w-full font-bold py-4 px-8 text-lg rounded-xl transition-all flex items-center justify-center gap-2 min-h-touch ${
              isPro
                ? "bg-primary hover:bg-primary-700 text-white shadow-button hover:shadow-lg"
                : "bg-neutral-200 text-neutral-500"
            }`}
          >
            {isPro ? (
              <>
                <Download className="w-5 h-5" />
                DOWNLOAD SOURCE CODE
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                DOWNLOAD SOURCE CODE
                <span className="ml-1 px-2 py-0.5 rounded-md bg-warning-100 text-warning-700 text-xs font-bold">
                  PRO
                </span>
              </>
            )}
          </button>

          <button
            onClick={onRetry}
            className="w-full bg-white hover:bg-neutral-50 text-neutral-700 font-semibold py-4 px-8 text-lg rounded-xl border-2 border-neutral-200 transition-all flex items-center justify-center gap-2 min-h-touch"
          >
            <RefreshCw className="w-5 h-5" />
            TRY AGAIN
          </button>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay">
          <div className="bg-white rounded-3xl shadow-modal max-w-md w-full p-8">
            <div className="text-center mb-6">
              <span className="text-4xl">📥</span>
            </div>
            <h3 className="text-h3 text-neutral-900 text-center mb-2">
              You built something worth keeping.
            </h3>
            <p className="text-body text-neutral-500 text-center mb-6">
              Downloading the source code — the actual files that run your app — is a{" "}
              <strong>Pro feature.</strong>
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-xl">📁</span>
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">The full source code</p>
                  <p className="text-caption text-neutral-500">Every file, ready to host anywhere</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🚫</span>
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">No watermark</p>
                  <p className="text-caption text-neutral-500">Clean, professional, branded as yours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">♾️</span>
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">200 credits every month</p>
                  <p className="text-caption text-neutral-500">Build one for inventory, one for scheduling, one for customers</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">🔄</span>
                <div>
                  <p className="text-body-sm font-semibold text-neutral-800">Download anytime</p>
                  <p className="text-caption text-neutral-500">Re-download any app you&apos;ve built, past or future</p>
                </div>
              </div>
            </div>

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
              onClick={() => setShowUpgrade(false)}
              className="w-full text-center text-caption text-neutral-400 hover:text-neutral-600 transition-colors py-2"
            >
              No thanks — keep using my app online →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
