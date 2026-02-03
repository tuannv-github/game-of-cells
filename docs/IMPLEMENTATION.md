# Implementation Requirements and Explanation

## Purpose
This document describes the implementation requirements and design decisions for portal (transition zone) generation, placement, and rendering in the `game-of-cells` app.

## Requirements
- Generation must place `PORTAL_PAIR_COUNT` pairs per adjacent level pair, each pair consisting of two zones (one on each level) sharing the same (x,z) center.
- Each portal zone covers a circular `PORTAL_AREA` (area in same units used by map); UI controls must update generation parameters immediately.
- Portals must not collide with non-minion exclusion zones (e.g., walls, rooms). Portals may overlap minion exclusion zones (HUMAN, HUMANOID, DOG_ROBOT, TURTLE_BOT, DRONE).
- If random placement fails, the generator should run a deterministic fallback (concentric rings + angular sweep) to try to place the pair.
- Avoid passing NaN or non-finite radii/positions to Three.js geometry constructors; skip geometry construction and render a label if values are invalid.
- Emit log lines describing configuration, placement attempts, aggregated rejection reasons, fallback placement attempts/results, and a per-level/global summary of placed pairs and their positions.

## Data format (physicalMap)
- `physicalMap.levels[]` each item includes:
  - `type_exclusion_zones`: object keyed by exclusion-type -> array of { x, z, size }
  - `transition_zones`: array of { x, z, radius, targetLevel, id }

Compatibility: older scenarios may use `transition_areas` with `center.x`, `center.z`, `radius`, and `target_level`; the loader/renderer should normalize both shapes.

## Generation Algorithm (high-level)
1. Compute global `mapRadius` using coverage/capacity cells distribution.
2. For each level pair (L, L+1):
   - Compute `radius = sqrt(PORTAL_AREA / PI)` and a conservative `spawnRadius` (incircle of hexagon) so portal circle fully fits.
   - Try random placement attempts (20 attempts):
     - Pick random (r,theta) within `spawnRadius` → candidate (x,z).
     - Reject if out of bounds, overlaps existing portal zones on either level (with a spacing buffer), or collides with non-minion exclusion zones.
     - Record rejection reasons (out_of_bounds, overlap_current, overlap_next, exclusion_collision, spawnRadius<=0).
   - If random attempts fail, log aggregated reasons and run deterministic fallback: concentric rings × angular sweep until a valid location is found or all options exhausted. Log fallback results.
   - Place paired zones: identical center on L and L+1, with `targetLevel` set accordingly and unique id.

## Exclusion rules
- When placing portals, ignore minion-specific exclusion zones: `HUMAN`, `HUMANOID`, `DOG_ROBOT`, `TURTLE_BOT`, `DRONE`.
- Enforce exclusion for infrastructure zones (rooms, walls) stored under other type keys in `type_exclusion_zones`.

## Rendering Safeguards
- Before creating any Three.js geometry (e.g., `ringGeometry`), coerce and validate numeric inputs:
  - `const radius = Number(zone.radius); if (!Number.isFinite(radius) || radius <= 0) { render label only; } else { create ringGeometry args }`.
- When rendering transitions, accept both `transition_zones` and legacy `transition_areas` for compatibility.

## Logging
Log lines the app emits to aid debugging and verification (examples):
- `[GEN] Portal generation config: pairs=4, area=100`
- `[GEN] Random placement failed for pair 1 after 20 attempts. Reasons: exclusion_collision:ROOM:2, overlap_current:3` (aggregated)
- `[GEN] Fallback placed Zone Pair 2 between L0-L1 at (10.2, -3.4) after deterministic search`
- `[GEN] Summary: Placed 2 portal pair(s) between L0-L1: (10.2, -3.4); (2.5, 1.0)`
- `[GEN] Total portal pairs generated across map: 4. Positions: L0->L1@(10.2,-3.4); L0->L1@(2.5,1.0); ...`

## Configuration keys
- `PORTAL_PAIR_COUNT` (integer) — number of pairs to attempt per adjacent level pair.
- `PORTAL_AREA` (numeric) — area of a portal circle; `radius = sqrt(PORTAL_AREA / PI)`.

## Testing & Verification
- Start the app and use the Sidebar sliders to change `Transition Zones per Pair` and `Portal Area`, then click `GENERATE`.
- Confirm console/log outputs show the `[GEN]` lines describing config, attempts, failure reasons (if any), fallback placements, and final summaries.
- Verify in the rendered scene: visible ring(s) / labels where portals placed. If logs indicate `spawnRadius <= 0`, increase `PORTAL_AREA` or map radius.

## Notes & Future Work
- Improve deterministic fallback heuristics (e.g., attempt offset positions when seed exclusion is dense).
- Consider configurable ignore-lists for exclusion checks so portal placement policy can be tuned per scenario.
- If required, add visualization in the UI to highlight the specific exclusion zone(s) that blocked placement when a random attempt fails.

