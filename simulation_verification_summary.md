# Simulation Logic Verification

## Coverage Calculation
We have verified and updated the coverage calculation logic to ensure strict adherence to **Pointy Top Hexagon** geometry, consistent with the visualization.

The coverage check enforces the following conditions for a minion at position `(mx, mz)` relative to a cell at `(cx, cz)` with radius `R`:
1. **Level Match**: Calculate only against cells on the same level (`c.level === m.level`).
2. **Vertical Bounds**: `|mz - cz| < R` (Z-distance check).
3. **Diagonal Bounds**: `(sqrt(3)/2 * |mx - cx|) + (0.5 * |mz - cz|) < R` (Slanted edge check).
4. **Horizontal Bounds**: `|mx - cx| < R * sqrt(3)/2` (Vertical side check).

This ensures minions cannot exist in or move into "bulge" areas that fall outside the visual hexagon but inside the diagonal bounding box.

## Movement Validation
- **Valid Move**: A minion movement is considered valid if the new position falls within the hexagon of **ANY** cell (Active or Inactive) on the same level.
- **Service Failure**: If a minion moves into coverage of an **Inactive** cell (and no Active cell covers it), the movement is allowed, but the game state will report **Game Over** (Service Lost) immediately after the step.
- **Retry Logic**: If a random move lands completely outside any cell footprint, the minion retries up to 5 times. If all attempts fail, the minion stays in its original position (and likely loses service if the original position was also invalid/uncovered).

## Portal Usage
- **Allowed Types**: `HUMAN`, `HUMANOID`, `DOG_ROBOT`.
- **Restricted Types**: `TURTLE_BOT` (Robot) cannot use portals.
- **Drones**: Fly freely between levels (ignoring portals).

## Step Tracking
- The `/api/step` endpoint now returns the `currentStep` counter, which increments on each successful step calculation.
