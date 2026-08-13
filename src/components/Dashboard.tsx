import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  PartyPopper,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { pb, useAuth } from "../hooks/usePocketBase";
import { useCredits } from "../hooks/useCredits";
import NavBar from "./NavBar";
import type { AppStatus, GeneratedApp } from "../types";

const STATUS_CONFIG: Record<
  AppStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  ready: {
    label: "✓ Ready",
    icon: CheckCircle,
    className: "bg-success-50 text-success-700",
  },
  coding: {
    label: "Building...",
    icon: Loader2,
    className: "bg-primary-50 text-primary-700",
  },
  downloaded: {
    label: "Downloaded",
    icon: Download,
    className: "bg-neutral-100 text-neutral-600",
  },
  needs_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    className: "bg-warning-50 text-warning-700",
  },
  error: {
    label: "Error",
    icon: AlertTriangle,
    className: "bg-error-50 text-error-700",
  },
  blueprinting: {
    label: "Blueprinting...",
    icon: Clock,
    className: "bg-primary-50 text-primary-700",
  },
};

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { user } = useAuth();
  const { refresh: refreshCredits } = useCredits();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [apps, setApps] = useState<GeneratedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Checkout success/cancel handling
  const [checkoutBanner, setCheckoutBanner] = useState<{
    type: "success" | "cancelled" | null;
    visible: boolean;
  }>({ type: null, visible: false });

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      setCheckoutBanner({ type: "success", visible: true });
      refreshCredits();
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("checkout");
      newUrl.searchParams.delete("session_id");
      window.history.replaceState({}, "", newUrl.toString());
    } else if (checkout === "cancelled") {
      setCheckoutBanner({ type: "cancelled", visible: true });
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("checkout");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams, refreshCredits]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadApps = async () => {
      try {
        const result = await pb.collection("generated_apps").getList(1, 200, {
          filter: `user = "${user.id}"`,
          sort: "-created",
        });
        setApps(
          result.items.map((item) => ({
            id: item.id,
            app_name: item.app_name as string,
            original_prompt: item.original_prompt as string,
            blueprint_json: item.blueprint_json as GeneratedApp["blueprint_json"],
            status: item.status as AppStatus,
            preview_html: item.preview_html as string,
            created: item.created as string,
            user: item.user as string,
          }))
        );
        setCurrentPage(1);
      } catch (e) {
        console.error("Failed to load apps:", e);
        setError("Could not load your apps. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadApps();
  }, [user]);

  // Auto-dismiss banners after 8 seconds
  useEffect(() => {
    if (!checkoutBanner.visible) return;
    const timer = setTimeout(() => {
      setCheckoutBanner({ type: null, visible: false });
    }, 8000);
    return () => clearTimeout(timer);
  }, [checkoutBanner]);

  // Pagination (10 apps per page)
  const totalPages = Math.max(1, Math.ceil(apps.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageApps = apps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const firstItemIndex = apps.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const lastItemIndex = Math.min(safePage * PAGE_SIZE, apps.length);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-page">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-body text-neutral-500">Loading your apps...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-page">
        <NavBar />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
            <p className="text-body text-neutral-700 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <NavBar />

      {/* Checkout Banners */}
      {checkoutBanner.type === "success" && checkoutBanner.visible && (
        <div className="bg-success-50 border-b border-success-200">
          <div className="max-w-[800px] mx-auto px-4 py-4 flex items-center gap-3">
            <PartyPopper className="w-6 h-6 text-success-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-body font-semibold text-success-800">
                Welcome to Pro! 🎉
              </p>
              <p className="text-body-sm text-success-700">
                You now have 200 credits. Start building.
              </p>
            </div>
            <button
              onClick={() =>
                setCheckoutBanner({ type: null, visible: false })
              }
              className="text-success-500 hover:text-success-700 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {checkoutBanner.type === "cancelled" && checkoutBanner.visible && (
        <div className="bg-neutral-50 border-b border-neutral-200">
          <div className="max-w-[800px] mx-auto px-4 py-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-neutral-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-body-sm text-neutral-600">
                Upgrade cancelled. You&apos;re still on the Free plan.
              </p>
            </div>
            <button
              onClick={() =>
                setCheckoutBanner({ type: null, visible: false })
              }
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-[57px] bg-white/80 backdrop-blur-sm border-b border-neutral-200 px-4 py-4 z-30">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <h1 className="text-h3 text-neutral-900">My Apps</h1>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors shadow-button text-body-sm"
          >
            <Plus className="w-4 h-4" />
            New App
          </button>
        </div>
      </div>

      {/* App List */}
      <div className="max-w-[800px] mx-auto px-4 py-8">
        {apps.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-50 text-primary mb-6">
              <Plus className="w-10 h-10" />
            </div>
            <h2 className="text-h2 text-neutral-900 mb-2">
              You haven&apos;t built any apps yet
            </h2>
            <p className="text-body text-neutral-500 max-w-sm mx-auto mb-8">
              Describe your business idea and our AI will turn it into a
              working app in under 2 minutes.
            </p>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-700 text-white font-bold text-xl rounded-xl transition-colors shadow-button"
            >
              <Plus className="w-5 h-5" />
              Build Your First App
            </button>
          </div>
        ) : (
          <>
            <p className="text-body-sm text-neutral-500 mb-3" role="status">
              Showing {firstItemIndex}-{lastItemIndex} of {apps.length} app
              {apps.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
            {pageApps.map((app) => {
              const statusConfig =
                STATUS_CONFIG[app.status] ?? STATUS_CONFIG.blueprinting;
              const StatusIcon = statusConfig.icon;
              const isSpinning = app.status === "coding";

              return (
                <button
                  key={app.id}
                  onClick={() => {
                    if (
                      app.status === "ready" ||
                      app.status === "downloaded"
                    ) {
                      navigate(`/preview/${app.id}`);
                    } else if (app.status === "needs_review") {
                      navigate(`/blueprint/${app.id}`);
                    }
                  }}
                  className="w-full text-left bg-white border border-neutral-200 rounded-2xl p-5 hover:border-neutral-300 hover:shadow-card transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-h5 text-neutral-900 truncate">
                        {app.app_name}
                      </h3>
                      <p className="text-caption text-neutral-400 mt-1">
                        {new Date(app.created).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium ${statusConfig.className}`}
                    >
                      <StatusIcon
                        className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`}
                      />
                      {statusConfig.label}
                    </span>
                  </div>
                  {app.status === "ready" || app.status === "downloaded" ? (
                    <p className="text-caption text-primary font-medium mt-2">
                      View App →
                    </p>
                  ) : app.status === "needs_review" ? (
                    <p className="text-caption text-warning font-medium mt-2">
                      Review Blueprint →
                    </p>
                  ) : null}
                </button>
              );
            })}
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1.5 px-5 py-3 min-h-touch rounded-xl border border-neutral-200 bg-white text-body font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
              <span className="text-body text-neutral-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1.5 px-5 py-3 min-h-touch rounded-xl border border-neutral-200 bg-white text-body font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
