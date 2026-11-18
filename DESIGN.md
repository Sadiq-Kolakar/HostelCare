---
version: alpha
name: Hostel Care
description: A trusted hostel service desk with a calm navy glass interface for reporting and resolving maintenance issues.
colors:
  canvas: "#101D35"
  surface: "rgba(255, 255, 255, 0.12)"
  surface-subtle: "rgba(255, 255, 255, 0.08)"
  text: "#F4F7FD"
  text-muted: "#C2CEE0"
  border: "rgba(255, 255, 255, 0.18)"
  glass-highlight: "rgba(255, 255, 255, 0.22)"
  glass-field: "rgba(7, 18, 36, 0.38)"
  primary: "#2563EB"
  primary-strong: "#1D4ED8"
  primary-soft: "rgba(96, 165, 250, 0.17)"
  accent: "#60A5FA"
  teal: "#0D9488"
  indigo: "#6366F1"
  success: "#22C55E"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
  sans:
    fontFamily: "DM Sans, system-ui, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  control: "0.625rem"
  card: "1rem"
  sheet: "1.25rem"
spacing:
  content-max: "73rem"
  page-inset: "clamp(1rem, 4vw, 3rem)"
components:
  button:
    backgroundColor: "#2563EB"
    textColor: "#FFFFFF"
    rounded: "0.625rem"
  card:
    backgroundColor: "#2D384D"
    rounded: "1rem"
  field:
    backgroundColor: "rgba(7, 18, 36, 0.38)"
    textColor: "#F4F7FD"
    rounded: "0.625rem"
---

# Hostel Care Design System

## Overview

### Creative North Star

Hostel Care should read like a dependable campus operations desk at dusk: a deep navy work surface, clear blue routing cues, and quiet teal light around shared hostel services. The signature is the layered glass shell over a navy-to-blue atmosphere; operational content stays crisp and high contrast inside it.

### Product context and register

- **Audience and primary job:** Hostel students report issues; wardens triage and assign them; maintenance staff record progress and resolution.
- **Locale and language:** English UI; dates use the browser locale (`en-IN` where explicitly formatted).
- **Usage scene:** Students use mobile for short reports and updates; wardens and staff use desktop for triage and work tracking.
- **Register:** Product UI across authentication, dashboards, complaint lists, forms, details, notifications, and staff management.
- **Restraint:** Glass is a surface treatment, not a substitute for hierarchy. Use the navy gradient as atmosphere, blue for primary actions, teal as a restrained secondary accent, and semantic colors for status and priority.
- **Anti-references:** Neon gaming dashboards, muddy overlays, low-contrast glass, dense ticket grids, and decoration that competes with complaint status or the next action.
- **Token ownership/runtime mapping:** Runtime CSS variables in `client/src/glass-theme.css` are canonical for the approved theme. Glass overlays composite over the navy canvas; the component card swatch records the approximate combined color for contrast checks. `client/src/styles.css` and `client/src/design-polish.css` provide the existing component layout; `client/src/glass-theme.css` maps semantic tokens across those shared classes. This file mirrors the accepted values.

## Colors

The canvas is deep navy (`canvas`) with soft royal-blue and teal light pools. Frosted white overlays create the primary and secondary glass surfaces. Text uses near-white ink and a light blue-gray secondary tone. Royal blue marks primary actions; teal supports assigned work; indigo distinguishes review; green, amber, and red retain their familiar semantic meanings. Status labels remain visible alongside color.

## Typography

Manrope carries page titles and short section headings. DM Sans carries body copy and controls. Numeric references use a system monospace face. Keep body copy and controls at 12px or larger where space allows, with supporting metadata at least 10px. On phones, allow metadata to wrap rather than shrinking it. Do not reduce type to make glass cards fit.

## Layout

Preserve the established 16rem navigation rail and centered content column. On narrow screens, the navigation becomes the existing off-canvas drawer and the authentication panel becomes single-column. The visual theme changes surface, color, and depth without moving product sections or changing workflows.

## Elevation and Depth

Use 16px backdrop blur for glass surfaces, with 12px to 20px reserved for the app chrome and floating sheets. Borders use a subtle white tint and shadows stay soft and broad. Prefer readable opaque fallbacks when reduced transparency is requested.

## Shapes

Controls use a 10px radius, cards use 16px, and detail sheets use 20px. Preserve established geometry where responsive styles already define it.

## Components

- **Buttons:** Royal blue for primary actions; translucent outlined surfaces for secondary actions; restrained red for errors and destructive states.
- **Fields:** Dark translucent input surfaces with readable placeholders, bright focus borders, and visible labels.
- **Lists and cards:** Frosted navy surfaces with quiet separators; preserve complaint title, category, status, reference, and date hierarchy.
- **Status:** Submitted blue, under review indigo, assigned teal, in progress amber, resolved green, closed neutral. Always retain the text label.
- **Priority:** High red, medium amber, low blue/teal; priority remains independent of community popularity.
- **Iconography and motion:** Existing Lucide outline icons remain. Use brief hover transitions and honor reduced-motion preferences.
- **Runtime mapping:** DESIGN.md semantic tokens → `client/src/glass-theme.css` custom properties → shared selectors in `styles.css` and `design-polish.css`. Avoid parallel component-level palettes.

## Do's and Don'ts

- **Do:** Keep text, fields, and status labels readable against every frosted surface.
- **Do:** Preserve keyboard focus and offer opaque fallback surfaces for reduced transparency.
- **Don't:** Apply blur or transparency to every nested element; separate content using hierarchy and spacing.
- **Don't:** change existing routes, content, data, or workflow as part of a visual theme update.
