import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message: string;
  subtext?: string;
}

/**
 * Reusable loading state: spinner + status text.
 * Used across screens so loading looks consistent everywhere.
 */
export default function LoadingState({ message, subtext }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-20 px-4">
      <div className="text-center max-w-sm">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
        <p className="text-body text-neutral-600 font-medium">{message}</p>
        {subtext && <p className="text-body-sm text-neutral-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}