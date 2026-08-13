import { useState, useCallback, useRef } from "react";
import { useAuth, pb } from "./usePocketBase";
import type { WizardData, BlueprintData, AppStatus } from "../types";

type FlowState =
  | "idle"
  | "wizard"
  | "blueprinting"
  | "reviewing"
  | "coding"
  | "previewing"
  | "downloading"
  | "error";

// Client-side polling deadline. The server watchdog (see compile-app.mjs)
// flips stale `coding` records to `needs_review`; this timeout is the
// client-side backstop so the spinner can never spin forever.
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

interface GenerationState {
  flowState: FlowState;
  appId: string | null;
  blueprint: BlueprintData | null;
  previewHtml: string | null;
  status: AppStatus | null;
  error: string | null;
  /** HTTP status of the last failed request (e.g. 402 → upgrade modal). */
  errorStatus: number | null;
  wasRefunded: boolean;
  /** True while a generation request is in flight — guards against double-clicks. */
  isSubmitting: boolean;
}

interface GenerationFlowCallbacks {
  onCreditRefund?: (appId: string) => void;
  onCreditConsumed?: () => void;
}

/** Error carrying the HTTP status so callers can react to 402 etc. */
export interface ApiError extends Error {
  status?: number;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  const e = new Error(err.message ?? fallback) as ApiError;
  e.status = res.status;
  throw e;
}

export function useGenerationFlow(callbacks?: GenerationFlowCallbacks) {
  const { token } = useAuth();
  const [state, setState] = useState<GenerationState>({
    flowState: "idle",
    appId: null,
    blueprint: null,
    previewHtml: null,
    status: null,
    error: null,
    errorStatus: null,
    wasRefunded: false,
    isSubmitting: false,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);
  const refundedRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startWizard = useCallback(() => {
    clearPoll();
    setState((prev) => ({ ...prev, flowState: "wizard", error: null, errorStatus: null }));
  }, [clearPoll]);

  // ─────────────────────────────────────────────────────────────────────
  // C1: generate-blueprint contract — the server expects a FLAT body
  // { prompt, purpose, roles, coreAction }. Roles are sent as string[]
  // (the Wizard collects { name } objects; the server joins strings).
  // ─────────────────────────────────────────────────────────────────────
  const submitBlueprint = useCallback(
    async (wizardData: WizardData) => {
      setState((prev) => ({
        ...prev,
        flowState: "blueprinting",
        error: null,
        errorStatus: null,
        wasRefunded: false,
        isSubmitting: true,
      }));
      try {
        const res = await fetch("/.netlify/functions/generate-blueprint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: wizardData.prompt,
            purpose: wizardData.purpose,
            roles: wizardData.roles.map((r) => r.name),
            coreAction: wizardData.coreAction,
          }),
        });
        if (!res.ok) {
          await throwApiError(res, "Blueprint generation failed");
        }
        const data = (await res.json()) as {
          appId?: string;
          recordId?: string;
          blueprint: BlueprintData;
        };
        const appId = data.appId ?? data.recordId ?? "";
        setState((prev) => ({
          ...prev,
          flowState: "reviewing",
          appId,
          blueprint: data.blueprint,
          error: null,
          errorStatus: null,
          isSubmitting: false,
        }));
        return appId;
      } catch (e) {
        const status =
          (e as ApiError).status ?? null;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          flowState: "error",
          error: msg,
          errorStatus: status,
          isSubmitting: false,
        }));
        throw e;
      }
    },
    [token]
  );

  const approveBlueprint = useCallback(
    async (confirmedSections: string[]) => {
      if (!state.appId || !state.blueprint) return;
      setState((prev) => ({
        ...prev,
        flowState: "coding",
        error: null,
        errorStatus: null,
        wasRefunded: false,
        isSubmitting: true,
      }));
      refundedRef.current = false;

      try {
        // C3: compile-app contract — the server expects { jobId, blueprint }.
        const res = await fetch("/.netlify/functions/compile-app", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            jobId: state.appId,
            blueprint: state.blueprint,
            confirmedSections,
          }),
        });
        if (!res.ok) {
          await throwApiError(res, "Compilation failed");
        }

        // Poll the record directly (PB is the status source of truth —
        // compile-app.mjs writes status + preview_html to it).
        clearPoll();
        pollStartedAtRef.current = Date.now();
        pollRef.current = setInterval(async () => {
          // M2: stop polling after the deadline instead of spinning forever.
          if (Date.now() - pollStartedAtRef.current > POLL_TIMEOUT_MS) {
            clearPoll();
            setState((prev) => ({
              ...prev,
              flowState: "error",
              error:
                "Generation is taking longer than expected. Please try again.",
              errorStatus: null,
              status: null,
              isSubmitting: false,
            }));
            return;
          }
          try {
            const record = await pb
              .collection("generated_apps")
              .getOne(state.appId!);
            const recStatus = record.status as AppStatus;
            setState((prev) => ({ ...prev, status: recStatus }));

            if (recStatus === "ready") {
              clearPoll();
              const html = record.preview_html as string;
              setState((prev) => ({
                ...prev,
                flowState: "previewing",
                previewHtml: html,
                status: "ready",
                isSubmitting: false,
              }));
              callbacks?.onCreditConsumed?.();
            } else if (recStatus === "error") {
              clearPoll();
              setState((prev) => ({
                ...prev,
                flowState: "error",
                error: "Compilation failed after multiple attempts",
                errorStatus: null,
                isSubmitting: false,
              }));
            } else if (recStatus === "downloaded") {
              clearPoll();
              const html = record.preview_html as string;
              setState((prev) => ({
                ...prev,
                flowState: "previewing",
                previewHtml: html,
                status: "downloaded",
                isSubmitting: false,
              }));
            } else if (recStatus === "needs_review") {
              clearPoll();
              // M5: refunds are handled SERVER-SIDE (refund-credit.mjs /
              // compile-app.mjs) with a `refunded` flag — never from the
              // client. Here we only surface the result to the UI.
              const refunded = Boolean(record.refunded);
              refundedRef.current = refunded;
              setState((prev) => ({
                ...prev,
                flowState: "error",
                error: refunded
                  ? "Generation failed after multiple attempts. Your credit has been refunded."
                  : "Generation failed after multiple attempts. You can try again — no charge.",
                errorStatus: null,
                status: "needs_review",
                wasRefunded: refunded,
                isSubmitting: false,
              }));
              if (refunded) callbacks?.onCreditRefund?.(state.appId!);
            }
          } catch {
            // transient polling error — keep polling
          }
        }, POLL_INTERVAL_MS);
      } catch (e) {
        const status = (e as ApiError).status ?? null;
        const msg = e instanceof Error ? e.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          flowState: "error",
          error: msg,
          errorStatus: status,
          isSubmitting: false,
        }));
        throw e;
      }
    },
    [state.appId, state.blueprint, token, clearPoll, callbacks]
  );

  const retryGeneration = useCallback(() => {
    clearPoll();
    setState((prev) => ({
      ...prev,
      flowState: prev.blueprint ? "reviewing" : "wizard",
      error: null,
      errorStatus: null,
      status: null,
      previewHtml: null,
      wasRefunded: false,
      isSubmitting: false,
    }));
    refundedRef.current = false;
  }, [clearPoll]);

  const markDownloaded = useCallback(() => {
    setState((prev) => ({
      ...prev,
      flowState: "downloading",
      status: "downloaded",
    }));
  }, []);

  return {
    ...state,
    startWizard,
    submitBlueprint,
    approveBlueprint,
    retryGeneration,
    markDownloaded,
    clearPoll,
  };
}
