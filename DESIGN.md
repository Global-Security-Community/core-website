---
name: Global Security Community
description: Connecting cybersecurity professionals worldwide through local chapters and events
colors:
  primary-teal: "#0e8c84"
  primary-navy: "#001f3f"
  primary-navy-deep: "#06172c"
  primary-navy-soft: "#1a3a5c"
  accent-orange: "#c47600"
  success: "#27ae60"
  danger: "#dc3545"
  warning: "#ffc107"
  surface: "#ffffff"
  surface-muted: "#f5f5f5"
  surface-soft: "#f8f9fa"
  surface-tint: "#f0faf9"
  text: "#333333"
  text-muted: "#666666"
  text-subtle: "#767676"
  text-inverse: "#ffffff"
  border: "#dddddd"
  border-subtle: "#eeeeee"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.12
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
  3xl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary-teal}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-navy}"
    textColor: "{colors.text-inverse}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.primary-teal}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "2rem"
---

# Design System: Global Security Community

## 1. Overview

**Creative North Star: "The Secure Commons"**

An open, trusted, community-owned space. The design communicates professional credibility without gatekeeping — a town square for cybersecurity defenders, not a locked vault. The visual language is clean, confident, and grounded: navy anchors authority, teal signals openness and action, and generous white space gives content room to breathe.

The system uses the native system font stack throughout, prioritising speed and familiarity over typographic flair. Surfaces are predominantly white with subtle teal tints as brand warmth. The hero and footer use deep navy as contrast anchors, creating a "commons bounded by authority" rhythm.

This explicitly rejects: hacker/offensive-sec aesthetics (dark terminals, green-on-black), anything resembling an official Microsoft portal, gamified startup energy, and generic SaaS templates with hero metrics.

**Key Characteristics:**
- Clean white surfaces with restrained teal accent (≤15% of surface area)
- Deep navy as the authority/heading color
- System font stack for instant loading and platform familiarity
- Responsive card grids for events and chapters
- Subtle hover lifts and shadow transitions for interactivity
- Professional without being corporate

## 2. Colors

A restrained palette: tinted neutrals with two primary colours carrying the brand identity — navy for authority and headings, teal for action and interactivity.

### Primary
- **Commons Teal** (#0e8c84): The action colour. Used for links, buttons, active states, CTAs, and h3 headings. Represents openness and invitation.
- **Authority Navy** (#001f3f): The grounding colour. Used for h1/h2 headings, hero backgrounds, footer, and brand text. Represents trust and expertise.
- **Deep Navy** (#06172c): Hero gradient anchor. The darkest surface in the system.
- **Soft Navy** (#1a3a5c): Hero gradient terminus and secondary heading contexts.

### Secondary
- **Alert Orange** (#c47600): Used sparingly for accent/warning states and role badges (sponsor). Never decorative.
- **Discord Indigo** (#5865f2): Community channel CTA. Brand-locked to Discord integration only.

### Neutral
- **Ink** (#333): Primary body text.
- **Muted** (#666): Secondary text, section intros, meta information.
- **Subtle** (#767676): Tertiary text, labels. Meets AA contrast on white.
- **Surface** (#fff): Primary background.
- **Surface Muted** (#f5f5f5): Alternate background, section distinction.
- **Surface Tint** (#f0faf9): Brand-tinted background for highlighted areas.
- **Border** (#ddd): Card and section dividers.
- **Border Subtle** (#eee): Lighter dividers, card borders at rest.

### Named Rules
**The Teal Restraint Rule.** Teal appears as interactive elements (links, buttons, active borders) and h3 headings only. It never fills large surfaces or backgrounds. Its power comes from restraint; more than 15% saturation dilutes the signal.

## 3. Typography

**Body/Display Font:** System stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)

**Character:** A single system font stack used throughout at varying weights and sizes. The choice is deliberate: zero render-blocking requests, platform-native feel, and the typography steps aside so the content (events, chapters, people) stays the focus. Weight and scale do the hierarchy work.

### Hierarchy
- **Display** (700, 3rem/48px, line-height 1.12): Hero headlines only. White on navy.
- **Headline** (700, 2.5rem/40px, line-height 1.15): Page h1 headings. Navy.
- **Title** (700, 1.75rem/28px, line-height 1.2): Section h2 headings. Navy.
- **Subhead** (600, 1.25rem/20px, line-height 1.3): h3 headings. Teal.
- **Body** (400, 1rem/16px, line-height 1.7): Prose and descriptions. Ink on white.
- **Label** (700, 0.75rem/12px, tracking 0.08em, uppercase): Metadata, kickers, categories. Teal or muted.

### Named Rules
**The Weight-Over-Style Rule.** Hierarchy is achieved through weight (400→600→700) and scale, never through font-family changes. One family, one voice.

## 4. Elevation

The system uses subtle box-shadows for depth, applied as hover/focus responses. Surfaces are flat at rest; shadows appear to indicate interactivity and state change.

### Shadow Vocabulary
- **sm** (`0 2px 8px rgba(0,0,0,0.08)`): Cards and containers at rest. Barely visible; signals "this is a surface."
- **md** (`0 4px 12px rgba(0,0,0,0.1)`): Hover state for buttons and interactive cards. The primary feedback shadow.
- **lg** (`0 8px 24px rgba(0,0,0,0.15)`): Hover state for chapter cards and elevated modals. Reserved for prominent interactive surfaces.
- **card-hover** (`0 6px 16px rgba(0,0,0,0.12)`): Specifically for linked card hover. Paired with translateY(-3px) lift.

### Named Rules
**The Lift-On-Intent Rule.** Shadows only appear as a response to user intent (hover, focus). No static elevated surfaces — everything starts flat and rises when reached for. The lift is always paired with a subtle translateY(-2px to -4px) transform for physicality.

## 5. Components

### Buttons
- **Shape:** 8px radius (md), solid 1px border.
- **Primary:** Teal bg, white text, teal border. On hover: navy bg, translateY(-2px), shadow-md.
- **Secondary:** Transparent bg, teal text, teal border. On hover: same lift.
- **Ghost:** Transparent bg, teal text, no border. Minimal ink.
- **CTA:** Same as Primary but semantically reserved for the single most important action on a page.
- **Hero variants:** Primary button gets deeper shadow (10px 28px); secondary uses inverse colors (white text, translucent border) for dark-on-navy hero context.

### Cards
- **Corner Style:** 8px radius (md) for standard cards, 12px (lg) for chapter cards.
- **Background:** White (#fff) surface.
- **Shadow Strategy:** sm at rest, md/lg on hover with translateY lift.
- **Border:** 1px solid border (#ddd) or border-subtle (#eee).
- **Internal Padding:** 2rem (space-2xl).
- **Grid:** `repeat(auto-fit, minmax(300px, 1fr))` with 2rem gap.

### Navigation
- **Style:** Sticky top, white background, shadow-sm.
- **Typography:** 500 weight, base size, ink colour.
- **Active state:** Teal text with 2px bottom border.
- **Hover:** Teal text transition.
- **Mobile:** Hamburger toggle (not yet described in detail in CSS).

### Inputs / Fields
- **Style:** 1px border (#ddd), 8px radius, white background.
- **Focus:** Teal border, focus ring (rgba teal at 0.18 opacity).
- **Error:** Danger border with danger-subtle background.

### Hero Section
The signature component. Two-column grid on desktop (content left, visual panel right) with deep navy gradient background, radial teal glow at top-right, and backdrop-blur glass panel for the visual side. Establishes authority while the teal glow signals community warmth.

## 6. Do's and Don'ts

### Do:
- **Do** use teal exclusively for interactive elements and h3 headings — its power is in restraint.
- **Do** pair shadow lifts with translateY transforms for tactile hover feedback.
- **Do** use the navy→deep navy gradient for hero and footer surfaces only.
- **Do** maintain ≥4.5:1 contrast ratio for all body text (current #333 on #fff = 12.6:1).
- **Do** use `repeat(auto-fit, minmax(300px, 1fr))` for responsive grids.
- **Do** use the label pattern (uppercase, tracked, 700 weight, xs size) sparingly for metadata.

### Don't:
- **Don't** use dark mode with terminal aesthetics, green-on-black, or hacker iconography.
- **Don't** mimic Microsoft's Fluent design language or Azure portal patterns — this is an independent community.
- **Don't** use gradient text or background-clip effects.
- **Don't** add side-stripe borders (border-left > 1px as accent). The `.home-feature-item` pattern is a legacy exception; don't extend it.
- **Don't** use teal as a large surface fill — it loses its action-signalling power.
- **Don't** introduce a second typeface. The system font stack is the only family.
- **Don't** use arbitrary z-index values. The current `z-index: 100` on navbar is the ceiling for layout; modals and overlays should scale from there.
