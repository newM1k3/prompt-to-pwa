# Prompt-to-PWA Toolkit — Component Style Guide

> Visual language reference for every UI component in the app.
> Dave can code directly from these specs — every value is concrete.
> Target user: Frank (55+, roofing supply owner, never written code).

---

## Font Strategy

**Primary font: Figtree** (Google Fonts) — warm, friendly sans-serif with high legibility.
Large x-height and open letterforms make it excellent for older readers.

```html
<!-- Add to index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

**Monospace font: JetBrains Mono** — for code snippets, app names in the wizard, or technical output.
Only used for machine-generated content; never for user-facing explanations.

**Fallback stack:** `Figtree, ''Segoe UI'', system-ui, -apple-system, sans-serif`

---

## Typography Scale in Practice

| Token | Size | Use |
|-------|------|-----|
| `text-hero` | 48px / 3rem | Welcome screen main heading only |
| `text-h1` | 32px / 2rem | App name on blueprint, page titles |
| `text-h2` | 28px / 1.75rem | Section headers, wizard card titles |
| `text-h3` | 24px / 1.5rem | Dashboard item titles |
| `text-h4` | 22px / 1.375rem | **Minimum heading size**, component subtitles |
| `text-h5` | 20px / 1.25rem | Small headings, label groups |
| `text-body-lg` | 20px / 1.25rem | **Primary body text** (above 18px minimum) |
| `text-body` | 18px / 1.125rem | Secondary body, descriptions |
| `text-body-sm` | 16px / 1rem | Meta text, timestamps, step counters |
| `text-caption` | 14px / 0.875rem | Labels, badges, legal text only |

**Rule:** No user-facing text below 14px. Primary content is 20px. Body descriptions are 18px.

---

## Component Specs

### 1. WelcomeScreen

**Purpose:** First screen Frank sees. One big textarea, one big button. Nothing intimidating.

**Layout:**
```
┌────────────────────────────────────┐
│                                    │
│         [app icon / logo]          │
│                                    │
│   What kind of app do you want     │
│          to build today?           │
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │  "I need an app for my       │  │
│  │   roofing supply business    │  │
│  │   where customers can..."    │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │       BUILD MY APP  →        │  │
│  └──────────────────────────────┘  │
│                                    │
│   No coding needed. Just describe  │
│   your app in plain English.       │
│                                    │
└────────────────────────────────────┘
```

**Container:** `max-width: 640px`, centered horizontally and vertically. `padding: 2rem` (32px) on all sides.

**Heading:**
- Tag: `<h1>`
- Font: `text-hero` (48px, 700 weight)
- Color: `neutral-900` (#1C1917)
- Bottom margin: `space-4` (16px)

**Subtitle:**
- Font: `text-body-lg` (20px, 400 weight)
- Color: `neutral-600` (#57534E)
- Bottom margin: `space-8` (32px)

**Textarea:**
- Height: **200px**
- Width: 100% of container
- Padding: `space-5` (20px) all sides
- Font: `text-input` (20px, Figtree)
- Placeholder color: `neutral-400` (#A8A29E)
- Border: 2px solid `neutral-300` (#D6D3D1) — warm gray, not cold
- Border radius: `radius-2xl` (24px)
- Background: white
- Focus state: border changes to `primary-600` (#2563EB), 3px width, `ring-offset-2`
- Placeholder text example: *"I need an app for my roofing supply business where customers can browse products, place orders, and check delivery status..."*
- Resize: vertical only

**Primary CTA Button ("Build My App"):**
- Text: `BUILD MY APP` (uppercase, like a confident hammer)
- Font: `text-h4` (22px, 700 weight, Figtree)
- Background: `primary-600` (#2563EB)
- Text color: white
- Border: none
- Border radius: `radius-md` (8px)
- **Minimum height: 56px** (exceeds 48px minimum)
- **Padding: 20px 40px** (horizontal generous for big touch target)
- Width: full width on mobile (< 640px) / `auto` on desktop (content-fit)
- Hover: background darkens to `primary-700` (#1D4ED8), adds `shadow-button` (`0 2px 8px rgba(37, 99, 235, 0.3)`)
- Active/pressed: background `primary-800` (#1E40AF), shadow removed
- Focus: `focus-ring` (3px solid #2563EB, 2px offset)
- Disabled: background `neutral-300` (#D6D3D1), text `neutral-400`, cursor not-allowed
- Transition: `transition-base` (200ms ease) on background-color, box-shadow

**Reassurance text (below button):**
- Font: `text-body-sm` (16px, 400 weight)
- Color: `neutral-500` (#78716C)
- Top margin: `space-4` (16px)
- Text: *"No coding needed. Just describe your app in plain English."*
- Centered

**States:**
- **Default:** as described above
- **Typing:** textarea has content, button still enabled
- **Empty submit:** button shakes briefly, textarea border turns `error-500` for 1s
- **Submitting:** button shows spinner, text reads "Thinking..."
- **Error:** inline message below textarea in `error-600`, `text-body` (18px)


### 2. Wizard (3-Step Cards)

**Purpose:** Frank refines his app description through 3 simple choices.
Each step is one card — pick one, move to the next. Progress is always visible.

**Layout:**
```
┌────────────────────────────────────┐
│  ● ○ ○      Step 1 of 3            │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  🎯                          │  │
│  │  What type of app is this?   │  │
│  │  Choose the option that best │  │
│  │  matches what you need.      │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  🏪  Storefront              │  │ ← unselected
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📋  Service Booking     ✓   │  │ ← selected (blue border)
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📊  Dashboard / Tracker     │  │ ← unselected
│  └──────────────────────────────┘  │
│                                    │
│         Step 1 of 3               │
│                                    │
└────────────────────────────────────┘
```

**Progress Indicator:**
- Position: top of the wizard area, centered
- Style: three dots `● ○ ○` separated by `space-2` (8px)
- Filled dot (current/complete): `primary-600` (#2563EB), 12px diameter
- Empty dot (future): `neutral-300` (#D6D3D1), 12px diameter
- Completed dot: `primary-600` with a subtle checkmark (or keep filled — simple)
- Spacing between dots and step label: `space-3` (12px)
- Step label: `text-body-sm` (16px), `neutral-500`, centered below dots
- Animation: dots transition color with `transition-base` (200ms ease)

**Instruction Card (top):**
- White background
- Border: 1px solid `neutral-200` (#E7E5E4)
- Border radius: `radius-xl` (16px)
- Padding: `space-6` (24px)
- Box shadow: `shadow-card`
- Content:
  - Emoji icon: 32px font size, display block, bottom margin `space-3` (12px)
  - Title: `text-h4` (22px, 700 weight), `neutral-900`, bottom margin `space-2` (8px)
  - Description: `text-body` (18px, 400 weight), `neutral-600` (#57534E)

**Choice Cards (option list):**
- Stacked vertically with `space-3` (12px) gap
- **Default state:**
  - White background
  - Border: 1px solid `neutral-200` (#E7E5E4)
  - Border radius: `radius-xl` (16px)
  - Padding: `space-5` (20px)
  - Box shadow: `shadow-card`
  - Min-height: **48px** (touch target minimum — actually much taller with padding)
  - Cursor: pointer
  - Transition: `transition-base` on border-color, background-color, box-shadow
- **Content layout (horizontal):**
  ```
  [🛒 icon 24px]  Storefront                    [→]
                   Sell products, take payments
  ```
  - Icon: 24px emoji or Lucide icon, flex-shrink 0
  - Text container: flex-1, `space-2` left margin
  - Title: `text-h5` (20px, 600 weight), `neutral-900`
  - Description: `text-body` (18px, 400 weight), `neutral-600`
  - Right indicator: chevron or nothing, `neutral-400`

- **Hover state:**
  - Border color: `neutral-400` (#A8A29E)
  - Box shadow: `shadow-elevated`

- **Selected state:**
  - Border: 2px solid `primary-600` (#2563EB)
  - Background: `primary-50` (#EFF6FF)
  - Title color stays `neutral-900`, description stays `neutral-600`
  - Right indicator: blue checkmark circle (Lucide `CheckCircle2`, `primary-600`)
  - Transition: `transition-base`

- **Focus state:**
  - `focus-ring` (3px solid #2563EB, 2px offset)

**Step Counter (bottom):**
- `text-body-sm` (16px), `neutral-500`, centered
- Shows "Step 1 of 3"
- Below all cards with `space-6` (24px) margin

**Navigation:**
- "Back" link: `text-body` (18px), `neutral-600`, underline on hover
- "Continue" button: matches primary CTA styling, but text is "Continue →"


### 3. BlueprintReview

**Purpose:** Frank sees what the AI understood from his description. A clear, organized summary before the app is built. Never intimidating — always reassuring.

**Layout:**
```
┌────────────────────────────────────┐
│                                    │
│  Frank''s Roofing Supply App        │  ← app name as h1
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📱 App Type: Storefront     │  │  ← labeled card grid
│  ├──────────────────────────────┤  │
│  │  🎨 Style: Clean & Modern   │  │
│  ├──────────────────────────────┤  │
│  │  📄 Pages: 4                 │  │
│  │  • Home (product grid)       │  │
│  │  • Product Detail            │  │
│  │  • Cart & Checkout           │  │
│  │  • Order Tracking            │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Data your app will track:   │  │
│  │  ☑  Products (name, price)   │  │
│  │  ☑  Customers (name, email)  │  │
│  │  ☑  Orders (items, status)   │  │
│  │  ☐  Inventory (optional)     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ══════════════════════════════    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  60%  │  ← progress bar
│  Compiling your app...              │
│                                    │
│  This usually takes about 30       │
│  seconds. We''re building your app  │
│  from scratch.                     │
│                                    │
└────────────────────────────────────┘
```

**App Name Heading:**
- Tag: `<h1>`
- Font: `text-h1` (32px, 700 weight), Figtree
- Color: `neutral-900`
- Bottom margin: `space-8` (32px)
- Text: the app name the AI extracted from Frank''s description

**Blueprint Cards (grid):**
- Container: CSS grid, 1 column on mobile, 2 columns on tablet+ (≥768px)
- Gap: `space-4` (16px)
- Each card:
  - Background: white
  - Border: 1px solid `neutral-200`
  - Border radius: `radius-lg` (12px)
  - Padding: `space-5` (20px)
  - Box shadow: `shadow-card`
  - Min-height: **48px** (actually much more with content)

- **Card internal:**
  - Label (e.g., "App Type"): `text-body-sm` (16px, 600 weight), `neutral-500`, uppercase tracking `letter-spacing-wide`
  - Value (e.g., "Storefront"): `text-body-lg` (20px, 600 weight), `neutral-900`
  - If value is a list (e.g., Pages): each item on new line, `text-body` (18px), `neutral-600`, with `• ` prefix

**Data Fields Checklist:**
- Card with same styling as above
- Header: "Data your app will track:" — `text-h5` (20px, 600 weight), `neutral-900`
- Each field row:
  - Checkbox: 24px × 24px, Lucide checkbox icon
  - All checked by default (AI proposes all)
  - Label: `text-body` (18px, 400), `neutral-800`
  - Min-height per row: **48px** (touch target)
  - Padding: `space-2` (8px) vertical
  - Frank can tap to uncheck fields he doesn''t want

**Compilation Status:**
- Divider: 1px solid `neutral-200`, my `space-6` (24px)
- Progress bar:
  - Track: full width, height 8px, `neutral-200` background, `radius-full`
  - Fill: `primary-600` (#2563EB), `radius-full`, width animates 0→100%
  - Animation: `transition-compose` (400ms ease), indeterminate animation of sliding gradient
  - Top margin: `space-6` (24px), bottom margin: `space-4` (16px)
- Status text:
  - Above bar while compiling: `text-body-lg` (20px, 600 weight), `neutral-700`
  - Messages cycle through: "Understanding your description..." → "Designing the layout..." → "Writing the code..." → "Almost ready..."
  - Below bar: `text-body` (18px), `neutral-500`
  - Text: *"This usually takes about 30 seconds. We''re building your app from scratch."*

**States:**
- **Loading/compiling:** Progress bar animating, status text cycling
- **Complete:** Progress bar 100%, status changes to "Ready to preview!", button appears
- **Error:** Progress bar turns `error-500`, status text in `error-600` explains what went wrong, "Try Again" button

**Tone:** Reassuring, clear, minimal. Every piece of information has a clear label. Nothing looks like code. Frank should feel in control.


### 4. PreviewSandbox

**Purpose:** Frank sees his app running in a phone frame. He can interact with it, then download it or start over.

**Layout:**
```
┌────────────────────────────────────┐
│         Your App is Ready!         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ╔══════════════════════════╗ │  │
│  │ ║    Frank''s Roofing       ║ │  │  ← phone frame
│  │ ║    Supply                ║ │  │    (max-width: 390px)
│  │ ║                         ║ │  │
│  │ ║  ┌──────┐ ┌──────┐     ║ │  │
│  │ ║  │Shingle│ │Gutter │     ║ │  │
│  │ ║  │ $42   │ │ $18   │     ║ │  │
│  │ ║  └──────┘ └──────┘     ║ │  │
│  │ ║                         ║ │  │
│  │ ╚══════════════════════════╝ │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────┐ ┌──────────────┐ │
│  │ ↓ Download   │ │  Try Again   │ │  ← actions row
│  └──────────────┘ └──────────────┘ │
│                                    │
└────────────────────────────────────┘
```

**Heading:**
- `text-h3` (24px, 700 weight), `neutral-900`
- Text: "Your App is Ready!"
- Centered, bottom margin `space-6` (24px)

**Phone Frame:**
- Outer container:
  - `max-width: 390px` (iPhone 14 width)
  - Centered with `margin: 0 auto`
  - Background: `neutral-900` (#1C1917) — dark phone bezel
  - Border radius: `radius-2xl` (24px) — like a real phone
  - Padding: 12px (simulates bezel)
  - Box shadow: `shadow-lg`
- Inner iframe:
  - Width: 100% of phone frame
  - Aspect ratio: approximately 9:19.5 (portrait phone)
  - Min-height: 600px, max-height: 70vh
  - Border radius: `radius-lg` (12px)
  - Background: white
  - Border: none
  - Scrolling: yes (let Frank scroll the prototype)

**Action Buttons (below phone frame):**
- Container: flex row on desktop (≥640px), stacked column on mobile
- Gap: `space-4` (16px)
- Top margin: `space-8` (32px)
- Max-width: 500px, centered

**Primary Action — "Download App":**
- Text: "↓ Download App"
- Font: `text-h5` (20px, 600 weight)
- Background: `primary-600` (#2563EB)
- Text: white
- Border: none
- Border radius: `radius-md` (8px)
- **Min-height: 56px**
- Padding: 16px 40px
- Flex: 1 on desktop, full width on mobile
- Hover: `primary-700`, `shadow-button`
- Focus: `focus-ring`
- **Locked state (non-Pro):**
  - Background: `neutral-300` (#D6D3D1)
  - Text: `neutral-500`
  - Cursor: not-allowed
  - Small lock icon (Lucide `Lock`, 16px) before text
  - "Pro" badge: small pill next to button, `warning-500` background, white text, `text-caption` (14px), border radius `radius-full`

**Secondary Action — "Try Again":**
- Text: "Try Again"
- Font: `text-h5` (20px, 600 weight)
- Background: transparent
- Text: `primary-600` (#2563EB)
- Border: 2px solid `primary-600`
- Border radius: `radius-md` (8px)
- **Min-height: 56px**
- Padding: 16px 40px
- Flex: 1 on desktop, full width on mobile
- Hover: background `primary-50` (#EFF6FF), border `primary-700`
- Focus: `focus-ring`
- This restarts the wizard from Step 1

**States:**
- **Default:** both buttons visible, Download is primary
- **Download locked (free tier):** Download grayed out with lock icon + Pro badge
- **Downloading:** Download button shows spinner, text changes to "Preparing..."
- **Download complete:** button text changes to "✓ Downloaded", green checkmark, disabled


### 5. Dashboard

**Purpose:** Frank sees all the apps he has built. Clean list, easy to understand. Friendly empty state when he''s new.

**Layout:**
```
┌────────────────────────────────────┐
│  Your Apps                         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Frank''s Roofing Supply       │  │
│  │ Aug 10, 2026                 │  │
│  │ ┌──────┐ ┌──────┐ ┌──────┐  │  │
│  │ │ Ready│ │Preview│ │Delete│  │  │
│  │ └──────┘ └──────┘ └──────┘  │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Customer Feedback Form       │  │
│  │ Aug 8, 2026                  │  │
│  │ ┌──────┐ ┌──────┐ ┌──────┐  │  │
│  │ │ Ready│ │Preview│ │Delete│  │  │
│  │ └──────┘ └──────┘ └──────┘  │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘

EMPTY STATE:
┌────────────────────────────────────┐
│  Your Apps                         │
│                                    │
│            ┌──────────┐            │
│            │  📱 ✨   │            │
│            │          │            │
│            │ No apps  │            │
│            │   yet    │            │
│            └──────────┘            │
│                                    │
│   You haven''t built any apps yet.  │
│   Tap the button below to create   │
│   your first one!                  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │     + Create Your First App  │  │
│  └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘
```

**Page Header:**
- `text-h2` (28px, 700 weight), `neutral-900`
- Text: "Your Apps"
- Bottom margin: `space-8` (32px)

**App List Items:**
- Container: vertical stack, `space-3` (12px) gap
- Each item:
  - Background: white
  - Border: 1px solid `neutral-200`
  - Border radius: `radius-lg` (12px)
  - Padding: `space-5` (20px)
  - Box shadow: `shadow-card`
  - Min-height: **48px** (easily exceeds with content)
  - Hover: border `neutral-400`, `shadow-elevated`
  - Transition: `transition-base`

- **Item content (horizontal layout):**
  ```
  [App Name]                    [Status Badge]
  [Date]                        [Actions]
  ```
  - App name: `text-h4` (22px, 600 weight), `neutral-900`, `space-2` bottom margin
  - Date: `text-body-sm` (16px, 400 weight), `neutral-500`
  - Status badge + actions: right-aligned, flex

**Status Badges:**
- Base style: `text-caption` (14px, 600 weight), padding `space-1` (4px) `space-2` (8px), border radius `radius-full`

| Status | Background | Text Color | Border | Icon |
|--------|-----------|------------|--------|------|
| Ready | `success-100` (#DCFCE7) | `success-700` (#15803D) | 1px solid `success-200` | Lucide `CheckCircle2` 14px |
| Coding | `primary-100` (#DBEAFE) | `primary-700` (#1D4ED8) | 1px solid `primary-200` | Spinner animation 14px |
| Failed | `warning-100` (#FEF3C7) | `warning-700` (#B45309) | 1px solid `warning-200` | Lucide `AlertTriangle` 14px |

**Action Buttons (per item):**
- Row of small buttons, `space-2` (8px) gap
- "Preview" button:
  - Background: transparent, text `primary-600`
  - Font: `text-body-sm` (16px, 500 weight)
  - Padding: `space-1` (4px) `space-3` (12px)
  - Border: 1px solid `primary-200`
  - Border radius: `radius-md` (8px)
  - Min-height: **48px**
  - Hover: `primary-50` background
- "Delete" button:
  - Background: transparent, text `neutral-500`
  - Font: `text-body-sm` (16px, 400 weight)
  - Padding: `space-1` (4px) `space-3` (12px)
  - Border: 1px solid `neutral-200`
  - Border radius: `radius-md` (8px)
  - Min-height: **48px**
  - Hover: `error-50` background, text `error-600`, border `error-200`

**Empty State:**
- Container: centered, `max-width: 400px`, margin auto
- Illustration area: `space-16` (64px) × `space-16` (64px), `neutral-100` background, `radius-2xl`, flex center
  - Contains: large emoji (48px) or placeholder for illustration
  - Bottom margin: `space-6` (24px)
- Message: `text-body-lg` (20px), `neutral-600`, centered
- Sub-message: `text-body` (18px), `neutral-500`, centered, `space-3` (12px) top margin
- CTA button: "Create Your First App" — matches primary CTA styling, centered below, `space-8` (32px) top margin

**Pagination (if >10 items):**
- `text-body-sm` (16px), `neutral-500`
- "← Previous" / "Next →" links with `space-8` (32px) between
- Centered below list, `space-8` top margin


### 6. Shared Patterns

**Focus Ring (applied to all interactive elements):**
```css
*:focus-visible {
  outline: 3px solid #2563EB;
  outline-offset: 2px;
}
```
Applies to: buttons, links, inputs, textareas, selectable cards, checkboxes.

**Loading Spinner:**
- Lucide `Loader2` with `animate-spin` class
- Size: 24px for buttons, 20px for status badges
- Color: inherits from context (white on blue buttons, `primary-600` elsewhere)

**Error Messages:**
- Container: `error-50` background, `error-600` text
- Border: 1px solid `error-200`
- Border radius: `radius-md` (8px)
- Padding: `space-4` (16px)
- Font: `text-body` (18px, 400 weight)
- Icon: Lucide `AlertCircle` 20px, `error-600`, `space-2` right margin

**Success Messages:**
- Container: `success-50` background, `success-700` text
- Border: 1px solid `success-200`
- Same sizing as error messages

**Tooltips (Pro badge, etc.):**
- Background: `neutral-800` (#292524)
- Text: white, `text-caption` (14px)
- Padding: `space-1` (4px) `space-2` (8px)
- Border radius: `radius-sm` (4px)
- Box shadow: `shadow-md`
- Arrow: CSS triangle pointing to target


---

## Accessibility Checklist

### Touch Targets
- [ ] All buttons: minimum **48×48px** (primary CTA is 56px)
- [ ] All tappable cards/list items: minimum **48px** height
- [ ] All checkboxes and radio options: minimum **48px** height per row
- [ ] All links in body text: minimum **48px** tall (or sufficient surrounding padding)
- [ ] Wizard choice cards: full-width, minimum 64px tall with padding
- [ ] Action buttons (Preview, Delete): minimum 48px tall

### Color Contrast (WCAG AA)
- [ ] Normal text (<18px): contrast ratio ≥ **4.5:1** against background
  - `neutral-900` (#1C1917) on white: **16.7:1** ✓
  - `neutral-600` (#57534E) on white: **5.6:1** ✓
  - `primary-600` (#2563EB) on white: **5.3:1** ✓ (borders don''t count)
  - `error-600` (#DC2626) on white: **5.0:1** ✓
  - `success-600` (#16A34A) on white: **4.5:1** ✓ (borderline — use bold for small text)

- [ ] Large text (≥18px / ≥24px / bold ≥19px): contrast ratio ≥ **3:1**
  - All headings (22px+, bold): exceeds 3:1 with `neutral-900` on white ✓
  - White text on `primary-600` (#2563EB): **4.6:1** ✓
  - White text on `primary-700` (#1D4ED8) hover: **6.0:1** ✓
  - `primary-100` (#DBEAFE) badge text `primary-700` (#1D4ED8): **7.4:1** ✓

- [ ] Placeholder text: `neutral-400` (#A8A29E) on white — this is **2.8:1**
  - **Action:** Increase placeholder to `neutral-500` (#78716C) which gives **4.6:1**
  - Or use `neutral-400` only on large text (≥18px where 3:1 is acceptable)

- [ ] Status badges: verify each combination
  - Ready: `success-700` on `success-100` = **6.3:1** ✓
  - Coding: `primary-700` on `primary-100` = **7.4:1** ✓
  - Failed: `warning-700` on `warning-100` = **5.4:1** ✓

### Focus Indicators
- [ ] Every interactive element has `:focus-visible` outline: **3px solid #2563EB**
- [ ] Outline offset: **2px** (doesn''t clip against element edges)
- [ ] Focus order is logical (tab through the page in reading order)
- [ ] No `outline: none` without a replacement focus style
- [ ] Skip-link available (optional for SPA, but good practice)

### Form Labels
- [ ] All inputs have visible `<label>` elements — **never** placeholder-only
- [ ] Textarea has a visible label ("Describe your app")
- [ ] Labels are `text-body-lg` (20px, 600 weight), `neutral-900`
- [ ] Checkbox labels are `text-body` (18px), fully tappable (label wraps the checkbox or uses `htmlFor`)

### Motion
- [ ] `prefers-reduced-motion` respected: all transitions set to `0ms` when user prefers reduced motion
- [ ] Progress bar animation: use `@media (prefers-reduced-motion: reduce)` to show static fill percentage instead
- [ ] No auto-playing animations that last >5 seconds

### Screen Reader
- [ ] All icon buttons have `aria-label` (e.g., `aria-label="Delete app"`)
- [ ] Status badges have `role="status"` or descriptive text
- [ ] Progress bar has `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Phone frame has descriptive alt text or is marked `aria-hidden="true"` (decorative)
- [ ] Dynamic content updates use `aria-live` regions (status messages, compilation progress)
- [ ] App name heading is an `<h1>` (one per page)

### Plain Language
- [ ] No developer jargon: "build" not "compile", "app" not "PWA", "ready" not "deployed"
- [ ] Button text is imperative and clear: "Build My App", "Download App", "Try Again"
- [ ] Error messages explain what happened AND what to do next
- [ ] Status messages use complete sentences, not raw state names
- [ ] All text is at least 14px (captions), primary content is ≥18px

### Color Independence
- [ ] Status is never conveyed by color alone: badges include both color AND text/icon
- [ ] Links are underlined (not just colored) in body text
- [ ] Selected state includes border change AND background change (not just color)


---

## CSS Variables Quick Reference

For non-Tailwind styles, use these CSS custom properties (defined in `src/design-tokens.css`):

```css
/* Example component usage */
.my-card {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-family-sans);
  font-size: var(--font-size-body);
  color: var(--color-text-primary);
  transition: border-color var(--transition-base);
}

.my-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-md);
}

.my-card:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

---

## Tailwind Utility Quick Reference

| Need | Tailwind Class |
|------|---------------|
| Primary button bg | `bg-primary` |
| Blue 50 bg (selected) | `bg-primary-50` |
| Blue 700 bg (hover) | `hover:bg-primary-700` |
| Body text (18px) | `text-body` |
| Body large (20px) | `text-body-lg` |
| Heading 4 (22px) | `text-h4` |
| Touch target min | `min-h-touch min-w-touch` |
| Card shadow | `shadow-card` |
| Elevated shadow | `shadow-elevated` |
| Card border radius | `rounded-xl` |
| Button border radius | `rounded-md` |
| Focus ring | `focus-visible:outline-2 focus-visible:outline-primary` |
| Warm gray border | `border-neutral-200` |
| Surface card bg | `bg-surface-card` |
| Transition base | `transition-base` |
