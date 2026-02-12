# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IEGF (Informal Economy Global Forum) is a static multi-page website for a people-centred global development organization focused on Africa. The site targets potential members, partners, donors, and media.

## Tech Stack

- **HTML5** static pages (no framework)
- **Tailwind CSS** via CDN (`https://cdn.tailwindcss.com`)
- **Vanilla JavaScript** (minimal, only for mobile menu toggle)
- No build process, no bundler, no package.json

## Development

To preview locally:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000`

## Brand System

Font: **Montserrat** (400, 600, 700) via Google Fonts, configured as `fontFamily.sans` in Tailwind config.

Colors (defined in inline Tailwind config on each page):
- `navy`: #052a64 (primary, authority/trust)
- `green`: #4ba755 (CTA, growth/action)
- `lightgrey`: #d9d9d9 (background panels)
- `darkgrey`: #737373 (body text)

## Architecture

Each HTML page is self-contained with:
1. Inline Tailwind config (colors)
2. Shared header/nav structure (copy-pasted, not componentized)
3. Shared footer structure
4. Mobile menu JS at bottom

**Pages:**
- `index.html` - Homepage with hero, 4-door routing section, services snapshot, impact quote
- `who-we-are.html` - About, vision, mission, values, team structure
- `what-we-do.html` - Programs: membership, task forces, services, GIC
- `get-involved.html` - Registration forms with anchor IDs (#register, #partner, #gic)
- `partners.html` - Partner logos grid, partnership models (CSI Alignment, Supplier Development), funders section (#funders)
- `news-events.html` - News, media releases, webinars, conferences, media/press section (#media)
- `contact.html` - Contact info, form, social links

## Conventions

- Mobile-first responsive design (use `md:` and `lg:` breakpoints)
- Primary CTA: `bg-green text-white` with hover/focus states
- Secondary CTA: `border-2 border-navy text-navy` outlined style
- Max content width: `max-w-6xl mx-auto px-4`
- Image placeholders use gradient backgrounds with descriptive text
- Icons currently use emoji; intended to be replaced with SVG icons

## Known Placeholders

- Logo: text "IEGF" (needs actual logo)
- Images: gradient divs with captions (need real photography)
- Partner logos: placeholder rectangles
- Forms: no backend submission (need integration)
- Social links: `href="#"` (need real URLs)
