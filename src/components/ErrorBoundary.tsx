import { Component, type ErrorInfo, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Catches any uncaught error in the app tree and shows a friendly,
 * jargon-free fallback instead of a blank screen.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Log for debugging - never shown to the user
    console.error("App Genie crashed:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 text-primary mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-h2 text-neutral-900 mb-3">
            Something went wrong.
          </h1>
          <p className="text-body text-neutral-500 mb-8">
            Let&apos;s try that again. Don&apos;t worry - your apps and credits are safe.
          </p>
          <button
            onClick={this.handleReload}
            className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-xl rounded-xl transition-all shadow-button hover:shadow-lg min-h-touch"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}