# DESIGN.md - Kuberan MedClock & Alarm PWA Design System
<!-- Specification Standard: Google Stitch DESIGN.md -->
<!-- Version: 1.0.0 -->

## 1. Design Philosophy & Vibe
**MedClock** combines the warmth and clarity of Kuberan's heritage aesthetic with clinical-grade legibility for daily medication adherence and reliable alarm management. Every screen prioritizes instant time recognition, zero-ambiguity dosage instructions, and large, calming, tactile controls.

### Core Principles
1. **Calm Authority:** Warm Pearl Ivory canvas (`#FAFAF7`) paired with Imperial Kumkum Maroon (`#6B1D2F`) primary actions and Antique Temple Gold (`#C5A059`) accents—never harsh clinical neon or generic dark-navy AI gradients.
2. **Unmistakable Readability:** `tabular-nums` for all clocks, countdowns, and dosage quantities so digits never jitter.
3. **Accessibility First:** WCAG 2.2 AA/AAA contrast ratios, minimum `44×44px` touch targets on all interactive controls, native `<dialog>` top-layer modals with scroll containment, and `:user-invalid` deferred form validation.

---

## 2. Design Tokens
```css
:root {
  /* Brand Identity Tokens */
  --color-brand-primary:      #6B1D2F; /* Imperial Kumkum Maroon */
  --color-brand-primary-hover:#541524;
  --color-brand-accent:       #C5A059; /* Antique Temple Gold */
  --color-brand-secondary:    #1B4D3E; /* Auspicious Temple Green */

  /* Canvas & Surface Tokens */
  --color-canvas-base:        #FAFAF7; /* Warm Pearl Ivory */
  --color-surface-card:       #FFFFFF; /* Pure White */
  --color-surface-elevated:   #F3EFEA; /* Soft Sandstone */
  --color-border-subtle:      #EAE5DC; /* Crisp 1px tactile divider */
  --color-border-focus:       #C5A059; /* Zari Gold Focus Ring */

  /* Text & Readability Tokens */
  --color-text-primary:       #1C1917; /* Charcoal Slate */
  --color-text-secondary:     #4B5563; /* Warm Neutral */
  --color-text-muted:         #6B7280; /* Subtle Gray */
  --color-text-inverse:       #FFFFFF; /* Pure White */

  /* Semantic Feedback Tokens */
  --color-feedback-success:   #15803D;
  --color-feedback-warning:   #B45309;
  --color-feedback-error:     #B91C1C;
}
```

---

## 3. Typography & Spatial Scale
- **Display / Editorial:** `"Cormorant Garamond", Georgia, serif`
- **UI & Body:** `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif`
- **Clocks / Timers / Dosages:** `"JetBrains Mono", Consolas, monospace` with `font-variant-numeric: tabular-nums`
- **Radii:** `6px` cards, `8px` modals/dialogs, `4px` badges/chips, `9999px` pill switches.
- **Motion:** Composite-only (`transform`, `opacity`), `cubic-bezier(0.23, 1, 0.32, 1)` (`180ms–260ms`), tactile `:active { transform: scale(0.97); }`.
