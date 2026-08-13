import { useState } from "react";
import { Check, Loader2, Wand2, AlertTriangle, RefreshCw } from "lucide-react";
import type { BlueprintData } from "../types";

interface BlueprintReviewProps {
  blueprint: BlueprintData;
  status: string | null;
  /** Inline error from the generation flow (M3) — shown instead of crashing. */
  error?: string | null;
  isSubmitting?: boolean;
  onApprove: (confirmedSections: string[]) => void;
  onEdit: () => void;
  onRetry?: () => void;
}

export default function BlueprintReview({
  blueprint,
  status,
  error,
  isSubmitting = false,
  onApprove,
  onEdit,
  onRetry,
}: BlueprintReviewProps) {
  const isCoding = status === "coding" || isSubmitting;

  // Build checkbox state from the canonical blueprint shape
  const allActionIds = blueprint.actions.map((a, i) => `${i}:${a}`);
  const allFieldIds = blueprint.data_fields.map((f, i) => `${i}:${f}`);

  const [checkedActions, setCheckedActions] = useState<Set<string>>(
    new Set(allActionIds)
  );
  const [checkedFields, setCheckedFields] = useState<Set<string>>(
    new Set(allFieldIds)
  );

  const toggleAction = (id: string) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleField = (id: string) => {
    setCheckedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = () => {
    const confirmedSections = [
      ...Array.from(checkedActions),
      ...Array.from(checkedFields),
    ];
    onApprove(confirmedSections);
  };

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-neutral-200 px-4 py-4">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <h2 className="text-h3 text-neutral-900">{blueprint.app_name}</h2>
          <button
            onClick={onEdit}
            className="text-body-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            ← Edit Wizard
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-[800px] mx-auto px-4 py-8 w-full">
        {isCoding ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-primary mb-6 animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-h2 text-neutral-900 mb-2">Building your app...</h2>
            <p className="text-body text-neutral-500 max-w-md mx-auto">
              Designer AI is generating your app. This usually takes about 30-60 seconds.
            </p>
            <div className="mt-8 w-full max-w-md mx-auto bg-neutral-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
            </div>
            <p className="text-caption text-neutral-400 mt-3">Status: Coding</p>
          </div>
        ) : error ? (
          // M3: generation errors are now visible — friendly message + retry.
          <div className="bg-warning-50 border border-warning-200 rounded-2xl p-6 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-h5 text-neutral-900 mb-1">
                  We couldn&apos;t finish this one
                </h3>
                <p className="text-body-sm text-neutral-600 mb-4">{error}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-warning-600 hover:bg-warning-700 text-white font-semibold rounded-xl transition-colors min-h-touch text-body-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={onEdit}
                    className="inline-flex items-center gap-2 px-4 py-3 text-body-sm text-neutral-700 hover:text-neutral-900 font-medium underline-offset-4 hover:underline transition-colors min-h-touch"
                  >
                    Edit Wizard
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {status === null && (
              <div className="bg-success-50 border border-success-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
                <Check className="w-5 h-5 text-success flex-shrink-0" />
                <p className="text-body-sm text-success-800">
                  Designer AI finished. Ready to build?
                </p>
              </div>
            )}

            {/* Actors */}
            <section className="mb-8">
              <h3 className="text-h4 text-neutral-900 mb-4">Who it&apos;s for</h3>
              <div className="flex flex-wrap gap-2">
                {blueprint.actors.map((actor) => (
                  <span
                    key={actor}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 text-body-sm text-neutral-700"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </section>

            {/* Primary view */}
            <section className="mb-8">
              <h3 className="text-h4 text-neutral-900 mb-4">Primary view</h3>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-body-sm font-medium capitalize">
                {blueprint.primary_view}
              </span>
            </section>

            {/* Core Actions */}
            <section className="mb-8">
              <h3 className="text-h4 text-neutral-900 mb-4">Core Actions</h3>
              <p className="text-caption text-neutral-400 mb-4">
                Uncheck anything you don&apos;t need.
              </p>
              <div className="space-y-3">
                {blueprint.actions.map((action, i) => {
                  const actionId = `${i}:${action}`;
                  return (
                    <button
                      key={actionId}
                      onClick={() => toggleAction(actionId)}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        checkedActions.has(actionId)
                          ? "border-primary-200 bg-white"
                          : "border-neutral-200 bg-neutral-50 opacity-60"
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-11 h-11 rounded-lg border-2 flex items-center justify-center transition-all ${
                          checkedActions.has(actionId)
                            ? "bg-primary border-primary text-white"
                            : "border-neutral-300 bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {checkedActions.has(actionId) && <Check className="w-5 h-5" />}
                      </span>
                      <span className="text-body text-neutral-800">{action}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Data Fields */}
            <section className="mb-8">
              <h3 className="text-h4 text-neutral-900 mb-4">Data Fields</h3>
              <p className="text-caption text-neutral-400 mb-4">
                Uncheck anything you don&apos;t need.
              </p>
              <div className="space-y-3">
                {blueprint.data_fields.map((field, i) => {
                  const fieldId = `${i}:${field}`;
                  return (
                    <button
                      key={fieldId}
                      onClick={() => toggleField(fieldId)}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        checkedFields.has(fieldId)
                          ? "border-primary-200 bg-white"
                          : "border-neutral-200 bg-neutral-50 opacity-60"
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-11 h-11 rounded-lg border-2 flex items-center justify-center transition-all ${
                          checkedFields.has(fieldId)
                            ? "bg-primary border-primary text-white"
                            : "border-neutral-300 bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {checkedFields.has(fieldId) && <Check className="w-5 h-5" />}
                      </span>
                      <span className="text-body text-neutral-800">{field}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Generate Button */}
            <div className="mt-10 pb-8">
              <button
                onClick={handleApprove}
                disabled={isCoding}
                className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-5 px-10 text-2xl rounded-xl transition-all shadow-button hover:shadow-lg flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed min-h-touch"
              >
                <Wand2 className="w-6 h-6" />
                GENERATE MY APP
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
