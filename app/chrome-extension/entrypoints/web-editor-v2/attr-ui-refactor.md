# Property Panel UI Refactor Plan

## Background

The current property panel UI doesn't match the design in `attr-ui.html`. This document tracks the refactor to align visuals and interactions with the design spec.

### Reference Files

- **Design**: `/attr-ui.html`
- **Styles**: `ui/shadow-host.ts`
- **Panel**: `ui/property-panel/property-panel.ts`
- **Controls**: `ui/property-panel/controls/*.ts`

---

## Pre-work (Done)

### 0.1 Minimize Bug Fix (Done)

**Problem**: Toolbar and panel content remained visible when minimized — only the background disappeared.

**Root cause**: `display: flex/inline-flex` overrode `[hidden]`'s default `display: none`.

**Fix**: Added global `[hidden] { display: none !important; }` in `shadow-host.ts`.

### 0.2 Input Improvements (Done)

**Problems**: Inputs showed placeholders instead of real values. Number inputs didn't support arrow key stepping.

**Fixes**:

- Created `ui/property-panel/controls/number-stepping.ts` (ArrowUp/Down, Shift 10x, Alt 0.1x, CSS units)
- All controls now show real values (inline first, fallback to computed)
- Keyboard stepping added to: size, spacing, position, layout, typography, appearance controls

---

## Phase 1: Visual System Alignment (Done)

### 1.1 Color Scheme

| Property    | Old              | New                                   | Status |
| ----------- | ---------------- | ------------------------------------- | ------ |
| Panel bg    | `#f8f8f8`        | `#ffffff`                             | Done   |
| Input bg    | `#f0f0f0`        | `#f3f3f3`                             | Done   |
| Input hover | `#e8e8e8` bg     | `border #e0e0e0` inset                | Done   |
| Input focus | outer box-shadow | `inset 2px border #3b82f6` + white bg | Done   |
| Border      | `#e8e8e8`        | `#e5e5e5`                             | Done   |

### 1.2 Typography

| Property    | Old    | New                     | Status |
| ----------- | ------ | ----------------------- | ------ |
| Base font   | `13px` | `11px`                  | Done   |
| Labels      | `11px` | `10px`                  | Done   |
| Inputs      | `12px` | `11px`                  | Done   |
| Font family | system | Inter + system fallback | Done   |

### 1.3 Spacing

| Property       | Old         | New        | Status |
| -------------- | ----------- | ---------- | ------ |
| Panel width    | `320px`     | `280px`    | Done   |
| Header padding | `10px 14px` | `8px 12px` | Done   |
| Body gap       | `10px`      | `12px`     | Done   |

### 1.4 Corners & Shadows

| Property     | Old         | New                | Status |
| ------------ | ----------- | ------------------ | ------ |
| Panel shadow | `0 1px 2px` | Tailwind shadow-xl | Done   |
| Input radius | `6px`       | `4px`              | Done   |
| Tab shadow   | none        | shadow-sm          | Done   |

### 1.5 Group/Section Styles

| Property        | Old          | New         | Status |
| --------------- | ------------ | ----------- | ------ |
| Group border    | card border  | none        | Done   |
| Section divider | none         | top border  | Done   |
| Header style    | bold + large | 11px + #333 | Done   |

---

## Phase 2: Input Container Refactor (Done)

### 2.1 Input Container System (Done)

Introduced a container system supporting prefix (label/icon), suffix (unit/icon), and container-level hover/focus styles.

**Target structure**:

```html
<div class="we-field">
  <span class="we-field-label">Position</span>
  <div class="we-input-container">
    <span class="we-input-container__prefix">X</span>
    <input class="we-input-container__input" />
    <span class="we-input-container__suffix">px</span>
  </div>
</div>
```

### 2.2 Control Updates (Done)

- Size (W/H prefix + dynamic unit suffix)
- Spacing (2x2 grid + direction icons + dynamic units)
- Position (T/R/B/L prefix + dynamic units)
- Layout gap (icon prefix + dynamic units)
- Typography (dynamic units, smart line-height display)
- Shared `css-helpers.ts` module for all controls

---

## Phase 3: Section Restructure (Pending)

### 3.1 Tab Architecture

Current: 4 tabs (Design/CSS/Props/DOM). Design spec: 2 tabs (Design/CSS).

- [ ] Decide on tab count
- [ ] Implement chosen approach

---

## Phase 4: Feature Components

### 4.1 Flow Direction Icons (Done)

4 icon buttons for `flex-direction`: Row, Column, Row Reverse, Column Reverse.

### 4.2 Alignment Grid (Done)

3x3 grid controlling `justify-content` + `align-items`. Uses `beginMultiStyle` for atomic commits.

### 4.3 Color Picker Fix (Partial)

- Done: `showPicker()` error handling, `var()` value parsing
- Pending: alpha channel support, third-party picker integration

---

## Phase 5: New Modules

### 5.1 Shadow & Blur (Done)

`effects-control.ts` — handles `box-shadow`, `filter: blur()`, `backdrop-filter: blur()`.

### 5.2 Gradient Editor (Done)

`gradient-control.ts` — linear/radial gradients, 2 color stops, angle input. Pending: gradient preview slider, color stop drag.

### 5.3 Token/Variable Pill (Pending)

- [ ] Detect `var(--xxx)` values
- [ ] Render as clickable pill
- [ ] Open token picker on click

---

## Phase 6: Code Quality (Ongoing)

- [x] All colors use CSS variables
- [ ] Consistent size tokens
- [ ] Remove inline styles, consolidate in `shadow-host.ts`
- [ ] Extract shared components to `ui/property-panel/components/`
- [ ] Strict TypeScript types, remove `any` assertions

---

## Progress

| Phase   | Task                        | Status  | Notes                                 |
| ------- | --------------------------- | ------- | ------------------------------------- |
| 0.1     | Minimize bug                | Done    | Global `[hidden]` rule                |
| 0.2     | Input improvements          | Done    | number-stepping + real values         |
| 1.1-1.5 | Visual alignment            | Done    | White bg, Inter font, tighter spacing |
| 2.1-2.2 | Input containers            | Done    | Shared css-helpers.ts                 |
| 3.1     | Tab architecture            | Pending |                                       |
| 4.1-4.2 | Flow icons + alignment grid | Done    |                                       |
| 4.3     | Color picker                | Partial | showPicker + var() done               |
| 5.1-5.2 | Effects + gradients         | Done    |                                       |
| 5.3     | Token pill                  | Pending |                                       |

---

## Notes

1. **Incremental delivery**: Each phase should be independently testable
2. **Backward compatible**: Don't break existing features during refactor
3. **Record decisions**: Document when design spec conflicts with actual needs
4. **Performance**: Avoid unnecessary DOM operations in new components
