# DESIGN.md: KnowYourFaculty (landing + faculty directory)

## Brief
- **Subject:** KnowYourFaculty, anonymous faculty ratings for VIT-AP students.
- **Audience:** students choosing faculty at registration, and students posting ratings.
- **Job:** get a student to open a faculty page in under 10 seconds, and to trust the ratings.
- **Scope:** landing page and faculty directory. Other pages keep the quiet style from the unslop pass.
- **Stack:** the existing Vite + React + Tailwind v4 app. GSAP (ScrollTrigger, SplitText) and Lenis added. No Next/Astro, no router change.
- **Theatre level:** utility app, so no loader, no WebGL, no curtain transitions. Craft goes into one signature system, type, and hover.

## Concepts considered
| | Idea | Anchor | Signature | O / F / Fe / P |
|---|---|---|---|---|
| A. Material | Registration week: the page is a weekly timetable and faculty slot into it | slot-based registration | cells fill as you scroll | 3 / 3 / 3 / 3 |
| B. Formal | **The strictness scale.** The site's own five tiers, Rod-God to Loose-God, become a ruler that runs through the page; a needle on it moves everything | the product's tier vocabulary (Rod-God, Rod, Moderate, Loose, Loose-God) | the needle: pointer position moves it and the profile card re-reads at each tier | 4 / 5 / 4 / 1 |
| C. Name | Roll call: names are called and marked present or absent | attendance is a rated field | register ticks | 3 / 4 / 4 / 3 |

**Pick B.** Strongest anchor (the vocabulary exists nowhere else), cheapest to build well, and it carries through to the directory cards and the footer CTA. Steal from C: nothing.

## Concept Card
```
Idea:        Faculty are measured on a strictness scale, so the site is a ruler with a needle.
Metaphor:    A marker sliding along a scale and settling on a tier.
Signature:   Hero needle. Pointer x (or a tier button, or arrow keys on a button) moves it; the
             tier word, score, bars, dot colour and the example profile card all follow one value.
Emotion:     "Oh, I can feel the difference between Rod and Loose" in the first 3 seconds.
Motion verb: slide and settle (expo.out, short overshoot-free), like a marker finding its tier.
Screenshot:  the full-width ruler with the needle on "Loose" and the profile card above it.
```
Idle state: the needle breathes (about 1.2% of the scale, sine, on the GSAP ticker, paused off screen, off under reduced motion).

## Art direction
- **Palette** (unchanged from the unslop pass, now by role)
  - ground: `#f6f5f2` light / `#141415` dark
  - surface: `#fdfcfa` / `#19191b`
  - ink: `#1f1c18` / `#ededed`
  - muted: `#6f6860` / `#85858b`
  - line: ink at 10% / 8%
  - accent (actions only): `#2f5bd0` / `#3f6ae4`
  - tier colours (the one bright element, only in the ruler, dots, directory needles): `#dc2626 #ea580c #ca8a04 #65a30d #16a34a`
- **Type:** Instrument Sans (display and interface, weight 400 to 500, display tracking -0.03em), Geist Mono for scores, scale labels and counts.
- **Grid:** max 72rem, 12 columns, 24 to 64px gutters. Hero is an asymmetric split (text 1fr, card 26rem) over a full-width ruler.
- **Shape:** 10px controls, 16px cards. Ruler segments 2px.
- **Motion language:** `expo.out` for entrances (1.0 to 1.2s), `power3.out` 0.3 to 0.5s for hovers, stagger 35 to 80ms.
- **Primary hover (buttons):** a darker fill sweeps in from the left. **Cards:** a tier-coloured needle draws along the card's bottom edge to the faculty's score. Both run on `:hover` (fine pointer) and `:focus-visible`; on touch the card needle is shown at rest.

## Composition plan
```
HERO (full viewport)
 wordmark ........................................ context line (mono)
 H1 (split lines)        |  profile card  (re-reads at each tier)
 sub, 2 actions          |
 ------------------------------------------------------------------
 TIER WORD (big)  4.2 / 5                         move across the scale
 [ Rod-God ][ Rod ][ Moderate ][ Loose* ][ Loose-God ]   <- segments + needle
 five tier buttons (keyboard / touch)

FEATURES  title left, three hairline columns, rows draw in
TRUST     title left (1/3), definition list (2/3)
FAQ       two columns of hairline rows
CTA       five-segment line draws across, large line + button
```

## Genericness test
A generic model given "make a landing page for a faculty rating site" lands on star ratings, a search box and a gradient hero. This one is built on the five-tier strictness vocabulary and a driven ruler. Changed from first draft: dropped numbered feature tiles (decorative sequence), dropped a planned loader (utility app).

## Decisions and assumptions
- The profile card is an example (invented name), captioned as such.
- Tier index from needle: `floor((10 + 80 t) / 20)`, value `1 + 4 t`. Higher is more lenient, matching `TIER_SYSTEM` (5 = Loose-God).
- Lenis runs on the landing page only and is stopped while a modal locks body scroll.
- Reduced motion: no Lenis, no ticker, no breathing, no reveals; needle moves instantly on input.

## QA pass 1 (outside critic, 6.25 overall) and what changed
Critic's idea reading: "a student-run faculty-rating directory whose one visual idea is the five-step Rod-God to Loose-God scale." That matches the Concept Card, but the critic found the scale stopped at the landing hero. Fixes:
- **The scale carries through the app.** Every directory card now shows its tier on the five-step bar plus the tier word; the 404 is the scale with the needle past the end ("Off the scale"); the guest gates reuse the same primary button.
- **One container.** Nav, landing and inner pages share `max-w-7xl` with `px-4 sm:px-6`, so the left edge is the same everywhere.
- **Semantics.** The raw HTML now carries an `<h1>`, `<main>` and links (visually hidden, replaced on mount). Guest states of rankings, polls and contact each have one `<h1>`; the detail page renders a single visible `<h1>` (the other profile-card slot is a `<p>`). Unknown URLs return a real 404 on Vercel (explicit rewrites plus `public/404.html`), and the app's own `*` route shows the same page.
- **Contrast.** Tier colours used as text are mixed toward the ink colour (`getTierTextColor`); the bright colours stay on dots, bars and segments.
- **Hover.** Filters, Previous/Next and Share Page use the same fill sweep as the landing buttons. The theme toggle and logo stay as utility links (colour change only).
- **Focus.** The button fill no longer clips the focus ring (`overflow: hidden` removed).
- **Phone load.** Directory images carry width/height and decoding hints; the first row loads eagerly with high priority, the rest stay lazy.

### Decision: idle state
`desktop.idleMotion` is false on every page because the landing hero's needle breathes by about 4% of the scale, which the pixel-diff check cannot see. Inner pages are tool screens (search, read, rate) and stay still at rest; their life is in the card needle, the button fill and the staggered card entrance. This is deliberate for a utility app.

## QA passes 2 and 3
Outside critic scores: 6.25 (pass 1), 6.45 (pass 2), 6.9 (pass 3: Design 7, Usability 7, Creativity 7, Content 6; Accessibility 8). Pass 2 and 3 fixes: one 100 px left edge for nav, landing, inner pages and footer (the inner-page container no longer wraps the landing page when the nav appears, which also removed a layout shift); tier word and five-step bar on the detail score for signed-in readers; nav underline draw; sign-in button fill sweep; keyboard focus scrolled into view under Lenis; revealed content finishes on focus; directory card photos requested resized (phone LCP 6.6 s to 4.8 s); preconnect to Cloudinary and Supabase; per-professor page title.
Still open, ranked by the critic: sign-in walls on rankings and polls show nothing to preview; the detail page's per-section stars still use the old palette; phone directory is one card per screen (9.5k px, LCP 4.8 s); contact is thin; no page transition; nav hidden on the landing hero until scroll (deliberate).
