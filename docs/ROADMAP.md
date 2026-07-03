# Astroprocessor Roadmap

## Product Direction

Astroprocessor is a web-only astrology platform that combines:

- precise calculations at the level of Astro.com and TimePassages;
- a modern daily UX inspired by Co-Star and CHANI;
- Ukrainian-first localization;
- AI explanations grounded in the user's real chart;
- professional tools inspired by Sotis;
- live astrology consultations and consultant CRM.

The product should not start as a giant professional astrology suite. The first release should prove three things:

1. Users can enter birth data and receive a technically reliable natal chart.
2. The chart is understandable for beginners without losing precision for advanced users.
3. AI adds synthesis and dialogue on top of verified interpretation content.

## Phase 0: Foundation And Risk Reduction

Target: 2-3 weeks

Goal: remove the biggest technical risks before full product buildout.

### Scope

- Validate Swiss Ephemeris integration on the backend.
- Validate historical timezone and geocoding flow.
- Create a reference dataset for calculation accuracy checks.
- Define core domain model: user, birth profile, chart, placement, aspect, house, interpretation.
- Create UX wireframes for first-time birth data entry, natal chart, and interpretation reading.
- Choose exact implementation shape:
  - monorepo structure;
  - API framework;
  - database provider;
  - auth provider;
  - payments provider for later phases.

### Exit Criteria

- A proof of concept can calculate a natal chart from birth date, exact time, and place.
- Planet positions are checked against at least 10 known reference charts.
- Product scope for MVP is frozen.
- Technical architecture is documented.

## Phase 1: MVP Natal Chart

Target: 10-12 weeks

Goal: launch the first useful product: natal chart, basic interpretation, accounts, localization.

### Scope

- User registration and login.
- Birth profile creation:
  - date;
  - exact time;
  - unknown time mode;
  - birthplace search;
  - coordinates;
  - historical timezone;
  - daylight saving handling.
- Natal chart calculation:
  - tropical zodiac by default;
  - Placidus, Whole Sign, Equal, Koch, Campanus, Regiomontanus, Porphyry;
  - Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto;
  - Ascendant, Midheaven, lunar nodes, Chiron, Lilith;
  - major aspects with configurable default orbs.
- SVG chart wheel:
  - signs;
  - houses;
  - planet glyphs;
  - aspect lines;
  - responsive desktop and mobile layouts.
- Interpretation v1:
  - planet in sign;
  - planet in house;
  - major aspects;
  - beginner-friendly summaries;
  - glossary tooltips.
- AI interpretation v1:
  - generated synthesis from calculated chart facts;
  - no hallucinated placements;
  - citations/trace to chart factors used in the response.
- Ukrainian and English localization.
- Basic dashboard:
  - saved chart;
  - short natal summary;
  - next recommended section.
- Admin/content workflow for interpretation text management.
- Basic observability:
  - server logs;
  - error tracking;
  - calculation audit records.

### Out Of Scope

- AI chat.
- Paid subscriptions.
- Social comparison.
- Progressions, directions, returns, horary.
- Astromap and professional canvas workspace.

### Exit Criteria

- A new user can create an account, enter birth data, and view a natal chart in Ukrainian.
- Backend natal calculation completes in under 500 ms for common cases.
- Planet longitudes differ from reference sources by no more than 0.01 degrees for the MVP body set.
- The app is usable on mobile and desktop.
- The product has enough value for private beta.

## Phase 2: Daily Use, Transits, AI Chat, Synastry

Target: 8-10 weeks

Goal: turn the product from a one-time chart calculator into a recurring-use platform.

### Scope

- Daily dashboard:
  - current Moon sign and phase;
  - key personal transits;
  - short daily insight;
  - "week ahead" view.
- Transits:
  - current date;
  - arbitrary date;
  - transit-to-natal aspects;
  - date navigation.
- AI chart chat:
  - chat grounded in natal chart and current transits;
  - guardrails against unsupported medical, legal, and financial claims;
  - conversation history;
  - prompt/context tracing for debugging.
- Synastry:
  - create second birth profile;
  - compare two charts;
  - major inter-chart aspects;
  - relationship summary.
- Social sharing:
  - private share links;
  - public/private profile settings;
  - friend comparison invitation flow.
- Browser notifications and email digest foundation.

### Exit Criteria

- Returning users have a useful reason to open the product daily.
- Users can ask follow-up questions about their chart and current transit context.
- Synastry works without requiring both users to have full accounts.

## Phase 3: Learning And Advanced Forecasting

Target: 8-12 weeks

Goal: support students and advanced users while keeping the UX accessible.

### Scope

- Structured educational module:
  - Astrology 101;
  - houses;
  - signs;
  - planets;
  - aspects;
  - transits;
  - glossary integration.
- Progressions:
  - secondary progressions;
  - solar arc directions as first advanced method.
- Solar and lunar returns.
- Midpoints:
  - midpoint calculation;
  - sortable table;
  - basic interpretation hooks.
- Asteroids:
  - Ceres, Pallas, Juno, Vesta.
- Fixed stars v1:
  - limited curated catalog;
  - conjunction-based interpretation.
- SEO content foundation:
  - glossary pages;
  - public educational articles;
  - structured metadata.

### Exit Criteria

- The platform can serve both beginners and astrology students.
- Advanced techniques are discoverable without overwhelming the default experience.
- Educational content can bring organic search traffic.

## Phase 4: Monetization, Consultations, CRM

Target: 8-12 weeks

Goal: create a paid business layer around reports, AI, and live consultations.

### Scope

- Freemium limits:
  - free natal chart;
  - paid deep reports;
  - paid AI chat quota;
  - paid advanced techniques.
- Stripe integration and optional local Ukrainian payment provider.
- Consultation marketplace:
  - astrologer profile;
  - service types;
  - calendar availability;
  - booking;
  - payment;
  - confirmation emails.
- Consultant CRM:
  - client list;
  - saved client charts;
  - notes;
  - consultation history;
  - quick chart lookup.
- Admin:
  - bookings;
  - refunds/statuses;
  - content moderation;
  - subscription management.

### Exit Criteria

- Users can pay for a report, AI quota, or consultation.
- The first consultant can manage real clients inside the platform.
- Payment and booking flows are auditable.

## Phase 5: Professional Suite

Target: ongoing

Goal: surpass the professional depth of common web astrology tools and approach Sotis-level workflows.

### Scope

- Primary and symbolic directions.
- More progression methods and configurable parameters.
- Horary astrology module.
- Arabic Parts catalog:
  - built-in formulas;
  - custom formula editor;
  - user-defined points.
- Interpretation profiles:
  - classical;
  - psychological;
  - predictive.
- Canvas workspace:
  - multiple charts side by side;
  - nested charts;
  - chart tables;
  - saved layouts.
- Public figure chart database:
  - curated dataset;
  - source quality labels;
  - search and comparison.
- Astrocartography.

### Exit Criteria

- Practicing astrologers can use Astroprocessor as a serious workbench, not just a client-facing report generator.
- Professional features are gated behind an appropriate paid tier.

## Release Strategy

### Private Alpha

- Internal users only.
- 20-50 reference charts.
- Focus on calculation accuracy and chart rendering.

### Private Beta

- 50-200 invited users.
- Ukrainian-first UX.
- Natal chart and interpretation feedback.
- Manual support for edge cases.

### Public Beta

- Open signups.
- Daily dashboard and AI chat available with limits.
- SEO pages begin indexing.

### Paid Launch

- Paid reports or AI quota.
- Consultation booking.
- CRM available to first astrologer accounts.

## Key Product Metrics

- Birth profile completion rate.
- Chart calculation success rate.
- Calculation accuracy regression failures.
- First interpretation read completion.
- AI answer helpfulness rating.
- Day 7 retention.
- Weekly active users.
- Consultation booking conversion.
- Paid conversion rate.

