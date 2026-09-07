# WORLD//STATE LIVE

A live geopolitical map + strategy simulation fork.

## What it does

- Reads a persistent world tension graph from `data/live.json`.
- Updates 12 high-risk country pairs with an hourly GitHub Actions bot.
- Uses GDELT as a free public-news sensor and preserves scan history.
- Reads GearWatch / `jandromani/HolaInframundo` as a causal-mechanism sensor.
- Uses an optional OpenRouter pass when `OPENROUTER_API_KEY` exists; otherwise the engine remains deterministic.
- Renders a zoomable world map, tension arcs, chokepoints, news evidence, bot moves and a disaster ranking.
- `LIVE` mode follows the current public-data state.
- `FORK / SIM` freezes that snapshot, lets the player take control of a country and resolves fictional weekly turns with country bots.

## Architecture

```text
GDELT ───────────┐
                 ├─> world-scan.mjs ─> data/live.json ─> WORLD MAP
GearWatch ───────┘          │                 │
                            │                 ├─ LIVE
optional LLM synthesis ─────┘                 └─ FORK / SIM

Git history = long-term world memory
live.json history = fast UI memory
```

## Live bot

`.github/workflows/world-live.yml` runs hourly and commits the updated world state with `worldstate-bot`.

Optional repository secret:

- `OPENROUTER_API_KEY`

Optional repository variable:

- `OPENROUTER_MODEL` (default `openai/gpt-oss-20b`)

Without the secret the scan still runs: GDELT headlines are scored with a bounded lexicon + structural floors + hysteresis. The UI labels tension values as model indices, not probabilities.

## Local

Any static server works for the UI. To run a world scan:

```bash
npm run scan
```

## Next engine layers

1. Country-state indicators (macro, energy, political stability, defense, trade dependence).
2. Election calendar and government-change vectors.
3. UN Comtrade trade graph and commodity exposure.
4. PortWatch/AIS maritime chokepoint telemetry.
5. EIA/ENTSO-E energy flows.
6. UCDP conflict-event layer.
7. Persistent entity graph linking countries, ports, commodities, companies and mechanisms.
8. LLM newsroom that narrates simulated facts but cannot mutate deterministic state.
