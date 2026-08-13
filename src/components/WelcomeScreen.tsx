import { useState } from "react";
import { Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  onStartWizard: (prompt: string) => void;
  creditsRemaining: number;
}

export default function WelcomeScreen({ onStartWizard, creditsRemaining }: WelcomeScreenProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 10) {
      setError("Tell us a little more — at least 10 characters");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    onStartWizard(trimmed);
  };

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[640px] text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-primary mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-hero text-neutral-900 mb-3">
            What app would save you 5 hours a week?
          </h1>
          <p className="text-body-lg text-neutral-500 max-w-md mx-auto">
            Describe your idea in plain English. Our AI handles the rest — no coding required.
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Describe the app that would save you 5 hours a week..."
          className="w-full h-[200px] text-lg p-6 rounded-2xl border-2 border-neutral-200 bg-white resize-none focus:border-primary focus:ring-2 focus:ring-primary-100 outline-none transition-colors placeholder:text-neutral-400"
          style={{ fontSize: "18px" }}
        />

        {error && (
          <p className="mt-3 text-error-600 text-body-sm text-left">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="mt-6 w-full bg-primary hover:bg-primary-700 text-white font-bold py-5 px-10 text-2xl rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed min-h-touch"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Building...
            </span>
          ) : (
            "BUILD MY APP"
          )}
        </button>

        <p className="mt-4 text-caption text-neutral-400">
          {creditsRemaining > 0
            ? `${creditsRemaining} of 5 free credits left this month`
            : "No credits left — upgrade to Pro for 200 credits every month"}
        </p>
      </div>
    </div>
  );
}
