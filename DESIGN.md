# DESIGN.md - MedClock Design System
<!-- Specification Standard: Google Stitch DESIGN.md + UI/UX Pro Max Medication & Pill Reminder Palette -->
<!-- Version: 2.0.0 -->

## 1. Design Philosophy & Vibe
**MedClock** uses a **Calm Clinical Sky & Health Emerald** palette paired with **Bedside Night Mode**—designed specifically for effortless readability when groggy in the morning or checking night doses in a dim room.

### Core Principles
1. **Semantic Color Coding:** Clinical Blue (`#0369A1`) for medications, Health Emerald (`#047857`) for taken/completed doses, Warm Indigo (`#4F46E5`) for general alarms, and Alert Red (`#DC2626`) for active ringing & low-stock refills.
2. **Daylight & Bedside Night Modes:** Light mode (`#F0F9FF` soft sky canvas) for daytime clarity; Dark mode (`#0B1120` deep night canvas) for zero-glare bedside use.
3. **Accessibility First:** WCAG 2.2 AA/AAA contrast (`>= 4.5:1`), minimum `44×44px` touch targets, `prefers-reduced-motion` support, `tabular-nums` clocks, and native `<dialog>` modals.

---

## 2. Design Tokens
```css
:root {
  --color-brand-primary: #0369A1;      /* Clinical Sky Blue */
  --color-brand-primary-hover: #075985;
  --color-brand-accent: #0891B2;       /* Calm Cyan */
  --color-brand-secondary: #047857;    /* Health Emerald */
  --color-alarm-indigo: #4F46E5;       /* General Alarm Accent */

  --color-canvas-base: #F0F9FF;        /* Soothing Sky Canvas */
  --color-surface-card: #FFFFFF;       /* Crisp Pure White */
  --color-surface-elevated: #E0F2FE;   /* Soft Ice Blue */
  --color-border-subtle: #BAE6FD;      /* Crisp Sky Divider */
  --color-border-focus: #0284C7;

  --color-text-primary: #0F172A;       /* Deep Slate */
  --color-text-secondary: #334155;     /* Slate 700 */
  --color-text-muted: #475569;         /* Slate 600 */
  --color-text-inverse: #FFFFFF;

  --color-feedback-success: #047857;
  --color-feedback-warning: #B45309;
  --color-feedback-error: #DC2626;
}
```
