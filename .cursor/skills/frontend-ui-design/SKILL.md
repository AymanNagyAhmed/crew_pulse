---
name: frontend-ui-design
description: >-
  Designs and reviews CrewPulse React UI with intentional composition, branding,
  typography, motion, and anti-generic patterns. Use when building or changing
  pages in frontend_crew_pulse, landing/marketing surfaces, attendance/check-in
  UI, or when the user asks for UI/UX polish, visual design, or frontend design.
---

# CrewPulse frontend UI design

Apply when working under `frontend_crew_pulse/` or any React UI for CrewPulse.

## Hard composition rules

- **One composition:** The first viewport must read as one composition, not a dashboard (unless it is a dashboard).
- **Brand first:** On branded pages, the brand or product name must be a hero-level signal, not just nav text or an eyebrow. No headline should overpower the brand.
- **Brand test:** If the first viewport could belong to another brand after removing the nav, the branding is too weak.
- **Typography:** Use expressive, purposeful fonts; avoid default stacks (Inter, Roboto, Arial, system-ui alone).
- **Background:** Do not rely on flat, single-color backgrounds; use gradients, images, or subtle patterns for atmosphere.
- **Full-bleed hero only:** On landing/promotional surfaces, the hero image is a dominant edge-to-edge visual plane or background. Do not use inset hero images, side-panel heroes, rounded media cards, tiled collages, or floating image blocks unless the design system already requires it.
- **Hero budget:** First viewport usually: brand, one headline, one short supporting sentence, one CTA group, one dominant image. No stats, schedules, event listings, address blocks, promos, “this week” callouts, metadata rows, or secondary marketing in the first viewport.
- **No hero overlays:** No detached labels, floating badges, promo stickers, info chips, or callout boxes on top of hero media.
- **Cards:** Default: no cards. Never cards in the hero. Cards only when they are the container for a user interaction. If removing border/shadow/background/radius does not hurt interaction or understanding, it should not be a card.
- **One job per section:** One purpose, one headline, usually one short supporting sentence.
- **Real visual anchor:** Imagery shows product, place, atmosphere, or context. Decorative gradients alone are not the main visual idea.
- **Reduce clutter:** Avoid pill clusters, stat strips, icon rows, boxed promos, schedule snippets, and competing text blocks.
- **Motion:** Ship at least 2–3 intentional motions for visually led work; motion creates presence and hierarchy, not noise.
- **Color & look:** Choose a clear direction; define CSS variables. Avoid AI-default looks: purple-on-white / purple-to-indigo themes; warm cream (#F4F1EA) + high-contrast serif + terracotta; broadsheet hairline / zero-radius newspaper layouts. Avoid bias to dark mode, purple, glow, rounded-full pills, multi-layer shadows, emojis.
- **Responsive:** Pages must work on desktop and mobile.

## React implementation

- Prefer modern React patterns (`useEffectEvent`, `startTransition`, `useDeferredValue` when appropriate).
- Do not add `useMemo` / `useCallback` by default; follow the app’s React Compiler guidance if present.
- Colocate styles with features; prefer CSS modules or a single design-token CSS layer over ad-hoc inline styles for themes.
- Accessibility: semantic landmarks, focus states, contrast, `prefers-reduced-motion`.

## CrewPulse product cues

- Domain: catering, events, hospitality crew — venues, shifts, contactless check-in.
- Never display raw biometric embeddings or unnecessary PII in the UI.
- Operator/admin surfaces may be denser than marketing; still avoid nested card soup and purple-gradient defaults.

## Review checklist

Before finishing a UI change:

- [ ] First viewport passes the brand test
- [ ] No forbidden AI aesthetic defaults
- [ ] Hero budget respected (if marketing/landing)
- [ ] Cards only where interaction requires them
- [ ] Tokens via CSS variables; desktop + mobile checked
