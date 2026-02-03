# API Simplification - Step Endpoint

## Changes Made

### Backend (server.js)

**Before:**
The `/api/step` endpoint required the entire game state in the request body:
```json
{
  "worldState": { ... },
  "physicalMap": { ... },
  "toggleOn": [],
  "toggleOff": [],
  "totalEnergyConsumed": 0
}
```

**After:**
The `/api/step` endpoint now only requires a list of cells to turn ON:
```json
{
  "toggleOn": ["cell_0_cov_0", "cell_1_cap_5"]
}
```

### Server-Side State Management

Added three new server variables:
- `serverWorldState` - Current world state (levels and minions)
- `serverPhysicalMap` - Physical map with exclusion zones and portals
- `serverTotalEnergyConsumed` - Cumulative energy consumed

These are:
- **Initialized** when `/api/generate` is called
- **Updated** after each successful `/api/step`
- **Restored** when `/api/restart` or `/api/undo` is called

### Benefits

1. **Simpler API**: Clients only send what they want to change (cell toggles)
2. **Single Source of Truth**: Server maintains authoritative game state
3. **Reduced Payload**: Much smaller request bodies
4. **Better State Management**: History tracking uses server state
5. **Clearer Intent**: `toggleOn` array clearly shows user actions

### API Response

Both `/api/step` and `/api/undo` return:
```json
{
  "result": "success",
  "msg": "Step completed successfully",
  "worldState": { ... },
  "currentStep": 5,
  "energyConsumed": 10.5,
  "totalEnergyConsumed": 52.5,
  "energyLeft": 947.5
}
```

The `currentStep` is now the authoritative step number from the server.

### Frontend Changes

Updated `App.jsx` to send simplified request:
```javascript
const response = await fetch('/api/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggleOn: [] })  // Only send cells to toggle
});
```

## Testing

1. Generate a new world - server state is initialized
2. Execute steps - only `toggleOn` array is sent
3. Undo - server restores previous state
4. Restart - server resets to initial state

All state management is now server-side!
