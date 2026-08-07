# Design System — Agent Instructions

This skill describes the visual design language for all UI output. Every component, layout, and page should follow the design specs in the module files below. These describe *what the design looks like* — you choose how to implement the styles.

## Style
A modern, graphic, editorial-poster aesthetic — warm and confident — built on alternating cream (#F8E9D1) and burnt orange (#BE3F00) sections, an amber brand color (#CC8800), Chakra Petch as the single typeface, sharp 0px corners on every component, and zero shadows. The system is colorful, opinionated, and illustrative: every full-width section is composed with hand-drawn-feeling SVG illustrations (suns, towers, silhouettes, terraces) the way a printed travel poster or Tokyo conference identity would be.

## Before Writing Any Code

1. **Read every module that applies.** For a landing page, read at minimum: `layout.md`, `typography.md`, `colors.md`, `buttons.md`, `cards.md`, `shadows.md`, `radius.md`, `borders.md`. Do NOT write JSX until you have loaded all relevant modules.

## Critical Rules

- **Tokens are AGNOSTIC, NOT framework classes:** The tokens defined in the `.md` files (like `neutral-primary-soft`, `heading`, `border-default`) are agnostic design system tokens, NOT literal classes from any specific framework. Do not blindly use them as utility classes unless you have explicitly mapped them in your styling configuration. You must implement the mapping yourself.

- **Cross-reference modules.** A card containing buttons must satisfy both `cards.md` AND `buttons.md`.
- **Dark mode is automatic.** The CSS custom properties resolve differently in light/dark via `@media (prefers-color-scheme: dark)`. Never manually swap colors.
- **Every interactive element needs hover, focus, and disabled states** — defined in the relevant module.
- **Use semantic HTML:** proper heading hierarchy (`h1`→`h6`), `<button>` for actions, `<a>` for navigation, ARIA attributes where needed.
- **Sharp corners only:** every component has `border-radius: 0`. No exceptions, including avatars, pills, toggles, and badges.
- **No shadows:** every shadow token is `none`. Depth comes from solid borders, color blocks, and the alternating section pattern.
- **Section backgrounds alternate ONLY between cream (#F8E9D1) and burnt orange (#BE3F00).** No other section background colors are permitted.
- **Each section must include a graphic illustration or geometric SVG composition** (suns, moons, towers, silhouettes, terraces, arcs) as a compositional element — not decoration.

## Module Index

### Foundation (read first for any UI work)
- [colors.md](colors.md) — all background, text, and border color tokens
- [typography.md](typography.md) — heading scale, paragraphs, labels, links
- [layout.md](layout.md) — spacing rhythm, containers, animation, visual depth
- [radius.md](radius.md) — border-radius scale
- [shadows.md](shadows.md) — elevation tokens
- [borders.md](borders.md) — border widths and styles

### Components
- [buttons.md](buttons.md) — button variants, sizes, states, glint effect
- [button-group.md](button-group.md) — grouped button structure
- [cards.md](cards.md) — card structure, background, interactivity
- [inputs.md](inputs.md) — form controls, labels, states
- [alerts.md](alerts.md) — alert variants
- [badges.md](badges.md) — badge variants, sizes, dismissible chips
- [lists.md](lists.md) — list components
- [avatars.md](avatars.md) — avatar variants, sizes, indicators
- [icon-shapes.md](icon-shapes.md) — icon containers

### Complex Components
- [accordion.md](accordion.md) — accordion variants
- [dropdown.md](dropdown.md) — dropdown menus
- [modals.md](modals.md) — modal dialogs
- [tabs.md](tabs.md) — tab navigation
- [tables.md](tables.md) — table structure
- [pagination.md](pagination.md) — pagination components
- [sidebars.md](sidebars.md) — sidebar navigation
- [radios-checkboxes-toggle.md](radios-checkboxes-toggle.md) — selection controls
- [tooltips-popovers.md](tooltips-popovers.md) — tooltips and popovers
- [content.md](content.md) — grid system, responsiveness

---

## Source file: `accordion.md`

# Accordion

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** full width, 1px border (border-default color), 0px radius — sharp rectangular corners
- **Item separator:** 1px bottom border (border-default) on every item except last

## Trigger (Button)

- **Layout:** flex, space-between, full width
- **Padding:** 24px horizontal, 18px vertical
- **Font:** 16px, semibold (600), 0.4px tracking
- **Text color:** heading
- **Background:** neutral-secondary-soft when on cream sections; neutral-primary when on burnt-orange sections
- **Hover:** neutral-tertiary-soft background
- **Focus:** outline none, 2px solid border-brand outline with 2px outer offset
- **Transition:** background-color and color, 150ms ease-out
- **Open state:** neutral-tertiary background, fg-brand-strong text

## Panel (Content)

- **Padding:** 24px horizontal, 20px vertical
- **Background:** neutral-primary
- **Top border:** 1px, border-default color
- **Font:** 14px, body color, 1.6 line-height

## Chevron Icon

- Size: 16x16px
- Color: body text color
- Closed: 0deg rotation
- Open: 180deg rotation
- Transition: transform, 150ms ease-out

## Variants

### Default (Collapse)
One panel open at a time. Items stacked inside a single shared bordered wrapper. Sharp corners (0px radius).

### Separated Cards
Each item is independent — has its own 1px border (border-default) and 0px radius. 12px bottom margin between items. No shared outer border. No shadow.

### Always Open
Multiple panels can expand simultaneously. Same styling as Default.

### Flush
No outer border. Trigger and panel have transparent backgrounds. Only bottom border dividers between items. Use inside containers that already provide a background.

## States

| State | Trigger appearance |
|---|---|
| Closed | heading text, neutral-secondary-soft background |
| Open | fg-brand-strong text, neutral-tertiary background |
| Hover | neutral-tertiary-soft background |
| Focus | 2px brand outline with 2px offset, no default outline |
| Disabled | fg-disabled text, not-allowed cursor, no hover/focus |

---

## Source file: `alerts.md`

# Alerts

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Padding:** 20px
- **Radius:** 0px (sharp rectangular corners)
- **Border:** 1px (or 2px for the brand and danger variants for graphic emphasis)
- **Heading:** 16px, semibold (600), 0.4px tracking
- **Body:** 14px, normal weight, 1.55 line-height

## Variants

### Brand
- **Background:** brand-softer
- **Border:** 2px border-brand
- **Text:** fg-brand-strong

### Success
- **Background:** success-soft
- **Border:** 1px border-success-subtle
- **Text:** fg-success-strong

### Danger
- **Background:** danger-soft
- **Border:** 2px border-danger
- **Text:** fg-danger-strong

### Warning
- **Background:** warning-soft
- **Border:** 1px border-warning-subtle
- **Text:** fg-warning

---

## Source file: `avatars.md`

# Avatars

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Circular shape:** 0px radius (sharp square crop — circles are not used in this system)
- **Rounded square shape:** 0px radius
- **Default size:** 40x40px
- **Image fit:** cover

## Sizes

| Size | Dimensions | Radius |
|---|---|---|
| Extra Small | 18x18px | 0px |
| Small | 24x24px | 0px |
| Base | 32x32px | 0px |
| Large | 44x44px | 0px |
| XL | 56x56px | 0px |
| 2XL | 64x64px | 0px |

## Bordered Avatar

- 0px padding (no halo gap), 0px radius, 2px solid outline in border-orange color for graphic emphasis
- Alternative: 2px solid border in border-default color

## Stacked Avatars

- Displayed in a row (flex)
- Each avatar: 40x40px, 0px radius, 2px border in border-buffer color
- Overlap: -12px negative margin on all except first

### Stacked Counter
- Same size as avatars (40x40px), 0px radius
- Background: dark-strong, text: white, 12px font, semibold weight, 0.4px tracking
- Same overlap margin as other avatars

## Avatar with Text

- Flex row, 12px gap between avatar and text
- Avatar: 40x40px, 0px radius, cover fit
- Name: heading color, semibold weight
- Subtitle: 14px, body color

---

## Source file: `badges.md`

# Badges

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Border:** 1px
- **Default radius:** 0px
- **Pill radius:** 0px (pills are flat rectangles in this system)
- **Font:** "Chakra Petch", uppercase, 0.6px tracking, semibold (600)

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Default (small) | 11px | 8px | 3px |
| Large | 13px | 10px | 5px |

## Variants

### Brand
- **Background:** brand-softer
- **Border:** 1px border-brand-subtle
- **Text:** fg-brand-strong

### Alternative (Neutral Soft)
- **Background:** neutral-primary
- **Border:** 1px border-default
- **Text:** heading

### Gray (Neutral Medium)
- **Background:** neutral-secondary-medium
- **Border:** 1px border-default
- **Text:** heading

### Danger
- **Background:** danger-soft
- **Border:** 1px border-danger-subtle
- **Text:** fg-danger-strong

### Success
- **Background:** success-soft
- **Border:** 1px border-success-subtle
- **Text:** fg-success-strong

### Warning
- **Background:** warning-soft
- **Border:** 1px border-warning-subtle
- **Text:** fg-warning

### Dark
- **Background:** dark
- **Border:** dark
- **Text:** white

## Pill Badges

Pills use the same 0px radius as default badges in this system. Use the "Pill" variant only for naming consistency — visually they are flat rectangles.

## Badges with Icons

- Icon size (default): 12x12px
- Icon size (large): 14x14px
- Icon spacing: 4px margin next to label

## Icon-only Badge

Square shape — equalize dimensions to 24x24px, no horizontal text padding.

## Dismissible Badges

Badge content + a close button. Close button hover backgrounds per variant:

| Variant | Close button hover background |
|---|---|
| Brand | brand-soft |
| Alternative | neutral-tertiary |
| Gray | neutral-quaternary |
| Danger | danger-medium |
| Success | success-medium |
| Warning | warning-medium |

## Dot / Notification Badge

- Positioned absolutely: -4px top, -4px right
- Size: 10x10px, 0px radius (square dot)
- 2px border in border-buffer color
- Background: danger

---

## Source file: `borders.md`

# Borders

## Width Scale

| Context | Width |
|---|---|
| Default (inputs, buttons, cards) | 1px |
| Emphasis / focus | 2px |
| Heavy / graphic accents (section dividers, illustration frames) | 3px |

## Rules

- Use solid borders by default — they replace shadows as the primary depth/separation device
- Dashed borders only for special cases like file dropzones
- Components in the same family must use matching border widths
- Never mix 1px and 2px borders within a single component
- Borders should always use a token from `colors.md` — never raw hex values

## Usage

| Context | Width |
|---|---|
| Inputs / selects / textareas | 1px default; 2px on focus or error |
| Buttons | 1px for variants that require outlining |
| Cards / containers | 1px default; 2px for a graphic, framed look on burnt-orange sections |
| Section dividers (horizontal rules) | 1px in border-default; 3px in border-orange for graphic emphasis |

---

## Source file: `button-group.md`

# Button Groups

> Dependencies: `buttons.md`, `colors.md`, `radius.md`

## Core Specs

- **Wrapper:** inline-flex, 0px radius, no shadow
- **Children overlap:** -1px left margin on all except first button (so adjacent borders collapse cleanly)
- **Buttons inside the group must NOT have individual shadows.** Shadows are disabled across the whole system.

## Anatomy

### Wrapper
- Display: inline-flex
- Radius: 0px
- Shadow: none

### First Button
- 0px radius on every corner

### Middle Button(s)
- 0px radius on every corner

### Last Button
- 0px radius on every corner

### All buttons except first
- -1px left margin to overlap borders

## Rules

- Buttons inside groups follow all styles from `buttons.md` (background, border, focus rings) — no individual shadows because the system has no shadows
- Icon-only buttons: 16x16px icon, match height of text buttons
- All corners are sharp (0px) — the visual unity of the group comes from the seamless border overlap, not from rounded ends

---

## Source file: `buttons.md`

# Buttons

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs (every button except ghost and disabled)

- **Radius:** 0px (all buttons, including pill-style buttons — pills are flat rectangles in this system)
- **Border:** 1px solid
- **Shadow:** none
- **Glint effect:** disabled in this system. The glint variables resolve to fully transparent values, so the layered box-shadow has no visual effect. Do not invent custom highlight overlays.
- **Font weight:** 600 (semibold)
- **Font:** "Chakra Petch"
- **Letter-spacing:** 0.4px
- **Box sizing:** border-box
- **Transition:** background-color, color, and border-color, 150ms ease-out

## Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Extra small | 12px | 12px | 6px |
| Small | 14px | 14px | 8px |
| Base (default) | 14px | 20px | 12px |
| Large | 16px | 24px | 14px |
| Extra large | 16px | 32px | 16px |

## Variants

### Brand
- **Background:** brand token (#CC8800 amber)
- **Border:** brand token
- **Text:** white
- **Hover:** brand-strong background, brand-strong border
- **Focus ring:** 2px solid border-brand, 2px outer offset
- **Glint:** none

### Secondary
- **Background:** neutral-secondary-medium
- **Border:** border-default-medium
- **Text:** heading color
- **Hover:** neutral-tertiary-medium background, border-default-strong border
- **Focus ring:** 2px solid border-default-strong, 2px outer offset
- **Glint:** none

### Tertiary
- **Background:** neutral-primary
- **Border:** border-default
- **Text:** heading color
- **Hover:** neutral-secondary-medium background, border-default-strong border
- **Focus ring:** 2px solid border-default, 2px outer offset
- **Glint:** none

### Success
- **Background:** success token
- **Border:** success token
- **Text:** white
- **Hover:** success-strong background, success-strong border
- **Focus ring:** 2px solid border-success, 2px outer offset
- **Glint:** none

### Danger
- **Background:** danger token (#BE3F00 burnt orange)
- **Border:** danger token
- **Text:** white
- **Hover:** danger-strong background, danger-strong border
- **Focus ring:** 2px solid border-danger, 2px outer offset
- **Glint:** none

### Warning
- **Background:** warning token
- **Border:** warning token
- **Text:** dark token
- **Hover:** warning-strong background, warning-strong border
- **Focus ring:** 2px solid border-warning, 2px outer offset
- **Glint:** none

### Dark
- **Background:** dark token
- **Border:** dark token
- **Text:** white
- **Hover:** dark-strong background, dark-strong border
- **Focus ring:** 2px solid border-dark, 2px outer offset
- **Glint:** none

### Ghost (no background, no glint)
- **Background:** transparent
- **Border:** transparent
- **Text:** heading color
- **Hover:** neutral-secondary-medium background
- **Focus ring:** 2px solid border-default, 2px outer offset
- **No shadow, no glint effect**

### Disabled (no glint)
- **Background:** disabled token
- **Border:** border-default
- **Text:** fg-disabled color
- **Cursor:** not-allowed
- **No hover, no focus, no shadow, no glint**

## Icons in Buttons

- Icon size: 16x16px
- Spacing: 8px gap between icon and label
- Layout: inline-flex, vertically centered

---

## Source file: `cards.md`

# Cards

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `typography.md`

## Core Specs

- **Background:** neutral-primary (white) on cream sections; neutral-primary-soft (cream) on burnt-orange sections
- **Border:** 1px, border-default color (2px border-orange for graphic emphasis variants)
- **Radius:** 0px (sharp rectangular corners)
- **Shadow:** none

## Card Heading

- Desktop: 24px, semibold (600), heading color, optional 0.4px tracking
- Mobile: 18px, semibold, heading color
- Never skip heading levels — the page hierarchy must logically arrive at the card heading level.

## States

### Static Card (no interactivity)
- Background: neutral-primary on cream sections, neutral-primary-soft on burnt-orange sections
- Border: 1px, border-default
- Radius: 0px
- Shadow: none
- No hover styles. Non-interactive cards must NOT have hover background changes.

### Interactive Card (clickable)
- Same base styles as static card
- Hover: neutral-secondary-medium background, border-default-strong border
- Transition: background-color and border-color, 150ms ease-out
- Cursor: pointer

## Rules

- Background: neutral-primary on cream sections, neutral-primary-soft on burnt-orange sections
- Border: 1px, border-default (or 2px border-orange for graphic emphasis)
- Radius: 0px
- Shadow: none — depth comes from solid borders and color contrast against the section background
- Interactive hover: neutral-secondary-medium background, border-default-strong border
- Non-interactive: no hover styles
- Cards may include a small inline SVG illustration or geometric accent in a corner — keep it within the warm palette (cream / amber / burnt orange)

---

## Source file: `colors.md`

# Color Tokens

## Background Tokens

### Neutral
| Token | Light | Dark |
|---|---|---|
| neutral-primary-soft | #F8E9D1 | #1A0F05 |
| neutral-primary | #FFFFFF | #0D0704 |
| neutral-primary-medium | #FFF6E0 | #2B1810 |
| neutral-primary-strong | #F0DBB8 | #3D2517 |
| neutral-secondary-soft | #BE3F00 | #BE3F00 |
| neutral-secondary | #F8E9D1 | #1A0F05 |
| neutral-secondary-medium | #FFF6E0 | #2B1810 |
| neutral-secondary-strong | #F0DBB8 | #3D2517 |
| neutral-tertiary-soft | #FFF6E0 | #1A0F05 |
| neutral-tertiary | #F0DBB8 | #2B1810 |
| neutral-tertiary-medium | #E5C895 | #3D2517 |
| neutral-quaternary | #D4B27A | #4F3220 |
| quaternary-medium | #C49E5F | #65422A |
| gray | #A88247 | #7E5328 |

### Brand
| Token | Light | Dark |
|---|---|---|
| brand-softer | #FFF6E0 | #3D2900 |
| brand-soft | #FFE9B8 | #664400 |
| brand | #CC8800 | #FFAA00 |
| brand-medium | #FFD580 | #8F5F00 |
| brand-strong | #8F5F00 | #FFD580 |

### Status
| Token | Light | Dark |
|---|---|---|
| success-soft | #EDF5E0 | #1F3505 |
| success | #4A7C0F | #6BA51F |
| success-medium | #D9EBC2 | #2D4D08 |
| success-strong | #2D4D08 | #8FCC2C |
| danger-soft | #FCEAE5 | #5C1008 |
| danger | #BE3F00 | #E84A3D |
| danger-medium | #FAC1B6 | #8F2E00 |
| danger-strong | #8F2E00 | #FF6B5C |
| warning-soft | #FFFAE0 | #4A3500 |
| warning | #F4B400 | #F4B400 |
| warning-medium | #FFF1B0 | #6B5000 |
| warning-strong | #B38400 | #FFD24D |

### Button Glint (CSS custom properties, used for the glint box-shadow effect)
| Variable | Light | Dark |
|---|---|---|
| `--color-1-400` | rgba(255,255,255,0) | rgba(255,255,255,0) |
| `--color-1-700` | rgba(0,0,0,0) | rgba(0,0,0,0) |

### Utility
| Token | Light | Dark |
|---|---|---|
| dark | #1A0F05 | #1A0F05 |
| dark-strong | #0D0704 | #3D2517 |
| disabled | #F0DBB8 | #2B1810 |

### Accent
| Token | Value (same both modes) |
|---|---|
| purple | #7C3AED |
| sky | #0891B2 |
| teal | #0D9488 |
| pink | #E11D48 |
| cyan | #06B6D4 |
| fuchsia | #C026D3 |
| indigo | #4F46E5 |
| orange | #BE3F00 |

## Text Color Tokens

### Base
| Token | Light | Dark |
|---|---|---|
| white | #FFFFFF | #FFFFFF |
| black | #1A0F05 | #1A0F05 |
| heading | #1A0F05 | #F8E9D1 |
| body | #4F3220 | #E5C895 |
| body-subtle | #6B4F2A | #C49E5F |

### Brand
| Token | Light | Dark |
|---|---|---|
| fg-brand-subtle | #FFD580 | #664400 |
| fg-brand | #CC8800 | #FFAA00 |
| fg-brand-strong | #8F5F00 | #FFD580 |

### Status
| Token | Light | Dark |
|---|---|---|
| fg-success | #2D4D08 | #6BA51F |
| fg-success-strong | #1F3505 | #8FCC2C |
| fg-danger | #8F2E00 | #E84A3D |
| fg-danger-strong | #5C1F00 | #FF6B5C |
| fg-warning-subtle | #B38400 | #F4B400 |
| fg-warning | #6B5000 | #FFD24D |
| fg-disabled | #A88247 | #7E5328 |

### Informational / Accent
| Token | Light | Dark |
|---|---|---|
| fg-yellow | #F4B400 | #F4B400 |
| fg-info | #5C3D00 | #FFD580 |
| fg-purple | #7C3AED | #A78BFA |
| fg-purple-strong | #5B21B6 | #C4B5FD |
| fg-cyan | #0891B2 | #22D3EE |
| fg-indigo | #4F46E5 | #818CF8 |
| fg-pink | #E11D48 | #F472B6 |
| fg-lime | #65A30D | #84CC16 |

## Border Color Tokens

| Token | Light | Dark |
|---|---|---|
| border-dark | #1A0F05 | #4F3220 |
| border-buffer | #F8E9D1 | #0D0704 |
| border-buffer-medium | #FFF6E0 | #1A0F05 |
| border-buffer-strong | #FFFFFF | #2B1810 |
| border-muted | #F0DBB8 | #1A0F05 |
| border-light-subtle | #F0DBB8 | #1A0F05 |
| border-light | #E5C895 | #2B1810 |
| border-light-medium | #D4B27A | #3D2517 |
| border-default-subtle | #E5C895 | #1A0F05 |
| border-default | #D4B27A | #3D2517 |
| border-default-medium | #C49E5F | #4F3220 |
| border-default-strong | #A88247 | #65422A |
| border-success-subtle | #C5E0A0 | #1F3505 |
| border-success | #4A7C0F | #6BA51F |
| border-danger-subtle | #FAC1B6 | #5C1008 |
| border-danger | #BE3F00 | #E84A3D |
| border-warning-subtle | #FFE9B8 | #4A3500 |
| border-warning | #F4B400 | #F4B400 |
| border-brand-subtle | #FFD580 | #664400 |
| border-brand-light | #E0A018 | #FFAA00 |
| border-brand | #CC8800 | #FFAA00 |
| border-dark-subtle | #1A0F05 | #3D2517 |
| border-purple | #7C3AED | #A78BFA |
| border-orange | #BE3F00 | #BE3F00 |

## Semantic Usage Rules

- Page/section backgrounds: alternate ONLY between neutral-primary-soft (#F8E9D1 cream) and neutral-secondary-soft (#BE3F00 burnt orange) — no other section background colors
- Primary buttons: brand background (#CC8800 amber)
- Headings: heading text color
- Body text: body text color
- CTA links: fg-brand text color
- Default borders: border-default
- Status borders match intent: success → border-success, danger → border-danger, warning → border-warning
- Disabled: disabled background + fg-disabled text
- On burnt-orange sections (#BE3F00), text defaults to neutral-primary-soft (#F8E9D1) and components flip to cream surfaces with dark text

## Prohibited

- No raw hex/rgb values in component code — always use design tokens
- No brand text color for long-form paragraphs
- No accent text tokens (fg-purple, etc.) for body copy or navigation
- No section background colors other than the two approved values (#F8E9D1 cream and #BE3F00 burnt orange)
- No gradients or purple-to-blue color washes — the palette is solid, warm, and graphic
- No manual light/dark value swapping — let the CSS custom properties handle it

---

## Source file: `content.md`

# Content & Grid System

> Dependencies: `layout.md`, `typography.md`

## Containers

| Type | Max width | Horizontal padding |
|---|---|---|
| Standard | 1200px | 32px |
| Internal (reading) | 720px | — (45–75 char line length) |

## Vertical Padding

| Breakpoint | Vertical padding |
|---|---|
| Mobile | 48px |
| Tablet (≥768px) | 72px |
| Desktop (≥1024px) | 96px or 120px for hero/feature sections |

## Grid System

Mobile-first with flexible desktop configurations.

| Context | Gap |
|---|---|
| Standard content/cards | 32px |
| Compact widgets/metadata | 16px |

### Responsive Columns

| Breakpoint | Columns |
|---|---|
| Mobile (default) | 1–2 |
| Small/Tablet (≥640px) | 2–4 |
| Desktop (≥1024px) | 3–12 |

Full support for 6, 7, 8, 9+ column grids where needed.

## Breakpoints

| Name | Width |
|---|---|
| Small | 640px |
| Medium | 768px |
| Large | 1024px |
| Extra large | 1280px |
| 2x Extra large | 1536px |

## Rules

- Always design mobile-first
- Use layout shifts (column → row) to accommodate horizontal space
- Lists: 24px indentation, 8px vertical gap between items
- Body copy: 16px, 1.65 line-height
- All interactive links follow brand underline/hover protocol
- Section backgrounds inside the content grid still alternate between #F8E9D1 (cream) and #BE3F00 (burnt orange) — no other colors

---

## Source file: `dropdown.md`

# Dropdown

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `inputs.md`

## Core Specs

### Chevron Icon
- Size: 16x16px
- Spacing: 6px left margin, -2px right margin
- Color: inherits from trigger button

### Menu Container
- Background: neutral-primary
- Border: 2px, border-default-medium (the thicker border replaces shadow as the depth cue)
- Radius: 0px
- Shadow: none
- Z-index: elevated above content

### Menu List
- Padding: 8px
- Font: 14px, body color, semibold weight (600)

### Menu Item
- Layout: inline-flex, vertically centered, full width
- Padding: 12px horizontal, 10px vertical
- Radius: 0px
- Hover: neutral-tertiary-medium background, heading text
- Transition: background-color and color, 150ms ease-out

## Trigger Sizes

| Size | Font size | Horizontal padding | Vertical padding |
|---|---|---|---|
| Small | 14px | 14px | 8px |
| Base | 14px | 20px | 12px |
| Large | 16px | 24px | 14px |

## Icon-only Trigger

- Padding: 10px
- Min size: 44x44px
- Icon: 20x20px

## Variants

### Default
- Menu width: 200px, items have 0px radius

### With Divider
- Top border (border-default) between child groups, skip first group

### With Header
- Header padding: 16px horizontal, 12px vertical
- Bottom border: border-default
- Name: heading color, 14px, semibold weight
- Email: body-subtle color, 14px, truncated

### With Icons
- Icon before label: 16x16px, 8px right margin, body color
- On hover, icon color changes to heading

### With Checkbox / Radio
- Inputs: 16x16px, 0px radius, focus ring in border-brand
- Helper text: 12px, body-subtle color, 2px top margin

### With Search
- Search input at top of menu following `inputs.md` specs
- Left icon: 12px left padding, input 36px left padding

### Scrollable
- Max height: 240px, vertical scroll overflow

## States

| State | Appearance |
|---|---|
| Focused trigger | no default outline, 2px solid border-brand outline with 2px outer offset |
| Hover item | neutral-tertiary-medium background, heading text |
| Active/open item | neutral-tertiary-soft background, fg-brand-strong text |
| Disabled item | fg-disabled text, not-allowed cursor, no pointer events |

---

## Source file: `icon-shapes.md`

# Icon Shapes

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- Box sizing: border-box
- Icon must be perfectly centered (inline-flex, centered both axes)
- Circle: 0px radius (sharp square in this system — circles are not used)
- Rounded square: 0px radius (sharp square)

## Sizes

| Size | Container | Icon |
|---|---|---|
| XS | 24x24px | 14x14px |
| SM | 32x32px | 16x16px |
| MD | 40x40px | 20x20px |
| LG | 48x48px | 24x24px |
| XL | 56x56px | 28x28px |

## Color Variants

### Brand
- Shape: square
- Background: brand-softer
- Border: 1px border-brand-subtle
- Icon color: fg-brand-strong

### Gray
- Shape: square
- Background: neutral-secondary-medium
- Border: 1px border-default
- Icon color: body

### Danger
- Shape: square
- Background: danger-soft
- Border: 1px border-danger-subtle
- Icon color: fg-danger-strong

### Success
- Shape: square
- Background: success-soft
- Border: 1px border-success-subtle
- Icon color: fg-success-strong

### Warning
- Shape: square
- Background: warning-soft
- Border: 1px border-warning-subtle
- Icon color: fg-warning

---

## Source file: `inputs.md`

# Inputs

> Dependencies: `colors.md`, `radius.md`

## Core Specs

- **Display:** block, full width
- **Radius:** 0px (sharp rectangular corners)
- **Border:** 1px, border-default-medium
- **Background:** neutral-primary
- **Shadow:** none
- **Font:** 14px, "Chakra Petch", heading color
- **Padding:** 14px horizontal, 12px vertical
- **Placeholder:** body-subtle color
- **Transition:** background-color, border-color, and color, 200ms ease-out

## Label

- Display: block
- Font: 14px, semibold weight (600), heading color, 0.4px tracking
- Margin bottom: 8px
- Label `htmlFor` must match the input `id`

## States

### Default
- Border: 1px, border-default-medium
- Background: neutral-primary

### Hover
- Border: border-default-strong

### Focus
- No default outline
- Border: 2px, border-brand
- Outline: 2px solid border-brand-subtle, 2px outer offset

### Success
- Border: 2px, border-success
- Focus outline: 2px solid border-success-subtle, 2px offset

### Error / Danger
- Border: 2px, border-danger
- Focus outline: 2px solid border-danger-subtle, 2px offset

### Disabled
- Background: disabled
- Border: border-default-subtle
- Text: fg-disabled
- Cursor: not-allowed

## Input with Icons

- Icon size: 16x16px
- Icon color: body
- Container: relative positioned wrapper
- Start icon: absolutely positioned left, 12px left padding — input gets 40px left padding
- End icon: absolutely positioned right, 12px right padding — input gets 40px right padding
- Icons vertically centered within the wrapper

## Rules

- Every input must have a unique `id`
- Every label must have a matching `htmlFor`
- Padding: 14px horizontal, 12px vertical unless overridden for icon variants
- No arbitrary hex or hardcoded colors
- All corners are sharp (0px) — never round inputs

---

## Source file: `layout.md`

# Layout & Spacing

## Spacing Rhythm

Base unit: **8px**. All spacing values should be multiples of 8px.

| Context | Value |
|---|---|
| Section vertical padding | 120px |
| Section header → content | 56px or 72px |
| Heading → paragraph | 16px |
| Container horizontal padding | 32px |
| Flex/grid row gap | 16px |
| Card grid gap | 24px |
| Wide component grid gap | 40px |
| Column layout gap | 56px |

## Container

Standard section container: max-width 1200px, centered, 32px horizontal padding.

Every major section wraps content in this container.

## Content Composition Order

Inside each section, follow this order:
1. Heading (`h1`–`h3`)
2. Leading paragraph
3. Normal paragraph(s)
4. Lists, CTA links, or component grids

## Section Pattern

Every full-width section follows the same graphic, alternating rhythm — this is the load-bearing visual identity of the system.

- **Section background colors are LIMITED to TWO values:**
  - Primary: `neutral-primary-soft` (#F8E9D1 — warm cream)
  - Alternative: `neutral-secondary-soft` (#BE3F00 — burnt orange)
- Sections alternate between these two colors as the page scrolls — never use any other color for full-width section backgrounds
- 120px vertical padding (top and bottom) on every section
- A centered container (max-width 1200px, 32px horizontal padding)
- A section header area with 56px or 72px bottom margin
- Section content below
- Each section should feature one or more graphic illustrations or geometric SVG shapes (suns/discs, towers, silhouettes, lines, terraces) placed compositionally — not as decoration but as a structural element of the section
- On cream sections: text defaults to `heading` color, illustrations use burnt orange and amber
- On burnt-orange sections: text defaults to `neutral-primary-soft` (#F8E9D1), illustrations use cream and a darker burnt-red

## Motion & Animation

- Prefer CSS-native: `transition`, `animation`, `@keyframes`. Use a motion library only when CSS cannot achieve the behavior.
- Prioritize high-impact orchestrated moments over scattered micro-interactions. A single well-sequenced page-load animation using staggered `animation-delay` delivers more perceived quality than many isolated effects.
- Reserve scroll-triggered and hover transitions for moments that reinforce hierarchy or reward attention.
- Easing: prefer `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart) — never bounce or elastic.

## Backgrounds & Visual Depth

- Default to flat, graphic backgrounds — the cream / burnt-orange alternation IS the depth system. No shadows, no gradients, no blur, no glassmorphism.
- Compose each section with illustrated, hand-drawn-feeling SVG elements (suns, moons, mountains, towers, silhouettes, terraces, geometric arcs) reminiscent of editorial poster design.
- Use solid color blocks, thick borders, and geometric shapes for separation rather than soft elevation.
- Every decorative element must serve a compositional purpose (depth, separation, or storytelling). No purely ornamental effects competing with content.

## Must

- All sections: consistent 120px vertical padding
- All containers: max-width 1200px, centered, 32px horizontal padding
- Section headers: 56px or 72px bottom margin
- Consistent vertical rhythm, no crowded sections
- Layouts readable and properly spaced on both desktop and mobile
- Section backgrounds STRICTLY alternate between #F8E9D1 (cream) and #BE3F00 (burnt orange)
- At least one graphic illustration or geometric SVG composition per major section

---

## Source file: `lists.md`

# Lists

> Dependencies: `colors.md`

## Core Specs

- Item spacing: 16px vertical gap between list items
- Text: body color

## List Icons

- Size: 20x20px
- Prevent squishing: no shrink
- Spacing: 8px right margin between icon and text
- Active/featured icon: fg-brand color
- Neutral icon: body color

## Inactive / Disabled Items

Strikethrough text with body-subtle color decoration on the list item.

## Pattern

Vertical flex list with 16px gap. Each item is a flex row with centered alignment — icon (20x20, no-shrink, 8px right margin) followed by a span of body-colored text. Numbered list markers may use fg-brand color for graphic emphasis on cream sections.

---

## Source file: `modals.md`

# Modals

> Dependencies: `colors.md`, `radius.md`, `shadows.md`, `buttons.md`, `inputs.md`

## Core Specs

### Overlay (Backdrop)
- Fixed, covers full screen
- Z-index: 40
- Background: dark token at 60% opacity
- No backdrop blur — clarity through solid color, not glass

### Content Container
- Background: neutral-primary
- Radius: 0px (sharp rectangular corners)
- Shadow: none — depth comes from the dark backdrop and a 2px border-default-strong border
- Border: 2px, border-default-strong
- Padding: 24px

## Anatomy

### Header
- Bottom border: 1px border-default
- Top corners: 0px
- Title: 22px, semibold (600), heading color, 0.4px tracking
- Close button: Ghost variant from `buttons.md`, 8px padding

### Body
- Vertical padding: 24px
- Vertical spacing between elements: 24px
- Text: 16px, 1.65 line-height, body color

### Footer
- Top border: 1px border-default
- Bottom corners: 0px

## Variants

### Default (Information)
Standard header + body + footer with primary/secondary action buttons.

### Pop-up (Confirmation)
Centered text, prominent icon, reduced padding:
- Body: 24px padding, text centered
- Icon: centered, 16px bottom margin, 48x48px, fg-brand-strong color, 0px radius

### Form Modal
Body contains inputs following `inputs.md`. Vertical spacing between form elements: 16px.

## Rules

- Backdrop covers full screen with fixed positioning
- Content: neutral-primary background, 0px radius, 2px border-default-strong border, no shadow
- Header/Footer separated by 1px border-default borders
- Close button must be present and functional
- Accessibility: `role="dialog"`, implement focus trap in code
- Dark mode automatic via token system

---

## Source file: `pagination.md`

# Pagination

> Dependencies: `colors.md`, `radius.md`

## Container

Font: 14px, semibold (600), 0.4px tracking. Items displayed as flex with -1px overlap for seamless borders.

## Pagination Item

- Layout: flex, centered both axes
- Size: 40x40px
- Text: body color
- Background: neutral-primary
- Border: 1px, border-default-medium
- Radius: 0px
- Hover: neutral-tertiary-medium background, heading text
- Focus: no default outline, 2px solid border-brand outline with 2px outer offset
- Overlap: -1px left margin

## Previous / Next Buttons

- Horizontal padding: 14px, height: 40px
- First item: 0px radius
- Last item: 0px radius

## Active Page Item

- Text: white
- Background: brand
- Border: 1px border-brand
- Hover background: brand-strong

## Rules

- Display as flex with -1px child overlap for seamless borders
- Items: neutral-primary background, border-default-medium border, body text
- Active: white text, brand background, brand border
- All corners are sharp (0px) — first and last items match the rest
- All items need hover and focus states

---

## Source file: `radios-checkboxes-toggle.md`

# Radios, Checkboxes & Toggles

> Dependencies: `colors.md`, `radius.md`

## Checkbox

- Size: 18x18px
- Radius: 0px (sharp square)
- Border: 1.5px, border-default-strong
- Background: neutral-primary
- Checked: brand background, brand border, white check
- Focus outline: 2px solid border-brand-subtle, 2px outer offset

### Disabled
- Border: border-default-subtle
- Background: disabled
- Text: fg-disabled

## Radio

- Size: 18x18px
- Radius: 0px (sharp square — no circular radio in this system)
- Border: 1.5px, border-default-strong
- Background: neutral-primary
- Focus outline: 2px solid border-brand-subtle, 2px outer offset
- Checked: brand border, indicator: brand background filling the inner square

### Disabled
- Border: border-default-subtle
- Text: fg-disabled

Group all radio items under the same `name` attribute.

## Toggle

### Track
- Radius: 0px (rectangular track — no rounded toggle)
- Width: 40px, height: 22px
- Background: neutral-quaternary
- Border: 1px, border-default
- Focus-within outline: 2px solid border-brand-subtle, 2px outer offset
- Checked track: brand background, border-brand
- Disabled track: neutral-tertiary background

### Thumb
- Radius: 0px (square thumb that slides inside the track)
- Size: 18x18px
- Background: neutral-primary
- Border: 1px, border-default-strong

### Disabled
- Track: neutral-tertiary background
- Label: fg-disabled text

## Rules

- All selection inputs must have `id` matching label `htmlFor`
- Focus states use a 2px brand outline with 2px outer offset
- Disabled states: no hover/focus interaction
- All shapes are 0px radius — sharp squares only

---

## Source file: `radius.md`

# Border Radius

| Token | Value | Default usage |
|---|---|---|
| base | 0px | Buttons, cards, inputs, modals, sections |
| default | 0px | Badges, tooltips, dropdown items, small controls |
| sm | 0px | Checkboxes, tiny elements |
| full | 0px | Pills, avatars, toggles, dot indicators |

## Rules

- 0px is the default radius across the entire product — every component uses sharp, square corners
- Never use arbitrary radius values outside this scale
- Radius must be consistent within each component family
- The graphic, editorial aesthetic is achieved through sharp geometry — never soften it with rounded corners

---

## Source file: `shadows.md`

# Shadows

| Token | CSS value |
|---|---|
| shadow-2xs | `none` |
| shadow-xs | `none` |
| shadow-sm | `none` |
| shadow-md | `none` |
| shadow-lg | `none` |
| shadow-xl | `none` |
| shadow-2xl | `none` |

## Component Mapping

| Component type | Token |
|---|---|
| Subtle separators, tiny UI details | shadow-2xs or shadow-xs |
| Inputs, buttons, small controls, lightweight cards | shadow-xs or shadow-sm |
| Standard cards, popovers, dropdowns | shadow-md |
| Prominent cards, sticky surfaces | shadow-lg |
| Modals, high-priority overlays | shadow-xl |
| Hero overlays, top-level emphasis (sparingly) | shadow-2xl |

## Rules

- Shadows are disabled across the entire system — every shadow token resolves to `none`
- Depth and separation are conveyed through solid borders, color contrast, and the alternating cream / burnt-orange section pattern instead
- Never override a shadow token with a custom box-shadow value
- Hover/focus states use color and border changes for feedback, not shadow elevation
- Components in the same family share the same baseline (no elevation)

---

## Source file: `sidebars.md`

# Sidebars

> Dependencies: `colors.md`, `radius.md`, `typography.md`, `badges.md`, `alerts.md`

## Core Specs

- Background: neutral-primary-soft (cream)
- Right border: 1px, border-default (for left-sidebar); left border for right-sidebar
- Width: 264px

## Anatomy

### Outer Container
Hidden on mobile, visible at small breakpoint. Needs a toggle/trigger for mobile.

### Inner Wrapper
- Full height, vertical scroll overflow
- Padding: 16px horizontal, 20px vertical

### Navigation List
- Vertical spacing: 4px between items
- Font weight: semibold (600), 0.4px tracking

### Navigation Item
- Layout: flex, vertically centered
- Padding: 12px horizontal, 10px vertical
- Text: heading color
- Radius: 0px
- Hover: neutral-secondary-medium background
- Transition: background-color and color, 150ms ease-out
- Icon: 20x20px, body color, hover → heading color, 75ms transition
- Label: 12px left margin from icon

### Active Item
- Background: brand-softer
- Border-left: 3px solid border-brand (graphic accent stripe)
- Text: fg-brand-strong

### Separator
- 16px top padding, 16px top margin
- Top border: 1px border-default
- 8px vertical spacing below

### Bottom CTA / Card
- Padding: 20px
- Top margin: 24px
- Radius: 0px
- Border: 2px border-orange (graphic frame)
- Background: brand-softer
- Can also use any alert variant from `alerts.md`

## Rules

- Responsive: hidden on mobile with a trigger mechanism
- Icons: 20x20px, body color (hover: heading color)
- Multi-level menus: indent with 44px left padding
- Spacing follows 8px grid
- Active items use a 3px left border in border-brand for a poster-like graphic accent
- Only neutral, brand, or status tokens — no arbitrary colors

---

## Source file: `tables.md`

# Tables

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Wrapper

- Horizontal scroll overflow
- Background: neutral-primary
- Radius: 0px (sharp rectangular corners)
- Border: 2px, border-default-strong (replaces shadow as the framing device)
- Shadow: none

## Table Element

- Full width, left-aligned text (right-aligned for RTL)
- Font: 14px, body color

## Table Head

- Font: 12px, heading color, semibold (600), uppercase, 0.6px tracking
- Background: neutral-secondary-soft (cream tint)
- Bottom border: 2px, border-default-strong
- Cell padding: 24px horizontal, 14px vertical

## Table Body

- Row background: neutral-primary
- Row bottom border: 1px border-default (omit on last row to avoid doubling with wrapper border)
- Row hover: neutral-secondary-medium background (optional)
- Row header: semibold weight, heading color, no-wrap
- Cell padding: 24px horizontal, 16px vertical

## Rules

- Wrapper must have horizontal scroll overflow for responsive scrolling
- Wrapper uses a 2px border in border-default-strong instead of any shadow
- Last row: omit bottom border to avoid doubling with wrapper border
- Row headers: always `scope="row"` for semantic structure
- Hover on rows is optional
- No arbitrary hex codes — use token colors only
- All corners are sharp (0px)

---

## Source file: `tabs.md`

# Tabs

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Core Specs

- Typography: 14px, semibold (600), 0.4px tracking, body color
- Transitions: background-color, color, and border-color, 200ms ease-out

## Variants

### 1. Underline (Default)

**Wrapper:** bottom border, 1px border-default

**Tab Item:**
- Padding: 18px horizontal, 14px vertical
- Bottom border: 3px, transparent
- Top corners: 0px
- Transition: color and border-color, 150ms ease-out

| State | Appearance |
|---|---|
| Active | fg-brand-strong text, 3px border-brand bottom border |
| Inactive | transparent bottom border; hover → heading text, 3px border-default-strong bottom border |
| Disabled | fg-disabled text, not-allowed cursor |

### 2. Pills

**Tab Item:**
- Padding: 18px horizontal, 10px vertical
- Radius: 0px (rectangular pills)
- Border: 1px transparent
- Font weight: semibold
- Transition: background-color, color, and border-color, 200ms ease-out

| State | Appearance |
|---|---|
| Active | brand background, white text, brand border |
| Inactive | body text; hover → neutral-secondary-medium background, heading text |
| Disabled | fg-disabled text, not-allowed cursor |

### 3. Full Width

Children overlap with -1px left margin on all except first.

**Tab Item:**
- Full width, centered text
- Padding: 18px horizontal, 16px vertical
- Background: neutral-primary
- Border: 1px, border-default
- Radius: 0px
- Transition: background-color, color, and border-color, 150ms ease-out
- Hover: neutral-secondary-medium background, heading text

| State | Appearance |
|---|---|
| Active | neutral-secondary-soft background, fg-brand-strong text, border-brand top accent (3px) |
| First item | 0px radius (sharp corners) |
| Last item | 0px radius (sharp corners) |

## Tabs with Icons

- Icon size: 16x16px or 20x20px
- Spacing: 8px right margin
- Layout: inline-flex, centered
- Icons inherit the text color of the tab state

---

## Source file: `tooltips-popovers.md`

# Tooltips & Popovers

> Dependencies: `colors.md`, `radius.md`, `shadows.md`

## Tooltips

### Core Specs
- Padding: 12px horizontal, 8px vertical
- Font: 13px, semibold (600), 0.4px tracking
- Radius: 0px
- Shadow: none
- Transition: opacity, 200ms ease-out

### Dark (Default)
- Background: dark
- Text: white
- Border: 1px, dark-strong

### Light
- Background: neutral-primary
- Text: heading color
- Border: 1px, border-default-strong

## Popovers

### Core Specs
- Background: neutral-primary
- Radius: 0px
- Shadow: none
- Border: 2px, border-default-strong
- Transition: opacity, 200ms ease-out

### Header / Title
- Padding: 14px horizontal, 10px vertical
- Background: neutral-secondary-soft (cream tint)
- Bottom border: 1px border-default
- Font: 14px, semibold (600), heading color, 0.4px tracking

### Body / Content
- Standard: 14px horizontal, 10px vertical padding; 14px, body color
- Rich: 18px padding; 14px, body color, 1.55 line-height

## Arrows

- Size: 8x8px rotated 45deg (sharp triangular tail)
- Color must match the background of the tooltip/popover variant
- Border on the two visible edges should match the wrapper border

## Rules

- Tooltips: 0px radius, no shadow
- Popovers: 0px radius, 2px solid border replaces the shadow as the depth cue
- Dark tooltips: dark background, white text
- Light tooltips/popovers: semantic neutral background + border tokens
- Arrows match parent background color and inherit border color on visible edges

---

## Source file: `typography.md`

# Typography

> Dependencies: `colors.md`

## Core Rules

- **Font:** "Chakra Petch", sans-serif — configured at app level, never override. Load weights 300, 400, 500, 600, 700 (with italics where used).
- **Headings:** semibold weight (600) or bold (700) for hero scale, heading text color, slight uppercase tracking allowed for display headings
- **Body copy:** body text color, never use brand color for paragraphs longer than one sentence
- **Semantic HTML:** Use `h1`–`h6` in order, never skip levels

## Heading Scale

### Desktop

| Element | Size | Line-height | Letter-spacing | Margin-bottom |
|---|---|---|---|---|
| `h1` | 72px | 1 | -1px | 24px |
| `h2` | 52px | 1.1 | -0.5px | 20px |
| `h3` | 40px | 1.15 | -0.3px | 16px |
| `h4` | 32px | 1.2 | -0.2px | 14px |
| `h5` | 24px | 1.3 | 0 | 12px |
| `h6` | 20px | 1.35 | 0.4px | 12px |

### Responsive

| Element | Tablet (≥768px) | Mobile (default) |
|---|---|---|
| `h1` | 48px | 36px |
| `h2` | 40px | 32px |
| `h3` | 32px | 26px |
| `h4` | 28px | 22px |
| `h5` | 22px | 20px |
| `h6` | 18px | 18px |

Mobile-first: start with mobile sizes, scale up at tablet and desktop breakpoints.

Never reduce line-height below 1.0 for any heading.

## Paragraphs

### Leading Paragraph
- Size: 20px
- Weight: 400 (normal)
- Color: body
- Line-height: 1.6
- Max width: ~70 characters

### Normal Paragraph
- Size: 16px
- Weight: 400 (normal)
- Color: body
- Line-height: 1.65
- Max width: ~65 characters

### Small Supporting Copy
- Size: 14px
- Weight: 400 (normal)
- Color: body
- Line-height: 1.55
- Use only for helper text, legal text, captions, metadata.

## UI Labels

| Context | Size | Weight |
|---|---|---|
| Button labels | 14px | 600 (semibold) |
| Input labels | 14px or 16px | 500 (medium) |
| Captions / meta / badges | 12px or 14px | 600 (semibold), uppercase, 0.6px tracking |

Do not apply paragraph line-height (1.6) to control labels.

## Links

- **Inline links:** Same size as surrounding text, fg-brand color, underline (1px solid current), hover → fg-brand-strong color, underline thickens to 2px
- **CTA links:** fg-brand color, semibold weight, no underline at rest, hover → underline appears

## Emphasis

- `<strong>` for high-priority emphasis in body text — use 700 weight
- `<em>` for tone emphasis only, italic, not visual hierarchy
- All-caps only for short labels: uppercase, 0.6px letter-spacing, 12px or 14px

## Dark Mode

Hierarchy stays identical. Only color tokens change (automatic via CSS custom properties). Size, weight, and spacing remain constant.

