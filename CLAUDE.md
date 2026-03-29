# Quinine Cybersecurity Website — Claude Code Guide

## Project Overview

Single-page marketing website for **Quinine Cybersecurity Ltd.** — an AI security firm based at Level39, Canary Wharf, London. The site showcases services, compliance frameworks, and captures leads via a contact form.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 (`server.js`) |
| Frontend | Vanilla HTML/CSS/JS in `public/index.html` |
| CSS framework | Tailwind CSS via CDN (inline `tailwind.config`) |
| Animations | GSAP 3.12.2 + ScrollTrigger + Lenis 1.0.29 (all CDN) |
| Database | SQLite3 — stores contact form leads |
| Fonts | Plus Jakarta Sans, Syne (now mapped to Arial in Tailwind), JetBrains Mono |

## File Structure

```
Qunine Website/
├── server.js              # Express backend — serves static files + /api/contact
├── package.json           # 3 deps: express, cors, sqlite3
├── database.sqlite        # Lead submissions (auto-created on first run)
├── CLAUDE.md              # This file
├── public/
│   ├── index.html         # PRIMARY website (1200+ lines) — edit this
│   └── Website.html       # Older alternate design — do not modify
```

## How to Run Locally

```bash
node server.js
# Visit http://localhost:3000
```

No build step. No npm scripts needed. The server serves `public/` as static files.

## Design System

### Colors (defined in Tailwind config, `index.html` lines 17–24)

| Name | Hex | Usage |
|------|-----|-------|
| `navy` | `#0A2463` | Primary text, borders, backgrounds |
| `deepnavy` | `#061439` | Preloader bg, dark sections, mobile overlay |
| `electric` | `#2E6FF2` | Accent, CTA borders, highlights |
| `glow` | `#4A8BFF` | Secondary glow on orb |
| `offwhite` | `#F7F8FA` | Problem section background |
| `cream` | `#FAFBFE` | Card hover backgrounds |
| `slate` | `#202834` | Body text, nav links, card body copy |

### Typography (Tailwind font utilities)

| Class | Resolves to | Role |
|-------|-------------|------|
| `font-syne` | Arial | All headlines, logo, step numbers, preloader |
| `font-jakarta` | Plus Jakarta Sans | All body copy, nav links, card text |
| `font-mono` | JetBrains Mono | Section labels, badge text, stat counters |

### Key CSS Classes

- `font-extrabold` + `tracking-[-0.035em]` + `leading-[1.05]` — headline style
- `text-slate` — body copy color (`#202834`)
- `text-electric` — accent color
- `cta-pill` — pill-shaped button/link (navy border, hover fill)
- `cta-primary` — filled variant of `cta-pill`
- `service-card` — card with spotlight mouse-tracking effect
- `hoverable` — triggers custom cursor enlargement
- `data-magnetic` — enables magnetic hover drift on element

## Sections (with anchor IDs)

| Section | ID | Notes |
|---------|----|-------|
| Hero | `#hero` | Animated orb, headline, subtext, CTAs, trust badges |
| Credibility Marquee | (no id) | Scrolling compliance frameworks, dark bg |
| Problem | `#problem` | Split-column layout |
| Services | `#services` | 3-col grid, 6 cards (card 1 spans 2 cols) |
| Approach | `#approach` | 3-step timeline with animated SVG line |
| Frameworks | `#frameworks` | Accordion list of 7 compliance frameworks |
| Trust/Stats | `#trust` | Statistics row |
| CTA + Footer | `#cta-section` / `#contact` | Contact form, footer |

## Animation Architecture

### GSAP ScrollTrigger
- All scroll-driven animations use `ScrollTrigger.batch()` or individual `ScrollTrigger` instances
- Default scrub: `scrub: 0.5`; default trigger: `"top 80%"`
- The approach timeline SVG uses `pathLength` with `scrub: 1`
- Stats counter runs once when `#trust` enters viewport

### Lenis Smooth Scroll
- Initialised at bottom of `<script>` block
- Paused during preloader; resumed in preloader completion callback
- RAF loop: `gsap.ticker.add((time) => lenis.raf(time * 1000))`

### Preloader
- Counter animates 0→100 with GSAP, then fades out
- `#preloader-text` and `#preloader-counter` are the two elements
- After completion: hero badge, headline words, subtext, CTAs fade/slide in

## Backend API

### POST `/api/contact`
**Request body:** `{ email: string, concern: string }`
**Validation:**
- Regex email format check
- Blocks free email providers: gmail, yahoo, hotmail, outlook, aol, icloud, mail, protonmail, zoho
**Response:** `201 { message: "..." }` on success, `400` on validation error, `500` on DB error
**Database:** Inserts into `leads` table — `(id, email, concern, timestamp)`

## Rules — Do Not Break

1. **No CDN version bumps** — GSAP 3.12.2 and Lenis 1.0.29 are pinned; bumping versions can break animations
2. **No npm build step** — the site uses CDN Tailwind; do not introduce PostCSS/Vite/webpack
3. **Keep all GSAP animations** — they are core to the brand; do not strip or simplify
4. **Keep corporate email validation** — the backend intentionally rejects free email providers
5. **Tailwind config is inline** — all custom colors/fonts live in the `<script>` block at lines 13–33; add extensions there, not in a separate config file
6. **New CSS goes in the `<style>` block** (lines 35–346) — do not create separate CSS files

## Publishing Checklist

Before deploying to production:

- [ ] Add `"start": "node server.js"` to `package.json` scripts
- [ ] Set `PORT` environment variable (default is 3000)
- [ ] Set CORS `origin` in `server.js` to the production domain (currently `'*'`)
- [ ] Replace SQLite with PostgreSQL or managed DB for production scale
- [ ] Add rate limiting to `/api/contact` (e.g. `express-rate-limit`)
- [ ] Set `X-Frame-Options`, `Content-Security-Policy`, and other security headers
- [ ] Minify `index.html` or serve with gzip compression
- [ ] Verify Google Fonts load (Plus Jakarta Sans, JetBrains Mono are still used for body/mono)
- [ ] Test form submission end-to-end with a corporate email
- [ ] Test on mobile viewport (375px) — hamburger menu, stacked grid, reduced orb sizes
- [ ] Test with `prefers-reduced-motion` — all animations should be disabled
- [ ] Back up `database.sqlite` before deploying
