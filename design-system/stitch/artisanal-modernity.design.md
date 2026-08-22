---
name: Artisanal Modernity
colors:
  surface: '#fff9ed'
  surface-dim: '#DED7C5'
  surface-bright: '#fff9ed'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#faf3e2'
  surface-container: '#f5eddc'
  surface-container-high: '#efe8d7'
  surface-container-highest: '#e9e2d1'
  on-surface: '#1e1c11'
  on-surface-variant: '#44474c'
  inverse-surface: '#333025'
  inverse-on-surface: '#f7f0df'
  outline: '#74777d'
  outline-variant: '#c4c6cc'
  surface-tint: '#525f71'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0f1c2c'
  on-primary-container: '#778598'
  inverse-primary: '#bac8dc'
  secondary: '#80543b'
  on-secondary: '#ffffff'
  secondary-container: '#fdc2a3'
  on-secondary-container: '#794d36'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#101b30'
  on-tertiary-container: '#79849d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e4f9'
  primary-fixed-dim: '#bac8dc'
  on-primary-fixed: '#0f1c2c'
  on-primary-fixed-variant: '#3a4859'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#f4ba9c'
  on-secondary-fixed: '#311302'
  on-secondary-fixed-variant: '#653d26'
  tertiary-fixed: '#d7e2ff'
  tertiary-fixed-dim: '#bbc6e2'
  on-tertiary-fixed: '#101b30'
  on-tertiary-fixed-variant: '#3c475d'
  background: '#fff9ed'
  on-background: '#1e1c11'
  surface-variant: '#e9e2d1'
  ink-text: '#0A0F14'
  paper-white: '#FFFFFF'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.01em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 32px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  max-width: 1280px
  section-gap: 96px
  section-gap-mobile: 48px
---

## Brand & Style

The design system embodies a "Modern Heritage" aesthetic, tailored for a high-end fabric and haberdashery business. It balances the tactile, time-honored tradition of textiles with a clean, contemporary precision. The brand personality is sophisticated, knowledgeable, and curated, aiming to evoke a sense of quiet luxury and reliability.

The chosen style is **Minimalism with Modern Precision**. By moving away from high-contrast serifs toward a unified, harmonious sans-serif palette, the interface achieves a more accessible and streamlined feel. It prioritizes clarity and generous whitespace, treating the UI as a calm, organized studio environment where the quality of the fabrics (content) can take center stage. The emotional response is one of effortless elegance and professional warmth, appealing to an audience that values both classic quality and modern efficiency.

## Colors

The palette is anchored by the organic **Sand** (#EAE3D2) background, which provides a warm, natural foundation reminiscent of linen or high-quality parchment. 

- **Primary (Heritage Navy):** #0D1B2A. Used for the most critical hierarchical elements, including primary navigation and major headings. It provides a sharp, professional contrast against the sand base.
- **Secondary (Accent Copper):** #B07D62. Reserved for high-intent actions (CTAs) and subtle highlights. It evokes the metallic finish of dressmaking shears or copper rivets.
- **Tertiary (Deep Slate):** #1B263B. A softer alternative to navy used for supporting UI elements, subtle borders, and secondary iconography.
- **Neutral (Sand/Ink):** The background is strictly #EAE3D2. Text content is set in **Ink Text** (#0A0F14) to ensure maximum legibility and a crisp, "printed" feel for an older, discerning audience.

## Typography

The system utilizes **Hanken Grotesk** for all levels of the hierarchy. This font was chosen for its exceptional legibility, balanced geometry, and modern character, which aligns perfectly with a high-end professional aesthetic.

- **Legibility:** The open counters and generous x-height make this font particularly effective for an older audience, ensuring comfort during long reading sessions.
- **Headlines:** Large headers use a Bold weight with slightly tighter tracking to create a strong, architectural presence in Heritage Navy.
- **Body Copy:** Set in a 20px base for the `lg` variant, the body text prioritizes a comfortable line height (1.6x) to prevent eye fatigue.
- **Labels:** Set in all-caps with increased letter spacing and a heavier weight to provide clear functional separation from editorial content.

## Layout & Spacing

This design system uses a **Fixed Grid** model to maintain the disciplined structure of a bespoke editorial layout.

- **Grid System:** A 12-column centered grid with a maximum width of 1280px. Gutters are fixed at 24px to ensure breathing room between technical specs and fabric imagery.
- **Rhythm:** Generous vertical spacing is a core tenet. 96px gaps between sections emphasize the "curated gallery" feel, preventing the page from feeling cluttered or overwhelming.
- **Responsive Behavior:** On mobile, margins reduce to 20px and section gaps to 48px. Typography scales down specifically for display sizes, while body text remains large and legible.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Low-contrast Outlines**, avoiding traditional heavy shadows to maintain a tactile, paper-like quality.

- **Surface Tiering:** Use pure White (#FFFFFF) for elements that need to appear raised, such as cards or modals, against the Sand background. This creates depth through value contrast rather than artificial shadows.
- **Borders:** Use hairline borders (1px) in Deep Slate at 15% opacity to define boundaries. This mimics the subtle creases or edges of stacked fabric swatches.
- **Interactive State Depth:** For active or hovered elements, a subtle 10% opacity Heritage Navy shadow with a large blur (16px+) can be used to indicate "lift" without breaking the flat, artisanal aesthetic.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding provides a human, approachable touch that mirrors the "soft goods" nature of the business while maintaining the structure of a premium brand.

- **Components:** Buttons, input fields, and chips all utilize the base 0.25rem radius.
- **Imagery:** Large fabric showcases or gallery images may use `rounded-lg` (0.5rem) to feel like framed specimens.
- **Layout:** Main layout containers and section backgrounds remain sharp (0px) to uphold the architectural integrity of the grid.

## Components

- **Buttons:** Primary buttons are solid **Heritage Navy** with **Sand** text, using the `label-md` typographic style (All-caps). Hover states transition smoothly to **Accent Copper**.
- **Input Fields:** To maintain a clean look, use "Outlined" fields with a 1px border in Deep Slate (20% opacity). Labels should use `label-sm` and sit just above the frame.
- **Cards:** Cards are pure White (#FFFFFF) with a Soft (0.25rem) radius and a subtle 1px border. No shadows are used in their resting state.
- **Chips/Tags:** Used for fabric properties (e.g., "100% Silk"). These are small, Sand-colored pills with a Heritage Navy 1px border and `label-sm` text.
- **Navigation:** Top-tier navigation uses Hanken Grotesk Bold. The active state is indicated by a 2px Heritage Navy bottom-border that spans the width of the text, resembling a clean thread or stitch.
- **Dividers:** Use thin horizontal lines in Deep Slate at 10% opacity. For major section breaks, a 4px wide solid line in Sand-dim (#DED7C5) can be used for a more tectonic feel.
