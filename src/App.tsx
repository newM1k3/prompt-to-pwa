import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import { useState, useCallback, useEffect, useMemo } from "react";
import { AuthProvider, useAuth, pb } from "./hooks/usePocketBase";
import { useCredits } from "./hooks/useCredits";
import { useGenerationFlow } from "./hooks/useGenerationFlow";
import WelcomeScreen from "./components/WelcomeScreen";
import Wizard from "./components/Wizard";
import BlueprintReview from "./components/BlueprintReview";
import PreviewSandbox from "./components/PreviewSandbox";
import Dashboard from "./components/Dashboard";
import LoginScreen from "./components/LoginScreen";
import NavBar from "./components/NavBar";
import UpgradeModal from "./components/UpgradeModal";
import SettingsPage from "./components/SettingsPage";
import type { WizardData, BlueprintData } from "./types";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = window.location.pathname;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Don't redirect if on login page
  if (!user && location !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  useAuth(); // ensure auth context is available
  const navigate = useNavigate();
  const { creditsRemaining, checkCredits, refresh: refreshCredits } = useCredits();

  // Wire credit callbacks into generation flow
  const genCallbacks = useMemo(
    () => ({
      onCreditRefund: (_appId: string) => {
        refreshCredits();
      },
      onCreditConsumed: () => {
        refreshCredits();
      },
    }),
    [refreshCredits]
  );

  const gen = useGenerationFlow(genCallbacks);

  const [activePrompt, setActivePrompt] = useState<string>("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleStartWizard = useCallback(
    (prompt: string) => {
      // Check credits before starting
      if (!checkCredits()) {
        setShowUpgradeModal(true);
        return;
      }
      setActivePrompt(prompt);
      navigate("/wizard");
    },
    [navigate, checkCredits]
  );

  const handleWizardComplete = useCallback(
    async (data: WizardData) => {
      try {
        const appId = await gen.submitBlueprint(data);
        if (appId) {
          navigate(`/blueprint/${appId}`);
        }
      } catch {
        // error handled in hook state; server 402 opens the UpgradeModal via effect below
      }
    },
    [gen, navigate]
  );

  const handleBlueprintApproved = useCallback(
    async (confirmedSections: string[]) => {
      if (!gen.appId) return;
      try {
        await gen.approveBlueprint(confirmedSections);
      } catch {
        // error handled in hook state; server 402 opens the UpgradeModal via effect below
      }
    },
    [gen]
  );

  const handleBlueprintEdit = useCallback(() => {
    navigate("/wizard");
  }, [navigate]);

  // Navigate to the preview once compilation reaches `ready` (polling lives
  // in the hook — the preview page must not load before preview_html exists).
  useEffect(() => {
    if (gen.flowState === "previewing" && gen.appId) {
      navigate(`/preview/${gen.appId}`);
    }
  }, [gen.flowState, gen.appId, navigate]);

  // M3: surface server-side 402 (insufficient credits) as the upgrade modal.
  useEffect(() => {
    if (gen.errorStatus === 402) {
      setShowUpgradeModal(true);
    }
  }, [gen.errorStatus]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="/"
          element={
            <AuthGate>
              <div className="min-h-screen bg-surface-page flex flex-col">
                <NavBar />
                <WelcomeScreen
                  onStartWizard={handleStartWizard}
                  creditsRemaining={creditsRemaining}
                />
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/wizard"
          element={
            <AuthGate>
              <div className="min-h-screen bg-surface-page flex flex-col">
                <NavBar />
                <Wizard
                  initialPrompt={activePrompt}
                  onComplete={handleWizardComplete}
                  onBack={() => navigate("/")}
                  isSubmitting={gen.isSubmitting}
                  error={gen.error}
                />
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/blueprint/:id"
          element={
            <AuthGate>
              <div className="min-h-screen bg-surface-page flex flex-col">
                <NavBar />
                <BlueprintPage
                  onApprove={handleBlueprintApproved}
                  onEdit={handleBlueprintEdit}
                  onRetry={gen.retryGeneration}
                  isSubmitting={gen.isSubmitting}
                  flowError={gen.error}
                />
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/preview/:id"
          element={
            <AuthGate>
              <div className="min-h-screen bg-surface-page flex flex-col">
                <NavBar />
                <PreviewPage onRetry={handleBlueprintEdit} />
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <Dashboard />
            </AuthGate>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthGate>
              <div className="min-h-screen bg-surface-page flex flex-col">
                <NavBar />
                <SettingsPage />
              </div>
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="limit"
      />
    </>
  );
}

function BlueprintPage({
  onApprove,
  onEdit,
  onRetry,
  isSubmitting,
  flowError,
}: {
  onApprove: (sections: string[]) => void;
  onEdit: () => void;
  onRetry: () => void;
  isSubmitting: boolean;
  flowError: string | null;
}) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
  const [recordStatus, setRecordStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    pb.collection("generated_apps")
      .getOne(id)
      .then((record) => {
        // M11: client-side ownership check (authoritative fix is the PB rule
        // `user = @request.auth.id` on generated_apps — see QA-REPORT deploy items).
        if (user && record.user !== user.id) {
          setLoadError("You don't have access to this app.");
          return;
        }
        const raw = record.blueprint_json;
        let bp: unknown;
        try {
          bp = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          bp = null;
        }
        // C2: reject records that don't match the canonical blueprint schema
        // instead of crashing the review screen.
        if (!isValidBlueprint(bp)) {
          setLoadError(
            "This blueprint is invalid or outdated. Please generate a new app."
          );
          return;
        }
        setBlueprint(bp as BlueprintData);
        setRecordStatus(record.status as string);
      })
      .catch(() =>
        setLoadError("Could not load this blueprint. Please try again.")
      )
      .finally(() => setLoading(false));
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-neutral-500">Loading blueprint...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body text-neutral-700 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.assign("/dashboard")}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-neutral-500">Loading blueprint...</p>
        </div>
      </div>
    );
  }

  return (
    <BlueprintReview
      blueprint={blueprint}
      status={isSubmitting ? "coding" : recordStatus}
      error={flowError}
      isSubmitting={isSubmitting}
      onApprove={onApprove}
      onEdit={onEdit}
      onRetry={onRetry}
    />
  );
}

/** Mirrors generate-blueprint.mjs validateBlueprint() — canonical shape check. */
function isValidBlueprint(bp: unknown): bp is BlueprintData {
  if (!bp || typeof bp !== "object") return false;
  const b = bp as Record<string, unknown>;
  return (
    typeof b.app_name === "string" &&
    b.app_name.trim().length > 0 &&
    Array.isArray(b.actors) &&
    b.actors.every((a) => typeof a === "string") &&
    Array.isArray(b.actions) &&
    b.actions.every((a) => typeof a === "string") &&
    Array.isArray(b.data_fields) &&
    b.data_fields.every((f) => typeof f === "string") &&
    typeof b.primary_view === "string" &&
    ["list", "map", "calendar", "form", "dashboard"].includes(
      b.primary_view
    )
  );
}

function PreviewPage({ onRetry }: { onRetry: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [app, setApp] = useState<{
    appName: string;
    previewHtml: string;
    planTier: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    pb.collection("generated_apps")
      .getOne(id)
      .then((record) => {
        // M11: client-side ownership check (authoritative fix is the PB rule).
        if (user && record.user !== user.id) {
          setLoadError("You don't have access to this app.");
          return;
        }
        setApp({
          appName: record.app_name as string,
          previewHtml: record.preview_html as string,
          planTier: (user?.plan_tier as string) ?? "free",
          status: record.status as string,
        });
      })
      .catch(() =>
        setLoadError("Could not load this preview. Please try again.")
      )
      .finally(() => setLoading(false));
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-neutral-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body text-neutral-700 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.assign("/dashboard")}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // App still compiling (e.g. reached from Dashboard mid-build)
  if (app && (app.status === "coding" || app.status === "blueprinting")) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-neutral-700 mb-1">Still building...</p>
          <p className="text-body-sm text-neutral-500">
            Your app is being generated. Check back in about a minute.
          </p>
        </div>
      </div>
    );
  }

  // Failed generation — offer a retry path instead of a blank phone frame
  if (app && app.status === "needs_review") {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body text-neutral-700 mb-2">
            This app needs another try.
          </p>
          <p className="text-body-sm text-neutral-500 mb-6">
            Our AI had trouble finishing it. You can review the blueprint and
            try again — no charge.
          </p>
          <button
            onClick={() => navigate(`/blueprint/${id}`)}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Review Blueprint
          </button>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-neutral-500">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <PreviewSandbox
      previewHtml={app.previewHtml}
      appName={app.appName}
      jobId={id ?? ""}
      planTier={app.planTier}
      onRetry={onRetry}
      onDownload={() => {
        if (id) {
          pb.collection("generated_apps")
            .update(id, { status: "downloaded" })
            .catch(console.error);
        }
      }}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
