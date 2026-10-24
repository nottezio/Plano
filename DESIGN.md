---
name: Plano
description: Offline-first clinical rounds notes; a compact, layered, slate-and-white working surface with pastel status cards.
colors:
  canvas: "#f3f5f8"
  canvas-subtle: "#eceff4"
  surface: "#ffffff"
  border: "#e1e6ed"
  border-strong: "#c6cfdb"
  ink: "#0f1a2a"
  ink-muted: "#4f5d70"
  ink-faint: "#8590a0"
  accent: "#1559c7"
  on-accent: "#ffffff"
  danger: "#dc2626"
  warn: "#d97706"
  canvas-dark: "#0a0f15"
  surface-dark: "#131a24"
  ink-dark: "#e8eef5"
  accent-dark: "#6aa3ff"
  card-ink: "#0b0f14"
  card-red: "#fee2e2"
  card-orange: "#ffedd5"
  card-yellow: "#fef9c3"
  card-lime: "#ecfccb"
  card-teal: "#ccfbf1"
  card-blue: "#dbeafe"
  card-violet: "#ede9fe"
  card-pink: "#fce7f3"
  card-sky: "#e0f2fe"
  card-slate: "#e2e8f0"
  card-rose: "#ffe4e6"
  card-green: "#d1fae5"
  card-done: "#dcfce7"
typography:
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.375
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  tap: "44px"
  card-padding: "10px"
  card-padding-dense: "8px"
  sheet-padding: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    height: "44px"
  card-patient:
    backgroundColor: "{colors.card-blue}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.sheet-padding}"
  chip-count:
    backgroundColor: "{colors.border}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
---

# Design System: Plano

## Overview

**Creative North Star: "The Ward Clipboard"**

Plano looks like a clipboard you glance at while standing: a cool slate canvas, white layers on top of it, and a board of small pastel cards where colour carries status. The note body is the product, so chrome stays quiet and compact. Twelve patient cards share one screen, so every pixel of padding is paid twelve times; density is a deliberate, confirmed choice, not a default.

Depth is layered and tonal. The canvas is slate (`#f3f5f8`), surfaces are white, and a hairline border plus a soft shadow separates a card, a popover and a sheet. Ink is a blue-black, never pure black. The control language is compact and confident: tight padding, 44px tap targets, rounded-xl cards, one clear blue accent. Dark mode is first-class (night shifts), with an optional true-black "pekat" background for OLED, and a warm-paper "hangat" background for light mode.

**Key Characteristics:**
- Slate canvas under white surfaces; layers, not lines on one white sheet.
- Pastel checklist-status cards with near-black text, designed for glanceability.
- One accent per palette (default blue); six alternates the user can switch to.
- Compact density; 44px minimum tap target on every control.
- System fonts only; no webfont download, since the app is offline-first.
- Light and dark are equal citizens; contrast is machine-checked.

## Colors

A cool slate neutral base, one saturated blue accent, and a 12-step pastel set that exists to encode checklist progress.

### Primary
- **Clinical Blue** (`#1559c7` light, `#6aa3ff` dark): selection, links, the active tab, primary buttons, focus rings. Text on it is white in light mode and near-black (`#0b0f14`) in dark mode, because white on the bright dark accent fails contrast. Other palettes (toska, ungu, hijau, oranye, rose, grafit) replace only the accent family.

### Secondary
- **Watch Amber** (`#d97706` light, `#fbbf24` dark): cautions and standing warnings, and the H-1 discharge stage (`#f59e0b`). Not used for Pemantauan: amber was dropped there because it collided with the H-1 strip.
- **Pemantauan Red** (`#dc2626` light with white text, `#f87171` dark with near-black text): the strip and ring on a patient under closer watch. The only red on a board card, so it means one thing.

### Neutral
- **Slate Canvas** (`#f3f5f8`; subtle `#eceff4`): page background and recessed wells.
- **Paper White** (`#ffffff`): cards, sheets, header, tab bar.
- **Hairline** (`#e1e6ed`; strong `#c6cfdb`): borders and dividers.
- **Blue-Black Ink** (`#0f1a2a`), **Muted** (`#4f5d70`), **Faint** (`#8590a0`): primary, secondary and placeholder text.
- **Danger Red** (`#dc2626`, dark `#f87171`): irreversible actions and errors only.
- **Dark theme:** canvas `#0a0f15`, surface `#131a24`, ink `#e8eef5`. "Pekat" lowers canvas to `#000000`; "hangat" warms the light canvas to `#fbf7f0`.

### Checklist Status Cards
Twelve pastel steps (red, orange, yellow, lime, teal, blue, violet, pink, sky, slate, rose, green) plus Done green and Neutral. Item N maps to step `((N-1) % 12) + 1`, so any checklist length works. Cards stay selected by a `data-color-token` attribute, never by a hex stored in data. Text on every card is `#0b0f14` in light and `#f2f6fa` in dark, checked at 4.5:1 or better.

### Named Rules
**The Colour-Is-Data Rule.** A card colour is a token key stored with the checklist item, never a raw hex, so reordering or recolouring needs no migration and dark mode needs no second palette.

**The Accent-Means-Selected Rule.** Blue means selected or active. Amber means caution or discharge-soon. Red means irreversible actions, errors, and a patient under Pemantauan. Do not borrow one for another job.

**The Contrast Gate Rule.** Any new foreground/background pair must pass `npm run check:contrast` (4.5:1) in both themes.

## Typography

**Display Font:** none; the system UI stack (system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans).
**Body Font:** same stack.
**Label/Mono Font:** ui-monospace stack, used for version strings and technical values.

**Character:** Native and unadorned. System fonts keep text instantly legible, load nothing offline, and make the app feel like part of the phone.

### Hierarchy
- **Title** (600, 17px, 1.25, -0.01em): sheet and page titles, truncated on one line.
- **Body** (400-600, 14px, 1.375): card titles (600), list rows, form text.
- **Label** (400, 12px, 1.33): the workhorse, used for most secondary text and metadata, often at 70% opacity on cards.
- **Caption** (600, 11px, +0.05em, uppercase when a group heading): tab labels on tablet, section group headings, small pills.
- **Note editor:** h1 1.5rem/700, h2 1.25rem/600, h3 1.075rem/600; body inherits 14px-16px.

### Named Rules
**The Twelve-Cards Rule.** Default text on the board is 12-14px; size is bought back with weight and opacity, not extra space.

## Layout

A compact, touch-first shell. On phones: a top bar, scrolling content, and a bottom tab bar with a "Lainnya" overflow. On tablet: a narrow left rail with icon and label. On desktop: an expanded sidebar with labelled rows and an active-row bar. Content respects `env(safe-area-inset-*)`.

The board is a masonry grid of patient cards with a denah (floor-plan) alternate view. Card padding is 10px (8px dense). Sheets are bottom sheets capped at 90dvh on phones and centred panels (max 94vw, 88dvh) from the `sm` breakpoint. The shell does not scroll; the board does. Every interactive control has a 44px minimum hit area (`min-h-tap`, `min-w-tap`), enforced even when the visible glyph is smaller.

## Elevation & Depth

Layered and tonal. Structure comes first from the canvas/surface step, then from hairline borders, then from shadows that respond to state or overlay.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(15 26 42 / 6%), 0 1px 1px rgb(15 26 42 / 3%)`): resting patient and list cards.
- **Pop** (`0 8px 24px -6px rgb(15 26 42 / 14%), 0 2px 6px -2px rgb(15 26 42 / 8%)`): popovers, menus, card hover.
- **Sheet** (`0 28px 64px -16px rgb(15 26 42 / 30%), 0 4px 12px -4px rgb(15 26 42 / 10%)`): bottom sheets and dialogs, over a 42% ink overlay (62% black in dark).
- In dark mode shadows deepen and gain a 4-5% white hairline ring so edges stay visible.

### Named Rules
**The Layer-Ladder Rule.** Canvas, then surface, then raised, then overlay. A new component picks the lowest rung that separates it; it does not invent a new shadow.

## Shapes

Softly rounded. Cards `12px` (rounded-xl), controls `8px` (rounded-lg), sheets `16px` (rounded-2xl), pills and avatars fully round. `rounded-lg` is the most common radius by far. When a note is attached to a card, the card's bottom edge squares off so card and note read as one shape with a seam. Borders are 1px hairlines; the checklist box in the editor is a drawn 2px-bordered rounded square, not a native input.

## Components

### Buttons
- **Shape:** rounded-lg (8px), at least 44px tall on touch.
- **Primary:** Clinical Blue fill, `on-accent` text; hover raises brightness (`brightness-110`) rather than swapping colour.
- **Secondary / Toggle:** surface fill with a hairline border and ink text; selected state flips to the accent fill and a matching border.
- **Icon button:** 44x44 hit area, fully round, muted ink, `bg-subtle` on hover.
- **Focus:** a 2px outline in the palette's focus-ring colour, 2px offset, on every focusable element.

### Chips
- **Style:** fully round, 11px semibold. Counts and tags sit on a tinted fill; the "Chief" pill inverts to token-fg on token-bg.
- **State:** selected chips use the accent fill. Count badges are small, `bg-black/10` on light cards and `white/15` on dark.

### Cards / Containers
- **Corner Style:** rounded-xl (12px).
- **Background:** the resolved checklist token colour on the board; white surface elsewhere.
- **Shadow Strategy:** Card at rest, Pop on hover (`transition-shadow`).
- **Border:** 1px `black/5` (light) or `white/10` (dark) on pastel cards; hairline token elsewhere.
- **Internal Padding:** 10px, 8px when dense.

### Inputs / Fields
- **Style:** transparent or surface fill, 1px hairline border, rounded-lg, flush in their container. Selects use the surface colour for their option list so Windows Chrome does not paint white-on-white.
- **Focus:** the 2px accent outline.
- **Dates:** always tgl/bln/tahun through `DateField`.

### Navigation
- **Style:** bottom tab bar on phones (icon in a 28x48 pill that fills with `accent-soft` when active), left rail on tablet, labelled sidebar on desktop with a 3px active bar.
- **Typography:** 12px (11px on tablet), medium weight when active.
- **Badges:** a red dot on tabs that need attention; a "WIP" tag in danger-soft on unfinished sections.

### Patient Card (signature)
Pastel token background, near-black text. Three tiers: (1) always visible, the Pemantauan and Pulang strips, the identity band (name, bed, DPJP pill, RM) and the status rail; (2) one flag row capped at three chips plus "+n" (reminders and KJS · Kardio never collapse); (3) a muted 11px meta line for the pin and "Chief: …". Diagnosis changes are one truncated line in words. Add a new mark by demoting another, not by adding a fourth tier. It is the unit of the whole app; every other surface is built to frame it.

### Catatan Editor (signature)
TipTap content with drawn checkbox lists (a ticked row strikes through and fades to faint ink), toggle blocks with a rotating chevron, translucent highlighter colours (yellow, green, blue, pink) that work on light and dark, and a placeholder drawn but never stored.

## Do's and Don'ts

### Do:
- **Do** read colours from the CSS variables in `src/styles/tokens.css` through the Tailwind aliases (`bg-surface`, `text-fg-muted`, `border-border`); a dark theme must be a class flip, never a second palette.
- **Do** keep a 44px hit area on every touch control, even when the glyph is small.
- **Do** use `accent-soft`, `danger-soft` and `color-mix` for tints. Tailwind's `bg-accent/15` emits nothing for a CSS-variable colour.
- **Do** use the existing sheet, `DateField`, `ConfirmDialog` and tab patterns before building new ones.
- **Do** honour `prefers-reduced-motion` and keep transitions to about 120ms colour or shadow changes.
- **Do** write the UI in Bahasa Indonesia and keep established English terms (Preview, Pin, Undo, Synced, offline, checklist, template, sync, backup, export).

### Don't:
- **Don't** hardcode a hex in a component, or store a raw hex as a checklist colour.
- **Don't** use pure black or pure white for text; ink is blue-black (`#0f1a2a`).
- **Don't** use the accent for anything but selection or action, amber for anything but watch status, or red for anything but destructive and error states.
- **Don't** add decorative motion, gradients, or webfonts; the app is offline-first, glanceable and one-handed.
- **Don't** use the native date display or the word "Alat" in the UI.
- **Don't** put hospital system names (such as SIMGOS) in calculator UI.
