# Astroprocessor Backlog

## Prioritization

- P0: required for MVP or technical correctness.
- P1: required for strong beta experience.
- P2: important after validation.
- P3: professional or long-term expansion.

## Epic 1: Product Foundation

Priority: P0

Goal: establish the application shell, design system, localization, routing, and baseline accessibility.

### Stories

- As a user, I can open the web app on desktop and mobile and see a polished, responsive interface.
- As a Ukrainian-speaking user, I can use the main MVP flow in Ukrainian.
- As an English-speaking user, I can switch to English.
- As a product team member, I can add new pages without duplicating layout code.
- As a user with accessibility needs, I can navigate core flows with keyboard and screen reader support.

### Acceptance Criteria

- App shell includes navigation, authenticated and unauthenticated states, and responsive layout.
- UI meets WCAG 2.1 AA for core MVP flows.
- Text content is loaded through an i18n layer, not hardcoded in components.
- PWA metadata is prepared even if full offline support ships later.

## Epic 2: Authentication And Account

Priority: P0

Goal: let users create accounts and securely access saved charts.

### Stories

- As a visitor, I can sign up with email or supported OAuth provider.
- As a user, I can sign in and sign out.
- As a user, I can reset my password or recover access depending on auth provider.
- As a user, I can delete or export my personal data.

### Acceptance Criteria

- Auth sessions are protected server-side.
- Birth data is not exposed to another user.
- Account deletion removes or anonymizes personal data according to policy.
- Authentication errors are clear and localized.

## Epic 3: Birth Data Intake

Priority: P0

Goal: collect birth details precisely enough for reliable chart calculation.

### Stories

- As a user, I can enter birth date, exact birth time, and birth city.
- As a user, I can mark birth time as unknown.
- As a user, I can choose from geocoding suggestions instead of manually entering coordinates.
- As a user, I can review the resolved timezone and coordinates before saving.
- As an advanced user, I can manually correct coordinates if needed.

### Acceptance Criteria

- Birth date and time are validated before calculation.
- Place search returns city, country, latitude, longitude, and timezone context.
- Historical timezone resolution accounts for daylight saving rules.
- Unknown birth time mode disables or clearly qualifies Ascendant, houses, and house-based interpretations.
- Saved birth profiles are encrypted or protected according to data security policy.

## Epic 4: Calculation Engine

Priority: P0

Goal: calculate charts with professional-grade accuracy.

### Stories

- As a user, I can calculate a tropical natal chart.
- As an advanced user, I can choose a house system.
- As an advanced user, I can see exact degrees and signs for each chart object.
- As QA, I can run regression tests against reference charts.

### MVP Body Set

- Sun
- Moon
- Mercury
- Venus
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune
- Pluto
- Ascendant
- Midheaven
- North Node
- South Node
- Chiron
- Lilith

### MVP House Systems

- Placidus
- Whole Sign
- Equal
- Koch
- Campanus
- Regiomontanus
- Porphyry

### Acceptance Criteria

- Planetary longitudes are within 0.01 degrees of reference data.
- Natal chart calculation usually completes in under 500 ms backend time.
- Calculation output is deterministic for the same input.
- Calculation result includes warnings for polar regions, unknown time, or unsupported edge cases.
- All calculation results are versioned by calculation engine version.

## Epic 5: Aspects And Orbs

Priority: P0

Goal: compute and display meaningful aspects without overwhelming beginners.

### Stories

- As a beginner, I can see major aspects with simple labels.
- As an advanced user, I can inspect exact orb values.
- As an advanced user, I can later customize orb settings.

### MVP Aspects

- Conjunction
- Opposition
- Trine
- Square
- Sextile

### Acceptance Criteria

- Aspect list includes body A, body B, aspect type, exact angle, orb, applying/separating when available.
- Default orb settings are documented.
- Minor aspects are excluded from beginner view in MVP.

## Epic 6: Chart Wheel Visualization

Priority: P0

Goal: render a beautiful, readable, responsive horoscope wheel.

### Stories

- As a user, I can view my natal chart as a wheel.
- As a mobile user, I can inspect placements without cramped labels.
- As an advanced user, I can switch between visual chart and data table.
- As a beginner, I can tap or hover chart elements to see what they mean.

### Acceptance Criteria

- Chart wheel is rendered as SVG.
- Planet glyphs do not overlap unreadably on common chart cases.
- Mobile layout has a fallback placement table.
- Chart objects have accessible labels.
- The chart can be exported as an image in a later iteration without changing the core renderer.

## Epic 7: Interpretation Content Library

Priority: P0

Goal: provide human-written baseline interpretations that AI can build on.

### Stories

- As a user, I can read interpretations for planets in signs.
- As a user, I can read interpretations for planets in houses.
- As a user, I can read interpretations for major aspects.
- As a content editor, I can update interpretation copy without changing application code.

### Acceptance Criteria

- Content exists in Ukrainian for MVP placement and aspect combinations.
- Content model supports English translations.
- Each interpretation has a source type, version, and review status.
- Missing interpretation content has graceful fallback behavior.

## Epic 8: AI Interpretation

Priority: P0 for summary generation, P1 for chat

Goal: synthesize chart factors into useful, personalized explanations without fabricating chart facts.

### Stories

- As a user, I can receive a synthesized overview of my natal chart.
- As a user, I can see which chart factors influenced the AI summary.
- As the product team, we can evaluate prompt quality and answer safety.
- As a later beta user, I can ask follow-up questions about my chart.

### Acceptance Criteria

- AI prompt uses structured chart facts from the calculation engine.
- AI cannot invent placements that are not present in the chart payload.
- AI output has localized tone and beginner-friendly explanations.
- AI requests and responses are logged with privacy-aware redaction.
- Safety policy blocks medical, legal, financial, and deterministic fatalistic claims.

## Epic 9: Daily Dashboard And Transits

Priority: P1

Goal: create daily engagement beyond the initial natal chart.

### Stories

- As a returning user, I can see today's key transits.
- As a user, I can see current Moon sign and phase.
- As a user, I can look one week ahead.
- As a user, I can receive an email digest or browser notification.

### Acceptance Criteria

- Dashboard is personalized to the user's natal chart.
- Transit calculations use the same ephemeris pipeline as natal charts.
- Daily text distinguishes general Moon content from personal transit content.
- Notification opt-in is explicit.

## Epic 10: Synastry And Social Sharing

Priority: P1

Goal: let users compare charts and share selected chart views.

### Stories

- As a user, I can create a second person's chart for comparison.
- As a user, I can view relationship aspects between two charts.
- As a user, I can send a private share link.
- As a user, I can control whether my profile is public or private.

### Acceptance Criteria

- Synastry works with one registered user and one guest/saved external profile.
- Share links can be revoked.
- Shared views hide sensitive birth data unless explicitly enabled.
- Relationship interpretations are clearly framed as reflective, not deterministic.

## Epic 11: Education And Glossary

Priority: P1

Goal: teach astrology inside the product at the moment users need context.

### Stories

- As a beginner, I can tap terms like "Ascendant", "orb", or "trine" and get a short explanation.
- As a student, I can follow structured short lessons.
- As SEO traffic, I can discover public glossary pages.

### Acceptance Criteria

- Glossary terms are reusable in tooltips and public pages.
- Lessons have progress tracking in later versions.
- Educational content is available in Ukrainian first.
- Public content has SEO metadata.

## Epic 12: Monetization And Paid Access

Priority: P2

Goal: create paid value without blocking the free natal chart.

### Stories

- As a user, I can buy a deep report.
- As a user, I can subscribe for more AI chat or advanced techniques.
- As an admin, I can see payment status and entitlement state.

### Acceptance Criteria

- Payments are handled through Stripe or selected local provider.
- Entitlements are checked server-side.
- Failed payments and refunds update access correctly.
- Pricing can be configured without deployment.

## Epic 13: Consultation Marketplace

Priority: P2

Goal: let users book live astrology consultations.

### Stories

- As a user, I can view an astrologer's profile and services.
- As a user, I can book a time slot.
- As a user, I can pay for a consultation.
- As a consultant, I can see upcoming bookings.

### Acceptance Criteria

- Calendar availability is timezone-aware.
- Booking confirmations are sent by email.
- A booking has clear lifecycle states: pending, paid, confirmed, completed, cancelled, refunded.
- Consultant can access the client's shared birth profile only with consent.

## Epic 14: Consultant CRM

Priority: P2

Goal: support working astrologers with client chart management.

### Stories

- As a consultant, I can save client charts.
- As a consultant, I can add private notes.
- As a consultant, I can view consultation history.
- As a consultant, I can search clients quickly.

### Acceptance Criteria

- Client notes are private to the consultant account.
- Users can revoke access to shared personal data.
- CRM search supports name, email, date, and tags.
- CRM is separated from consumer user experience.

## Epic 15: Professional Astrology Suite

Priority: P3

Goal: deliver Sotis-inspired professional workflows in a modern web interface.

### Stories

- As a professional astrologer, I can calculate secondary progressions and directions.
- As a professional astrologer, I can configure Arabic Parts formulas.
- As a professional astrologer, I can inspect midpoints in a sortable table.
- As a professional astrologer, I can use a canvas workspace with multiple charts.
- As a professional astrologer, I can choose an interpretation school/profile.

### Acceptance Criteria

- Advanced methods are hidden from beginner mode by default.
- Custom formulas are validated before calculation.
- Canvas layouts can be saved and restored.
- Professional calculations have separate reference test suites.

## Epic 16: Security, Privacy, Compliance

Priority: P0

Goal: treat birth data as sensitive personal data.

### Stories

- As a user, I understand how my data is used.
- As a user, I can delete my data.
- As an operator, I can audit access to sensitive data.
- As an engineer, I can avoid leaking birth data into logs.

### Acceptance Criteria

- Privacy policy and terms exist before public beta.
- Sensitive fields are encrypted at rest where practical.
- Logs redact birth date, birth time, exact coordinates, and AI prompts where needed.
- Data export and deletion flows are implemented.
- Admin access is role-based and audited.

## Epic 17: Observability And QA

Priority: P0

Goal: make calculation quality and production failures visible.

### Stories

- As QA, I can run chart accuracy regression tests.
- As an engineer, I can inspect calculation failures.
- As an operator, I can monitor latency and error rate.
- As product, I can understand onboarding funnel drop-off.

### Acceptance Criteria

- Reference chart fixtures are versioned.
- CI runs unit tests and calculation regression tests.
- Sentry or equivalent captures frontend and backend errors.
- Metrics include calculation latency, geocoding failure rate, and AI failure rate.

## Suggested MVP Sprint Breakdown

### Sprint 1: Technical Skeleton

- Monorepo setup.
- Next.js app shell.
- API service skeleton.
- Database schema draft.
- Auth decision and spike.
- Swiss Ephemeris proof of concept.

### Sprint 2: Birth Data And Calculation

- Birth profile form.
- Geocoding integration.
- Timezone resolution.
- Natal calculation endpoint.
- Reference chart test suite.

### Sprint 3: Chart UI

- SVG wheel renderer.
- Placement table.
- Aspect table.
- Responsive chart page.
- Basic tooltips.

### Sprint 4: Interpretation Content

- Content schema.
- Seed Ukrainian MVP interpretations.
- Interpretation matching logic.
- Chart summary page.

### Sprint 5: AI Summary

- Structured chart-to-prompt pipeline.
- AI summary generation.
- Safety guardrails.
- Response trace to chart factors.

### Sprint 6: Polish And Private Beta

- i18n completion.
- Accessibility pass.
- Error states.
- Onboarding polish.
- Private beta instrumentation.

