# DESIGN.md - MedClock Design System
<!-- Specification Standard: Google Stitch DESIGN.md + UI/UX Pro Max Medication & Pill Reminder Palette -->
<!-- Version: 2.1.0 -->

## 1. Design Philosophy & Vibe
**MedClock** uses a **Calm Clinical Sky & Health Emerald** palette paired with **Bedside Night Mode**—designed specifically for effortless readability when groggy in the morning or checking night doses in a dim room.

### Core Principles
1. **Semantic Color Coding:** Clinical Blue (`#0369A1`) for primary medication actions, Health Emerald (`#047857`) for taken/completed doses, Alert Red (`#DC2626`) for overdue/refill/expiry alerts, plus 5 per-medicine color tags (`sky`, `emerald`, `amber`, `rose`, `indigo`).
2. **Daylight & Bedside Night Modes:** Light mode (`#F0F9FF` soft sky canvas) for daytime clarity; Dark mode (`#0B1120` deep night canvas) for zero-glare bedside use.
3. **Accessibility First:** WCAG 2.2 AA/AAA contrast (`>= 4.5:1`), minimum `44×44px` touch targets, `prefers-reduced-motion` support, `tabular-nums` clocks, and native `<dialog>` modals with scroll containment.

---

## 2. Design Tokens
```css
:root {
  --color-brand-primary: #0369A1;      /* Clinical Sky Blue */
  --color-brand-primary-hover: #075985;
  --color-brand-accent: #0891B2;       /* Calm Cyan */
  --color-brand-secondary: #047857;    /* Health Emerald */

  --color-canvas-base: #F0F9FF;        /* Soothing Sky Canvas */
  --color-surface-card: #FFFFFF;       /* Crisp Pure White */
  --color-surface-elevated: #E0F2FE;   /* Soft Ice Blue */
  --color-border-subtle: #CBD5E1;      /* Crisp Slate Divider */
  --color-border-focus: #0284C7;

  --color-text-primary: #0F172A;       /* Deep Slate */
  --color-text-secondary: #334155;     /* Slate 700 */
  --color-text-muted: #475569;         /* Slate 600 */
  --color-text-inverse: #FFFFFF;

  --color-feedback-success: #047857;
  --color-feedback-warning: #B45309;
  --color-feedback-error: #DC2626;
}

[data-theme="dark"] {
  --color-brand-primary: #0284C7;
  --color-brand-primary-hover: #0369A1;
  --color-brand-accent: #38BDF8;
  --color-brand-secondary: #059669;

  --color-canvas-base: #0B1120;
  --color-surface-card: #131C31;
  --color-surface-elevated: #1E293B;
  --color-border-subtle: #334155;
  --color-border-focus: #38BDF8;

  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-muted: #94A3B8;
  --color-text-inverse: #FFFFFF;
}
```

## 3. Medicine Color Tags
- **Sky Blue (`sky`):** `#0284C7`
- **Emerald Green (`emerald`):** `#059669`
- **Amber Gold (`amber`):** `#D97706`
- **Rose Pink (`rose`):** `#E11D48`
- **Indigo (`indigo`):** `#4F46E5`
