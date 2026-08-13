import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CreditCard,
  Loader2,
  AlertTriangle,
  LogOut,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../hooks/usePocketBase";
import { useCredits } from "../hooks/useCredits";
import { createCheckoutSession } from "../lib/stripe";

export default function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { creditsRemaining, planTier, refresh: refreshCredits } = useCredits();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const upgradeStartedRef = useRef(false);

  const isPro = planTier === "pro" || (user?.plan_tier as string) === "pro";
  const email = (user?.email as string) ?? "";

  // Pull the freshest plan/credit values from PocketBase when this page opens
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const handleUpgrade = useCallback(async () => {
    if (!token) return;
    setIsUpgrading(true);
    setUpgradeError(null);
    try {
      const url = await createCheckoutSession("pro", token);
      window.location.assign(url);
    } catch (err) {
      setUpgradeError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setIsUpgrading(false);
    }
  }, [token]);

  // The upgrade modal sends people here with ?upgrade=pro — start checkout automatically
  useEffect(() => {
    if (
      searchParams.get("upgrade") === "pro" &&
      !isPro &&
      token &&
      !upgradeStartedRef.current
    ) {
      upgradeStartedRef.current = true;
      handleUpgrade();
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("upgrade");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  }, [searchParams, isPro, token, handleUpgrade]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="max-w-[640px] mx-auto px-4 py-10">
      <h1 className="text-h2 text-neutral-900 mb-2">Settings</h1>
      <p className="text-body text-neutral-500 mb-8">
        Manage your plan, billing, and account.
      </p>

      {/* Plan & billing */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-h4 text-neutral-900">Your plan</h2>
            <p className="text-body text-neutral-500">
              {isPro ? "Pro" : "Free"}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-selected border border-primary-100 px-5 py-4 mb-6">
          <p className="text-body text-neutral-700">
            Credits remaining:{" "}
            <span className="font-semibold text-neutral-900">
              {creditsRemaining}
            </span>
          </p>
          <p className="text-body-sm text-neutral-500 mt-1">
            {isPro
              ? "Your credits reset to 200 at the start of each billing period."
              : "5 free credits every month — one credit per app. Upgrade for 200/month."}
          </p>
        </div>

        {!isPro ? (
          <div>
            <button
              onClick={handleUpgrade}
              disabled={isUpgrading || !token}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-body-lg rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed min-h-touch"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Opening checkout...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Upgrade to Pro — $29/month
                </>
              )}
            </button>
            {upgradeError && (
              <p className="mt-3 flex items-start gap-2 text-error-600 text-body-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                {upgradeError}
              </p>
            )}
            <p className="mt-3 text-body-sm text-neutral-500 text-center">
              First 7 days free. Cancel anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0 mt-1" />
              <div>
                <p className="text-body text-neutral-800">
                  You&apos;re on the Pro plan — everything is working.
                </p>
                <p className="text-body-sm text-neutral-500">
                  200 credits every month, source code downloads, no watermark.
                </p>
              </div>
            </div>
            <a
              href="mailto:team@mjwapps.com?subject=Manage%20my%20billing"
              className="inline-flex items-center justify-center gap-2 w-full border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-semibold py-4 px-8 text-body rounded-xl transition-colors min-h-touch"
            >
              <Mail className="w-5 h-5" />
              Manage billing
            </a>
            <p className="text-body-sm text-neutral-500">
              For billing changes or to cancel, email{" "}
              <a
                href="mailto:team@mjwapps.com?subject=Cancel%20my%20subscription"
                className="text-primary underline"
              >
                team@mjwapps.com
              </a>
              . You can cancel anytime — your apps stay live.
            </p>
          </div>
        )}
      </section>

      {/* Account */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-500 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-h4 text-neutral-900">Your account</h2>
            <p className="text-body text-neutral-500 truncate">
              Signed in as {email || "you"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center justify-center gap-2 w-full border border-neutral-200 hover:border-error-200 hover:bg-error-50 hover:text-error-700 text-neutral-700 font-semibold py-4 px-8 text-body rounded-xl transition-colors min-h-touch"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </section>
    </div>
  );
}
