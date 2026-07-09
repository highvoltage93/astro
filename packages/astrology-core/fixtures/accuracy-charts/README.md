# Accuracy Fixtures

These fixtures are regression baselines generated from the local Swiss Ephemeris adapter.
They are meant to catch accidental changes in core astrology calculations:

- planetary longitudes, signs, sign degrees, and direct/retrograde motion;
- Koch and Placidus house cusps;
- body placement by house for each house system;
- active house rulers and planet-to-house rulerships;
- major planet-to-planet aspects and orbs.

They are not independent external references. When the calculation model is intentionally changed, regenerate fixtures and review the diff:

```bash
SWISSEPH_EPHE_PATH=/path/to/ephemeris corepack pnpm accuracy:generate
```

To verify the current engine against the saved baselines:

```bash
SWISSEPH_EPHE_PATH=/path/to/ephemeris corepack pnpm accuracy:verify
```

Independent, locked reference data captured from the official Astrodienst `swetest`
interface lives in `../external-reference-charts`. Use `accuracy:audit` to prove
astronomical accuracy against those references. Do not use `accuracy:generate` to
update external references.
