export interface WizardRole {
  name: string;
}

export interface WizardData {
  prompt: string;
  purpose: string;
  roles: WizardRole[];
  coreAction: string;
}

export type AppStatus = "blueprinting" | "coding" | "ready" | "downloaded" | "error" | "needs_review";

// Canonical blueprint schema (single source of truth — matches
// generate-blueprint.mjs validation, compile-app.mjs prompt builder,
// and scripts/test-prompts.mjs). See TECHNICAL-ARCHITECTURE.
export type PrimaryView = "list" | "map" | "calendar" | "form" | "dashboard";

export interface BlueprintData {
  app_name: string;
  actors: string[];
  actions: string[];
  data_fields: string[];
  primary_view: PrimaryView;
}

export interface GeneratedApp {
  id: string;
  app_name: string;
  original_prompt: string;
  blueprint_json: BlueprintData;
  status: AppStatus;
  preview_html: string;
  created: string;
  user: string;
}
