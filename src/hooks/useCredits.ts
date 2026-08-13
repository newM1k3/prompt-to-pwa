import { useState, useCallback, useMemo } from "react";
import { useAuth, pb } from "./usePocketBase";

export function useCredits() {
  const { user } = useAuth();
  const [creditsRemaining, setCreditsRemaining] = useState<number>(
    user?.credits_remaining ?? 0
  );
  const [planTier, setPlanTier] = useState<string>(user?.plan_tier ?? "free");

  const refresh = useCallback(async () => {
    if (!pb.authStore.isValid || !user) return;
    try {
      const updated = await pb.collection("users").getOne(user.id);
      setCreditsRemaining(updated.credits_remaining ?? 0);
      setPlanTier(updated.plan_tier ?? "free");
    } catch {
      // silently ignore refresh failures
    }
  }, [user]);

  const checkCredits = useCallback((): boolean => {
    return creditsRemaining > 0;
  }, [creditsRemaining]);

  const getCreditsRemaining = useCallback((): number => {
    return creditsRemaining;
  }, [creditsRemaining]);

  // NOTE: no client-side deductCredit/refundCredit here — M5 removed them.
  // Credits are ONLY written server-side (generate-blueprint.mjs decrements,
  // refund-credit.mjs / compile-app.mjs refund) using admin auth, so a
  // compromised client token can never self-grant credits.

  return {
    creditsRemaining,
    planTier,
    checkCredits,
    getCreditsRemaining,
    refresh,
  };
}

export function useCreditDisplay() {
  const { user } = useAuth();
  const creditsRemaining = (user?.credits_remaining as number) ?? 0;
  const planTier = (user?.plan_tier as string) ?? "free";

  const planLabel = useMemo(() => {
    if (planTier === "pro") return "Pro";
    return "Free";
  }, [planTier]);

  const helperText = useMemo(() => {
    if (planTier === "pro") {
      return `${creditsRemaining} credits remaining this billing period`;
    }
    if (creditsRemaining === 0) {
      return "No credits left — upgrade to Pro for 200/mo";
    }
    return `${creditsRemaining} free credit${creditsRemaining !== 1 ? "s" : ""} remaining`;
  }, [creditsRemaining, planTier]);

  return {
    creditsRemaining,
    planTier,
    planLabel,
    helperText,
    isFree: planTier !== "pro",
    isPro: planTier === "pro",
    isDepleted: creditsRemaining === 0,
  };
}
