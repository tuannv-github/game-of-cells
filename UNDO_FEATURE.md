# Undo Feature Implementation

## Overview
Added undo functionality to allow users to go back one step in the simulation.

## Changes Made

### Backend (server.js)

1. **State History Tracking**
   - Added `stateHistory` array to store previous game states
   - Limited to last 10 states to prevent memory issues
   - Cleared on game generation and restart

2. **New API Endpoint: `/api/undo`**
   - **Method**: POST
   - **Description**: Restores the previous game state from history
   - **Response**: 
     - Success: Returns the restored state with worldState, physicalMap, totalEnergyConsumed, and currentStep
     - Failure: Returns error if no history available

3. **State Saving**
   - Before each step execution, current state is saved to history
   - Includes: worldState, physicalMap, totalEnergyConsumed, currentStep, isGameOver

### Frontend

1. **App.jsx**
   - Added `undoStep()` function to call the `/api/undo` endpoint
   - Updates UI state when undo is successful
   - Displays appropriate status messages
   - Passed `onUndo` prop to Sidebar component

2. **Sidebar.jsx**
   - Added `Undo` icon import from lucide-react
   - Added `onUndo` to component props
   - Added UNDO button in the action bar with purple color scheme
   - Button positioned after RESTART button with undo icon

## Usage

1. **Generate or load a simulation**
2. **Execute one or more steps** using "NEXT STEP" button
3. **Click the UNDO button** (purple icon) to go back one step
4. **Repeat** to undo multiple steps (up to 10 steps back)

## API Documentation

The new endpoint is automatically documented in Swagger UI at:
- `http://localhost:40001/api-docs`
- `http://localhost:40001/docs/openapi.json`

## Limitations

- Can only undo up to 10 steps (configurable by changing the history limit in server.js)
- History is cleared when generating a new world or restarting the game
- Undo is only available when using backend mode
