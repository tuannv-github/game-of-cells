# Simulation Logic Verification

## Coverage Calculation
Coverage uses **circular** geometry: a minion at `(mx, mz)` is covered by a cell at `(cx, cz)` with radius `R` if:
- **Level Match**: Same level (`c.level === m.level`).
- **Circle Check**: `sqrt((mx-cx)² + (mz-cz)²) < R`.

The hexagon cell shape in the UI is for illustration only; coverage logic uses circles.

## Movement Validation
- **Valid Move**: A minion movement is valid if the new position falls within the **circle** of ANY cell (Active or Inactive) on the same level.
- **Service Failure**: If a minion moves into coverage of an **Inactive** cell (and no Active cell covers it), the movement is allowed, but the game state will report **Game Over** (Service Lost) immediately after the step.
- **Retry Logic**: If a random move lands completely outside any cell circle, the minion retries up to 10 times. If all attempts fail, the minion stays in its original position.

## Portal Usage
- **Allowed Types**: `HUMAN`, `HUMANOID`, `DOG_ROBOT`.
- **Restricted Types**: `TURTLE_BOT` (Robot) cannot use portals.
- **Drones**: Fly freely between levels (ignoring portals).

## Step Tracking
- The `/api/step` endpoint now returns the `currentStep` counter, which increments on each successful step calculation.
