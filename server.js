import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CONFIG } from './src/config.js';
import { generateWorld } from './src/engine/generation.js';
import { moveMinion, evaluateCoverage } from './src/engine/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 40001;

// Configuration
const LOG_DIR = path.resolve(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const SCENARIOS_DIR = path.resolve(__dirname, 'scenarios');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCENARIOS_DIR)) fs.mkdirSync(SCENARIOS_DIR, { recursive: true });

app.use(cors());
app.use(bodyParser.json());

// Game state
let currentConfig = { ...DEFAULT_CONFIG };
let isGameOver = false;
let currentStep = 0;
let lastCellsShouldBeOn = [];
let lastGameOverMsg = '';
let stateHistory = []; // Store previous states for undo functionality

// Server-side state management
let serverWorldState = null;
let serverPhysicalMap = null;
let serverTotalEnergyConsumed = 0;

const writeToLogFile = (message, level = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
};

// Swagger Definition
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Game of Cells API',
            version: '1.0.0',
            description: 'API for controlling and playing the Game of Cells simulation'
        }
    },
    apis: ['./server.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Custom Swagger setup with dynamic server URL
app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
    const protocol = req.protocol;
    const host = req.get('host');
    const dynamicSwaggerDocs = {
        ...swaggerDocs,
        servers: [
            {
                url: `${protocol}://${host}`,
                description: 'Current server'
            }
        ]
    };
    swaggerUi.setup(dynamicSwaggerDocs)(req, res, next);
});

// Serve OpenAPI JSON specification
app.get('/docs/openapi.json', (req, res) => {
    const protocol = req.protocol;
    const host = req.get('host');
    const dynamicSwaggerDocs = {
        ...swaggerDocs,
        servers: [
            {
                url: `${protocol}://${host}`,
                description: 'Current server'
            }
        ]
    };
    res.json(dynamicSwaggerDocs);
});

// Redirect /docs to /api-docs
app.get('/docs', (req, res) => {
    res.redirect('/api-docs');
});


/**
 * @openapi
 * /api/config:
 *   get:
 *     tags: [Config]
 *     summary: Get current game configuration
 *     responses:
 *       200:
 *         description: Current configuration
 *   post:
 *     tags: [Config]
 *     summary: Update game configuration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Config updated
 */

app.get('/api/config', (req, res) => {
    res.json(currentConfig);
});

app.post('/api/config', (req, res) => {
    currentConfig = { ...currentConfig, ...req.body };
    res.json(currentConfig);
});

/**
 * @openapi
 * /api/maps:
 *   get:
 *     tags: [Scenario]
 *     summary: List all saved scenarios
 *     responses:
 *       200:
 *         description: List of filenames
 *   post:
 *     tags: [Scenario]
 *     summary: Save a new scenario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Scenario saved
 */
app.get('/api/maps', (req, res) => {
    const files = fs.readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
    res.json(files);
});

app.post('/api/maps', (req, res) => {
    const { name, data } = req.body;
    const filename = name || `scenario_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(SCENARIOS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true, filename });
});

/**
 * @openapi
 * /api/maps/{name}:
 *   get:
 *     tags: [Scenario]
 *     summary: Get a specific scenario
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scenario data
 *       404:
 *         description: Not found
 *   delete:
 *     tags: [Scenario]
 *     summary: Delete a specific scenario
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
app.get('/api/maps/:name', (req, res) => {
    const filePath = path.join(SCENARIOS_DIR, req.params.name);
    if (fs.existsSync(filePath)) {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } else {
        res.status(404).send('Not found');
    }
});

app.delete('/api/maps/:name', (req, res) => {
    const filePath = path.join(SCENARIOS_DIR, req.params.name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).send('Not found');
    }
});

/**
 * @openapi
 * /api/generate:
 *   post:
 *     tags: [Scenario]
 *     summary: Generate a new scenario based on current config
 *     responses:
 *       200:
 *         description: New scenario state
 */
app.post('/api/generate', (req, res) => {
    const result = generateWorld(currentConfig, null, true, {
        log: (m) => writeToLogFile(m, 'info'),
        warn: (m) => writeToLogFile(m, 'warn'),
        error: (m) => writeToLogFile(m, 'error')
    });
    isGameOver = false;
    currentStep = 0;
    lastGameOverMsg = '';
    stateHistory = []; // Clear history on new generation

    // Initialize server state
    serverWorldState = result.worldState;
    serverPhysicalMap = result.physicalMap;
    serverTotalEnergyConsumed = 0;

    // Autosave for frontend sync
    const initialSavePath = path.join(SCENARIOS_DIR, 'map_autosave_initial.json');
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');

    // Save minimal state for initial load
    const fullState = {
        ...result,
        totalEnergyConsumed: 0,
        currentStep: 0,
        lastResult: null
    };

    fs.writeFileSync(initialSavePath, JSON.stringify(fullState, null, 2));
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2)); // Also init intermediate

    res.json(result);
});

/**
 * @openapi
 * /api/player/step:
 *   post:
 *     tags: [Player]
 *     summary: Execute a simulation step
 *     description: Executes one step of the simulation. Server maintains state, so only cell toggles need to be provided.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               on:
 *                 type: array
 *                 description: Array of cell IDs that should be ON. All others will be OFF.
 *                 items:
 *                   type: string
 *                 example: ["cell_0_cov_0","cell_0_cov_1","cell_0_cov_2","cell_0_cov_5","cell_0_cap_2","cell_0_cap_8","cell_0_cap_23","cell_1_cov_1","cell_1_cov_2","cell_1_cap_0","cell_1_cap_8","cell_1_cap_9","cell_1_cap_16","cell_1_cap_34"]
 *     responses:
 *       200:
 *         description: Result of the step with current step number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                   example: "Step completed successfully"
 *                 currentStep:
 *                   type: integer
 *                   example: 1
 *                 worldState:
 *                   type: object

 *                 energyConsumed:
 *                   type: number
 *                 totalEnergyConsumed:
 *                   type: number
 *                 energyLeft:
 *                   type: number
 *                 gameOver:
 *                   type: boolean
 *                   description: True if the game has ended (due to failure or completion)
 */
app.post('/api/player/step', (req, res) => {
    // Consistency check: ensure server state is loaded (useful if server restarted)
    if (!serverWorldState) {
        const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
        if (fs.existsSync(intermediateSavePath)) {
            try {
                const savedState = JSON.parse(fs.readFileSync(intermediateSavePath, 'utf-8'));
                serverWorldState = savedState.worldState;
                serverPhysicalMap = savedState.physicalMap;
                serverTotalEnergyConsumed = savedState.totalEnergyConsumed || 0;
                currentStep = savedState.currentStep || 0;
                if (savedState.lastResult && (savedState.lastResult.gameOver || savedState.lastResult.failure)) {
                    isGameOver = true;
                    lastGameOverMsg = savedState.lastResult.msg || 'Game over';
                }
                writeToLogFile('[RECOVERY] Server state recovered from intermediate autosave', 'info');
            } catch (e) {
                console.error('Error recovering state:', e);
            }
        }
    }

    // Check if game is already over
    if (isGameOver) {
        return res.json({
            msg: lastGameOverMsg || 'Game over',
            worldState: serverWorldState,
            gameOver: true,
            currentStep
        });
    }

    const { on = [] } = req.body;

    // Save current state to history before making changes (for undo)
    stateHistory.push({
        worldState: JSON.parse(JSON.stringify(serverWorldState)),
        physicalMap: JSON.parse(JSON.stringify(serverPhysicalMap)),
        totalEnergyConsumed: serverTotalEnergyConsumed,
        currentStep,
        isGameOver
    });

    // Keep only last 10 states to prevent memory issues
    if (stateHistory.length > 10) {
        stateHistory.shift();
    }

    // Final safety check: if still no state, we can't proceed
    if (!serverWorldState) {
        return res.status(400).json({
            msg: 'No active simulation state found. Please generate a world first.'
        });
    }

    // 1. Apply cell states: cells in 'on' list are ON, all others are OFF
    const newLevels = serverWorldState.levels.map(level => ({
        ...level,
        cells: level.cells.map(cell => ({
            ...cell,
            active: on.includes(cell.id)
        }))
    }));

    // 2. Move Minions
    const movedMinions = serverWorldState.minions.map(m =>
        moveMinion(m, currentConfig, serverPhysicalMap, newLevels)
    );

    // 3. Evaluate Coverage
    const { minionStates, energyConsumed, failure, cellsShouldBeOn, uncoveredMinions, functionalCellIds } = evaluateCoverage(
        movedMinions,
        newLevels,
        currentConfig,
        {
            log: (m) => writeToLogFile(m, 'info'),
            warn: (m) => writeToLogFile(m, 'warn'),
            error: (m) => writeToLogFile(m, 'error')
        }
    );

    // 4. Calculate cumulative energy
    const newTotalEnergyConsumed = serverTotalEnergyConsumed + energyConsumed;
    const energyLeft = currentConfig.TOTAL_ENERGY - newTotalEnergyConsumed;

    // Determine message and failure state
    let msg;
    let logicalFailure = false;

    if (failure) {
        logicalFailure = true;
        msg = failure;
    } else if (energyLeft <= 0) {
        logicalFailure = true;
        msg = 'Out of energy';
    } else {
        msg = 'Step completed successfully';
    }

    // If failure contains cells to suggest, mark them in the world state
    if (failure && cellsShouldBeOn && cellsShouldBeOn.length > 0) {
        newLevels.forEach(level => {
            level.cells.forEach(cell => {
                if (cellsShouldBeOn.includes(cell.id)) {
                    cell.shouldBeOn = true;
                } else {
                    cell.shouldBeOn = false;
                }
            });
        });
    }

    currentStep++;

    const responseData = {
        msg,
        worldState: { levels: newLevels, minions: minionStates },
        gameOver: logicalFailure,
        uncoveredMinions: logicalFailure ? uncoveredMinions : undefined,
        currentStep,
        cellsShouldBeOn: logicalFailure ? cellsShouldBeOn : undefined,
        functionalCellIds
    };

    // Set game over flag
    if (logicalFailure) {
        isGameOver = true;
        lastGameOverMsg = msg;
    }

    // Include energy info always
    responseData.energyConsumed = energyConsumed;
    responseData.totalEnergyConsumed = newTotalEnergyConsumed;
    responseData.energyLeft = energyLeft;

    // Save step result to intermediate file
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    const fullState = {
        worldState: responseData.worldState,
        physicalMap: serverPhysicalMap,
        config: currentConfig,
        totalEnergyConsumed: newTotalEnergyConsumed,
        currentStep: currentStep,
        lastResult: {
            msg,
            failure: logicalFailure ? msg : undefined,
            energyConsumed,
            totalEnergyConsumed: newTotalEnergyConsumed,
            energyLeft,
            uncoveredMinions: logicalFailure ? uncoveredMinions : undefined,
            gameOver: logicalFailure,
            functionalCellIds
        }
    };
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));

    // Update server state
    serverWorldState = responseData.worldState;
    serverTotalEnergyConsumed = newTotalEnergyConsumed;

    res.json(responseData);
});

/**
 * @openapi
 * /api/player/get-state:
 *   get:
 *     tags: [Player]
 *     summary: Get the latest logical simulation state
 *     description: Returns the world state (minions, cells), energy metrics, and step count. Physical layer information (obstacles, transitions) is hidden from the player.
 *     responses:
 *       200:
 *         description: Current logical state
 */
app.get('/api/player/get-state', (req, res) => {
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    if (fs.existsSync(intermediateSavePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(intermediateSavePath, 'utf-8'));
            // Strip physical layer info for the player
            const playerView = {
                worldState: data.worldState,
                config: data.config,
                currentStep: data.currentStep ?? 0,
                totalEnergyConsumed: data.totalEnergyConsumed ?? 0,
                lastResult: data.lastResult
            };
            res.json(playerView);
        } catch (e) {
            res.status(500).json({ result: 'failure', msg: 'Error parsing state' });
        }
    } else {
        res.json({ worldState: null, config: currentConfig, currentStep: 0 });
    }
});

/**
 * @openapi
 * /api/restart:
 *   post:
 *     tags: [Scenario]
 *     summary: Restart the game after game over
 *     description: Resets the game over flag and generates a new world
 *     responses:
 *       200:
 *         description: Game restarted successfully
 */
app.post('/api/restart', (req, res) => {
    isGameOver = false;
    currentStep = 0;
    lastGameOverMsg = '';
    stateHistory = []; // Clear history on restart

    // Read the initial save (created at generation)
    const initialSavePath = path.join(SCENARIOS_DIR, 'map_autosave_initial.json');
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');

    if (!fs.existsSync(initialSavePath)) {
        return res.status(404).json({
            result: 'failure',
            msg: 'No saved game found to restart'
        });
    }

    const savedState = JSON.parse(fs.readFileSync(initialSavePath, 'utf-8'));

    // Reset the world state to initial positions (keep the same map)
    const { worldState, physicalMap, config: savedConfig } = savedState;

    // Update intermediate save with reset energy
    const fullState = {
        worldState,
        physicalMap,
        config: savedConfig || currentConfig,
        totalEnergyConsumed: 0,
        currentStep: 0,
        mapRadius: savedState.mapRadius,
        lastResult: null
    };
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));

    // Restore server state
    serverWorldState = worldState;
    serverPhysicalMap = physicalMap;
    serverTotalEnergyConsumed = 0;

    res.json({
        msg: 'Game restarted with current map',
        worldState,
        physicalMap,
        mapRadius: savedState.mapRadius
    });
});

/**
 * @openapi
 * /api/undo:
 *   post:
 *     tags: [Scenario]
 *     summary: Undo the last step
 *     description: Restores the previous game state from history
 *     responses:
 *       200:
 *         description: State restored successfully
 *       400:
 *         description: No history available to undo
 */
app.post('/api/undo', (req, res) => {
    if (stateHistory.length === 0) {
        return res.status(400).json({
            msg: 'No previous state to undo to'
        });
    }

    // Pop the last state from history
    const previousState = stateHistory.pop();

    // Restore the state
    isGameOver = previousState.isGameOver;
    currentStep = previousState.currentStep;
    lastGameOverMsg = isGameOver ? (previousState.lastResult?.msg || '') : '';

    const { worldState, physicalMap, totalEnergyConsumed } = previousState;

    // Update the intermediate save file
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    const fullState = {
        worldState,
        physicalMap,
        config: currentConfig,
        totalEnergyConsumed,
        currentStep,
        lastResult: null
    };
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));

    // Restore server state
    serverWorldState = worldState;
    serverPhysicalMap = physicalMap;
    serverTotalEnergyConsumed = totalEnergyConsumed;

    writeToLogFile(`[UNDO] Restored to step ${currentStep}`, 'info');

    res.json({
        msg: `Undone to step ${currentStep}`,
        worldState,
        physicalMap,
        totalEnergyConsumed,
        currentStep
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
});
