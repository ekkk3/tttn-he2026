# Design System Document

## 1. Overview & Creative North Star: "The Modern Agrarian"
This design system moves away from the "standard e-commerce template" to embrace a **Modern Agrarian** aesthetic. We are not building a generic storefront; we are creating a digital curatorial space for Vietnamese heritage. 

The Creative North Star is defined by **Organic Precision**. We achieve this by balancing the "Natural/Fresh" green and "Earthy" tones with a high-end, editorial layout. Instead of rigid boxes and heavy borders, the interface uses breathing room, asymmetric whitespace, and tonal layering to guide the user’s eye. It should feel like flipping through a premium coffee-table book on Vietnamese craftsmanship.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in nature but executed with digital sophistication. We avoid the "flat" look by utilizing the full depth of the surface-container tokens.

### Color Strategy
- **Primary (`#0d631b`)**: Used for the most critical actions and brand moments.
- **Secondary & Tertiary (`#75584d` / `#8e3d00`)**: These represent the earth and sun-dried specialties. Use these for supporting accents and "warm" brand touches.
- **Surface & Background (`#f9f9f9`)**: The canvas.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts.
- To separate a hero section from a product grid, transition from `surface` to `surface_container_low`.
- For sidebars or nested content, use `surface_container`.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine rice paper.
- **Level 0 (Base):** `surface` (`#f9f9f9`)
- **Level 1 (Sectioning):** `surface_container_low` (`#f3f3f3`)
- **Level 2 (Interaction Cards):** `surface_container_lowest` (`#ffffff`) placed on top of Level 1 to create a "soft lift."

### Signature Textures & Glassmorphism
- **Glassmorphism:** For floating navigation or product quick-views, use `surface` at 80% opacity with a `24px` backdrop-blur. This keeps the experience feeling "light" and airy.
- **CTA Soul:** Apply a subtle linear gradient to primary buttons: `primary` (`#0d631b`) to `primary_container` (`#2e7d32`) at a 135-degree angle.

---

## 3. Typography: Editorial Authority
We utilize **Be Vietnam Pro** for its cultural resonance and modern geometry, paired with **Inter** for high-utility labeling.

| Role | Token | Font | Size | Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Be Vietnam Pro | 3.5rem | High-impact hero statements; use `medium` weight. |
| **Headline**| `headline-md`| Be Vietnam Pro | 1.75rem | Section headers; ample letter-spacing (-0.02em). |
| **Title**   | `title-lg`   | Be Vietnam Pro | 1.375rem | Product names in cards. |
| **Body**    | `body-lg`    | Be Vietnam Pro | 1rem | Product descriptions; line height at 1.6 for readability. |
| **Label**   | `label-md`   | Inter | 0.75rem | Micro-copy, metadata, and status badges. |

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "tech-heavy" for this brand. We use **Ambient Depth**.

- **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` card sitting on a `surface_container_high` background provides all the separation needed without a single pixel of shadow.
- **Ambient Shadows:** When a floating element (like a Cart Drawer) is required, use a custom shadow: `0px 20px 40px rgba(26, 28, 28, 0.06)`. The tint is derived from `on_surface` to keep it natural.
- **The "Ghost Border" Fallback:** If accessibility requires a border (e.g., in a high-density data table), use `outline_variant` at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components: Refined Utility

### Product Cards
- **Structure:** No borders. Use `surface_container_lowest` for the card body. 
- **Visuals:** Images should have a subtle `xl` (`0.75rem`) corner radius.
- **Spacing:** Use `spacing.6` (1.5rem) for internal padding to ensure the "Editorial" feel.

### Status Badges (Pills)
Instead of harsh status colors, use "Soft-State" styling:
- **Pending:** `secondary_container` text on `surface_container_high`.
- **Shipping:** `tertiary` text on `tertiary_fixed_dim`.
- **Delivered:** `primary` text on `on_primary_container`.
- **Cancelled:** `error` text on `error_container`.

### Data Tables (Admin)
- **Constraint:** Forbid the use of vertical and horizontal divider lines. 
- **Solution:** Use alternating row colors (Zebra striping) with `surface` and `surface_container_low`. 
- **Header:** Use `label-md` in all-caps with 0.05em tracking for an authoritative, "Data-Journalism" look.

### Form Validations
- **Input Fields:** Use `surface_container_highest` for the background. The "Active" state is indicated by a 2px bottom-bar of `primary`, rather than a full box stroke.
- **Error State:** Use `error` text for the helper message, and a subtle `error_container` tint for the field background.

### Custom Component: The "Heritage Motif" Divider
Instead of a line, use a subtle 48px wide SVG motif (e.g., a stylized rice grain or lotus pattern) in `outline_variant` at 30% opacity to separate long-form editorial content.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use asymmetrical margins (e.g., `spacing.24` on the left, `spacing.12` on the right) for hero layouts to create a bespoke, non-template feel.
- **Do** prioritize high-quality photography with warm, natural lighting.
- **Do** use `9999px` (full roundedness) for interaction chips, but `xl` (0.75rem) for structural containers.

### Don’t:
- **Don’t** use pure black (`#000000`) for text. Always use `on_surface` (`#1a1c1c`) to maintain a premium, ink-on-paper feel.
- **Don’t** use 1px dividers to separate list items. Use `spacing.4` of vertical whitespace instead.
- **Don’t** use "vibrant" or "neon" greens. Stick to the earthy, desaturated tones of the primary/secondary tokens.