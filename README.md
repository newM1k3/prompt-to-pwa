# Prompt-to-PWA

> **Status:** This is a near-deployable MVP with important release prerequisites. The included handover material should be treated as a deployment checklist, especially for PocketBase ownership rules, Stripe webhook idempotency, and refund protection.

## What it does

Prompt-to-PWA is a web application that guides a person from a plain-language app idea to a structured blueprint, generated source, a preview, and a downloadable ZIP. The browser experience covers onboarding, sign-in, a generation wizard, credits, and upgrades. Netlify Functions handle the server-side boundaries for AI generation, payments, refunds, downloads, and health checks, while PocketBase is intended to store users and generated projects.

## How the project is organized

| Location | Purpose |
|---|---|
| `src/` | Contains the React application, screens, components, hooks, and browser-side helpers. |
| `netlify/functions/` | Contains AI, payment, webhook, refund, download, health, and middleware endpoints. |
| `pocketbase/ and schema JSON files` | Describe the planned backend collections and access rules. |
| `scripts/` | Contains environment validation, smoke-test, and supporting checks. |
| `public/` | Contains PWA assets and static files. |
| `.github/workflows/ and netlify.toml` | Contain deployment and hosting configuration. |

## Main technologies

React, TypeScript, Vite, Tailwind CSS, PocketBase, Netlify Functions, Stripe, server-side AI-provider integrations, and PWA tooling.

## Get started

Use **Node.js 20–24** and **npm 10 or later**. The committed `package-lock.json` is the supported dependency snapshot.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite. To prepare a production build, use:

```bash
npm run build
npm run preview
```

## Quality checks

The repository exposes separate checks so they can be run locally or in continuous integration.

```bash
npm run lint
npm run typecheck
npm run build
npm run check
```

`npm run check` runs the three commands above in sequence. These checks validate the source and build configuration; they do not prove that third-party services, browser permissions, payment flows, or device-specific behaviour work in production.

## Configuration and data

Start from `.env.example` and run `npm run validate-env`. Keep AI and Stripe secrets in Netlify or another server-side secret manager; only browser-safe publishable values may use the `VITE_*` prefix.

## Review priorities

1. Create and enforce the required Stripe-event idempotency collection with a unique event identifier before accepting production webhook traffic.
2. Make PocketBase ownership rules for generated applications a release gate so one user cannot view another user’s records.
3. Add a durable, atomic refund marker and test retry/concurrency behaviour before enabling credit refunds.
4. Replace wildcard CORS with the exact production origin(s), and make the README distinguish deterministic checks from unverified live integrations.

## Contributing

Keep changes small and reviewable. Run `npm run check` before opening a pull request, preserve the lockfile when changing dependencies, and avoid committing secrets, customer data, personal exports, or generated build output.

## License

No license file is currently included. Add one before distributing the project as open-source software.
