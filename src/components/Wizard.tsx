import { useState } from "react";
import { Check, X } from "lucide-react";
import type { WizardData, WizardRole } from "../types";

const PURPOSE_OPTIONS = [
  {
    id: "inventory",
    emoji: "📦",
    title: "Inventory & Stock",
    description: "Track what's in the yard, what's running low, and what needs reordering.",
    example: "Like tracking shingles, lumber, and fasteners across your warehouse.",
  },
  {
    id: "staff",
    emoji: "👷",
    title: "Staff & Crew",
    description: "Manage schedules, track who's on which job site, and handle time-off requests.",
    example: "Like knowing which crew is at the Henderson build today.",
  },
  {
    id: "customers",
    emoji: "🤝",
    title: "Customers & Sales",
    description: "Keep customer records, track orders and quotes, and follow up on leads.",
    example: "Like remembering that Johnson Construction always orders on Thursdays.",
  },
  {
    id: "scheduling",
    emoji: "📅",
    title: "Scheduling & Jobs",
    description: "Plan deliveries, schedule job site visits, and manage your calendar.",
    example: "Like making sure the flatbed shows up before the crew does.",
  },
  {
    id: "something_else",
    emoji: "✨",
    title: "Something Else",
    description: "None of these fit? Tell us in your own words.",
    example: "",
  },
];

interface RoleSuggestion {
  name: string;
  emoji: string;
  description: string;
}

const ROLE_SUGGESTIONS: Record<string, RoleSuggestion[]> = {
  inventory: [
    { name: "Yard Manager", emoji: "📋", description: "Needs to see stock levels, reorder points, and supplier info." },
    { name: "Delivery Driver", emoji: "🚛", description: "Needs to see what's on today's truck, delivery addresses, and customer signatures." },
    { name: "Owner / Manager", emoji: "👔", description: "Needs to see the big picture — what's moving, what's sitting, and what the margins look like." },
  ],
  staff: [
    { name: "Foreman", emoji: "👷", description: "Needs today's crew roster, job site address, and equipment checklist." },
    { name: "Scheduler", emoji: "📆", description: "Needs availability calendar, time-off requests, and crew assignments." },
    { name: "HR / Admin", emoji: "📝", description: "Needs certifications tracking, payroll hours, and onboarding docs." },
  ],
  customers: [
    { name: "Sales Rep", emoji: "💼", description: "Needs customer history, open quotes, and follow-up reminders." },
    { name: "Billing Clerk", emoji: "🧾", description: "Needs order totals, payment status, and invoice generation." },
    { name: "Owner", emoji: "👤", description: "Needs pipeline view, top accounts, and monthly revenue." },
  ],
  scheduling: [
    { name: "Dispatcher", emoji: "📡", description: "Needs to assign jobs, track progress, and handle last-minute changes." },
    { name: "Driver / Crew", emoji: "🚚", description: "Needs today's schedule, addresses, and delivery instructions." },
    { name: "Customer", emoji: "🏠", description: "Needs to know when the crew will arrive and what's being delivered." },
  ],
  something_else: [
    { name: "Admin", emoji: "⚙️", description: "Manages everything — users, settings, and data." },
    { name: "User", emoji: "👤", description: "Uses the app day-to-day to get work done." },
    { name: "Viewer", emoji: "👀", description: "Read-only access — can see reports and dashboards." },
  ],
};

interface WizardProps {
  initialPrompt: string;
  onComplete: (data: WizardData) => void;
  onBack: () => void;
  /** True while a generation request is in flight (M4 double-click guard). */
  isSubmitting?: boolean;
  /** Inline generation error to surface on step 3 (M3). */
  error?: string | null;
}

export default function Wizard({
  initialPrompt,
  onComplete,
  onBack,
  isSubmitting = false,
  error = null,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState<string>("");
  const [roles, setRoles] = useState<WizardRole[]>([]);
  const [coreAction, setCoreAction] = useState("");
  const [customRoleInput, setCustomRoleInput] = useState("");

  const suggestedRoles = ROLE_SUGGESTIONS[purpose] ?? ROLE_SUGGESTIONS.something_else;

  const addRole = (name: string) => {
    if (roles.length >= 3) return;
    if (roles.some((r) => r.name === name)) return;
    setRoles([...roles, { name }]);
  };

  const removeRole = (name: string) => {
    setRoles(roles.filter((r) => r.name !== name));
  };

  const addCustomRole = () => {
    const trimmed = customRoleInput.trim();
    if (!trimmed) return;
    addRole(trimmed);
    setCustomRoleInput("");
  };

  const handleNextStep = () => {
    if (step === 1 && purpose) setStep(2);
    else if (step === 2 && roles.length > 0) setStep(3);
    else if (step === 3 && coreAction.trim().length >= 10) {
      onComplete({
        prompt: initialPrompt,
        purpose,
        roles,
        coreAction: coreAction.trim(),
      });
    }
  };

  const progressDots = [1, 2, 3].map((s) => (
    <div
      key={s}
      className={`w-3 h-3 rounded-full transition-colors ${
        s === step ? "bg-primary" : s < step ? "bg-primary-300" : "bg-neutral-300"
      }`}
    />
  ));

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      {/* Progress Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-neutral-200 px-4 py-4">
        <div className="max-w-[640px] mx-auto flex items-center justify-between">
          <button
            onClick={step === 1 ? onBack : () => setStep(step - 1)}
            className="text-neutral-500 hover:text-neutral-800 text-body-sm font-medium transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-caption text-neutral-500">Step {step} of 3</span>
            <div className="flex gap-2">{progressDots}</div>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-[640px]">
          {/* STEP 1: Purpose */}
          {step === 1 && (
            <>
              <h2 className="text-h2 text-neutral-900 mb-2">What&apos;s this app for?</h2>
              <p className="text-body text-neutral-500 mb-8">Pick the one that fits best.</p>
              <div className="space-y-3">
                {PURPOSE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPurpose(opt.id)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                      purpose === opt.id
                        ? "border-primary bg-primary-50 shadow-elevated"
                        : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-card"
                    }`}
                  >
                    <div className="flex gap-4">
                      <span className="text-3xl flex-shrink-0">{opt.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-h4 text-neutral-900">{opt.title}</h3>
                          {purpose === opt.id && (
                            <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Check className="w-4 h-4 text-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-body-sm text-neutral-600 mt-1">{opt.description}</p>
                        {opt.example && (
                          <p className="text-caption text-neutral-400 italic mt-1">{opt.example}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-8">
                <button
                  onClick={handleNextStep}
                  disabled={!purpose}
                  className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-xl rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-h-touch"
                >
                  Continue
                </button>
              </div>
              <p className="text-center text-caption text-neutral-400 mt-4">Takes about 10 seconds</p>
            </>
          )}

          {/* STEP 2: Roles */}
          {step === 2 && (
            <>
              <h2 className="text-h2 text-neutral-900 mb-2">Who will use this app?</h2>
              <p className="text-body text-neutral-500 mb-8">
                Add up to 3 types of people. We&apos;ll make sure each one sees what they need.
              </p>

              <p className="text-caption text-neutral-400 font-semibold uppercase tracking-wide mb-3">
                Suggested for {PURPOSE_OPTIONS.find((p) => p.id === purpose)?.title ?? "your app"}
              </p>

              <div className="space-y-3 mb-6">
                {suggestedRoles.map((suggestion) => {
                  const isAdded = roles.some((r) => r.name === suggestion.name);
                  return (
                    <div
                      key={suggestion.name}
                      className={`p-5 rounded-2xl border-2 transition-all ${
                        isAdded
                          ? "border-primary bg-primary-50"
                          : "border-neutral-200 bg-white hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <span className="text-2xl flex-shrink-0">{suggestion.emoji}</span>
                          <div>
                            <h3 className="text-h5 text-neutral-900">{suggestion.name}</h3>
                            <p className="text-body-sm text-neutral-500 mt-1">{suggestion.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => (isAdded ? removeRole(suggestion.name) : addRole(suggestion.name))}
                          className={`flex-shrink-0 px-4 py-2 rounded-xl text-caption font-semibold transition-all min-h-touch ${
                            isAdded
                              ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                              : "bg-primary text-white hover:bg-primary-700"
                          }`}
                        >
                          {isAdded ? "SELECTED" : "+ ADD"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom role input */}
              {roles.length < 3 && (
                <div className="p-5 rounded-2xl border-2 border-dashed border-neutral-300 bg-surface-hover">
                  <div className="flex gap-3 items-center">
                    <span className="text-2xl">✏️</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={customRoleInput}
                        onChange={(e) => setCustomRoleInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addCustomRole(); }}
                        placeholder="Add a different role..."
                        className="w-full text-input bg-transparent outline-none placeholder:text-neutral-400"
                      />
                    </div>
                    <button
                      onClick={addCustomRole}
                      disabled={!customRoleInput.trim()}
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-neutral-200 text-neutral-700 text-caption font-semibold hover:bg-neutral-300 transition-colors disabled:opacity-40 min-h-touch"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Selected roles chips */}
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {roles.map((role) => (
                    <span
                      key={role.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-caption font-medium"
                    >
                      {role.name}
                      <button onClick={() => removeRole(role.name)} className="hover:text-primary-900">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8 flex justify-between items-center">
                <span className="text-caption text-neutral-400">
                  {roles.length} of 3 selected
                </span>
                <button
                  onClick={handleNextStep}
                  disabled={roles.length === 0}
                  className="bg-primary hover:bg-primary-700 text-white font-bold py-4 px-8 text-xl rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-h-touch"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* STEP 3: Core Action */}
          {step === 3 && (
            <>
              <h2 className="text-h2 text-neutral-900 mb-2">
                If this app could only do ONE thing perfectly, what would it be?
              </h2>
              <p className="text-body text-neutral-500 mb-6">
                Don&apos;t overthink it. What&apos;s the one thing that would make you say &quot;this was worth it&quot;?
              </p>

              <div className="bg-primary-50 rounded-2xl p-5 mb-6">
                <p className="text-caption text-primary-700 font-semibold mb-3">Examples:</p>
                <div className="space-y-3">
                  <p className="text-body-sm text-neutral-700">
                    &ldquo;When a roll of underlayment drops below 10 units, the app texts me automatically.&rdquo;
                  </p>
                  <p className="text-body-sm text-neutral-700">
                    &ldquo;I can see every order from Johnson Construction in the last 6 months in two taps.&rdquo;
                  </p>
                  <p className="text-body-sm text-neutral-700">
                    &ldquo;My foreman opens the app and immediately sees which job site he&apos;s on today — nothing else.&rdquo;
                  </p>
                </div>
              </div>

              <textarea
                value={coreAction}
                onChange={(e) => setCoreAction(e.target.value)}
                placeholder="Type your ONE thing here..."
                className="w-full h-[140px] text-input p-5 rounded-2xl border-2 border-neutral-200 bg-white resize-none focus:border-primary focus:ring-2 focus:ring-primary-100 outline-none transition-colors placeholder:text-neutral-400"
              />

              <p className="text-caption text-neutral-400 mt-2">
                It doesn&apos;t have to be perfect. You can always try again.
              </p>

              <div className="mt-8">
                {error && (
                  <p
                    role="alert"
                    className="mb-4 p-4 rounded-xl bg-warning-50 border border-warning-200 text-body-sm text-warning-700"
                  >
                    {error}
                  </p>
                )}
                <button
                  onClick={handleNextStep}
                  disabled={coreAction.trim().length < 10 || isSubmitting}
                  className="w-full bg-primary hover:bg-primary-700 text-white font-bold py-5 px-10 text-2xl rounded-xl transition-all shadow-button hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-h-touch"
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
              </div>
              <p className="text-center text-caption text-neutral-400 mt-4">
                Step 3 of 3 — Then we build it. Takes about 60 seconds.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
