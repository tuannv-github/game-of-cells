import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CONFIG } from './src/config.js';
import { generateScenario } from './src/engine/generation.js';
import { moveMinion, evaluateCoverage } from './src/engine/simulation.js';
import { initDb, getDb } from './server/db.js';
import { login, register, createToken, verifyToken } from './server/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 40001;

// Configuration
const LOG_DIR = path.resolve(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const SCENARIOS_DIR = path.resolve(__dirname, 'scenarios');
const SCENARIOS_ADMIN_DIR = path.resolve(__dirname, 'scenarios_admin');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCENARIOS_DIR)) fs.mkdirSync(SCENARIOS_DIR, { recursive: true });
if (!fs.existsSync(SCENARIOS_ADMIN_DIR)) fs.mkdirSync(SCENARIOS_ADMIN_DIR, { recursive: true });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

/** Extract Bearer token from Authorization header */
const getAuthUser = (req) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return verifyToken(auth.slice(7));
};

/** Require admin role for scenario generation */
const requireAdmin = (req, res, next) => {
    const payload = getAuthUser(req);
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
};

/** Require any authenticated user */
const requireAuth = (req, res, next) => {
    const payload = getAuthUser(req);
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    req.authUser = payload;
    next();
};

/** Sanitize username for use in filesystem paths */
const sanitizePlayerDir = (username) => String(username || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');

/** Ensure player has a scenario dir and initial.json (copy from easy if new user) */
const ensurePlayerScenario = (username) => {
    const dir = path.join(SCENARIOS_DIR, sanitizePlayerDir(username));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const initialPath = path.join(dir, 'initial.json');
    if (!fs.existsSync(initialPath)) {
        const easyPath = path.join(SCENARIOS_ADMIN_DIR, 'easy.json');
        if (fs.existsSync(easyPath)) {
            fs.copyFileSync(easyPath, initialPath);
            writeToLogFile(`[INIT] New player ${username}: copied easy.json to ${dir}/initial.json`, 'info');
        }
    }
    return dir;
};

/** Perform restart from a given load path (initial.json or global). Saves to step_0 for authenticated users. */
const performRestart = (loadPath, req) => {
    const savedState = JSON.parse(fs.readFileSync(loadPath, 'utf-8'));
    const scenarioState = savedState.scenarioState ?? savedState.worldState;
    const { physicalMap, config: savedConfig } = savedState;
    const fullState = {
        scenarioState,
        physicalMap,
        config: savedConfig || currentConfig,
        totalEnergyConsumed: 0,
        currentStep: 0,
        mapRadius: savedState.mapRadius,
        lastResult: null
    };
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));
    const user = getAuthUser(req);
    if (user) {
        const stepsDir = path.join(getPlayerScenariosDir(user.username), 'steps');
        if (!fs.existsSync(stepsDir)) fs.mkdirSync(stepsDir, { recursive: true });
        // Clear existing steps before copying initial to step_0
        const existing = fs.readdirSync(stepsDir);
        writeToLogFile(`[RESTART] Clearing ${existing.length} step(s) for ${user.username}`, 'info');
        for (const f of existing) {
            fs.unlinkSync(path.join(stepsDir, f));
        }
        writeToLogFile(`[RESTART] Copying initial to step_0.json for ${user.username}`, 'info');
        fs.writeFileSync(path.join(stepsDir, 'step_0.json'), JSON.stringify(fullState, null, 2));
    }
    isGameOver = false;
    currentStep = 0;
    lastGameOverMsg = '';
    currentConfig = { ...currentConfig, ...savedConfig };
    serverScenarioState = scenarioState;
    serverPhysicalMap = physicalMap;
    serverTotalEnergyConsumed = 0;
    return { scenarioState, physicalMap, mapRadius: savedState.mapRadius };
};

/** Get latest step file path in player dir, or null if none */
const getLatestStepPath = (playerDir) => {
    const stepsDir = path.join(playerDir, 'steps');
    if (!fs.existsSync(stepsDir)) return null;
    const files = fs.readdirSync(stepsDir).filter(f => /^step_\d+\.json$/.test(f));
    if (files.length === 0) return null;
    const nums = files.map(f => parseInt(f.replace('step_', '').replace('.json', ''), 10));
    const max = Math.max(...nums);
    return path.join(stepsDir, `step_${max}.json`);
};

/** Get per-player scenarios directory path (ensures dir and initial.json exist for new users) */
const getPlayerScenariosDir = (username) => ensurePlayerScenario(username);

// Game state
let currentConfig = { ...DEFAULT_CONFIG };
let isGameOver = false;
let currentStep = 0;
let lastCellsShouldBeOn = [];
let lastGameOverMsg = '';

// Server-side state management
let serverScenarioState = null;
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

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        const user = login(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = createToken(user);
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error('[AUTH] Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        if (username.length < 2 || password.length < 4) {
            return res.status(400).json({ error: 'Username min 2 chars, password min 4 chars' });
        }
        const user = register(username, password);
        if (!user) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        const token = createToken(user);
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error('[AUTH] Register error:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
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

app.post('/api/config', requireAdmin, (req, res) => {
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
app.get('/api/maps', requireAuth, (req, res) => {
    const playerDir = getPlayerScenariosDir(req.authUser.username);
    const files = [];
    if (fs.existsSync(playerDir)) {
        const root = fs.readdirSync(playerDir).filter(f => f.endsWith('.json') && f !== 'current.json');
        files.push(...root);
        const stepsDir = path.join(playerDir, 'steps');
        if (fs.existsSync(stepsDir)) {
            files.push(...fs.readdirSync(stepsDir).filter(f => f.endsWith('.json')));
        }
    }
    res.json(files);
});

app.post('/api/maps', (req, res) => {
    const { name, data } = req.body;
    const filename = name || `scenario_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const user = getAuthUser(req);

    // Admin saving difficulty presets (easy/medium/hard) -> scenarios_admin
    const difficultyPresets = ['easy.json', 'medium.json', 'hard.json'];
    if (difficultyPresets.includes(filename) && user?.role === 'admin') {
        const filePath = path.join(SCENARIOS_ADMIN_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return res.json({ success: true, filename });
    }

    // Player save -> per-player dir (steps only, no current)
    if (!user) return res.status(401).json({ error: 'Authentication required to save scenarios' });
    const playerDir = getPlayerScenariosDir(user.username);
    const stepsDir = path.join(playerDir, 'steps');
    if (!fs.existsSync(stepsDir)) fs.mkdirSync(stepsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const saveName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const finalName = saveName && !difficultyPresets.includes(saveName) ? saveName : `manual_${ts}.json`;
    fs.writeFileSync(path.join(stepsDir, finalName), JSON.stringify(data, null, 2));
    res.json({ success: true, filename: finalName });
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
app.get('/api/maps/:name', requireAuth, (req, res) => {
    const playerDir = getPlayerScenariosDir(req.authUser.username);
    const name = req.params.name;
    let filePath = path.join(playerDir, name);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(playerDir, 'steps', name);
    }
    if (fs.existsSync(filePath)) {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } else {
        res.status(404).send('Not found');
    }
});

app.delete('/api/maps/:name', requireAuth, (req, res) => {
    const playerDir = getPlayerScenariosDir(req.authUser.username);
    const name = req.params.name;
    let filePath = path.join(playerDir, name);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(playerDir, 'steps', name);
    }
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
 *     summary: Generate a new scenario (admin only). Config optional in body.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 description: Scenario generation config (includes difficulty when preset selected)
 *     responses:
 *       200:
 *         description: New scenario state
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin only
 */
app.post('/api/generate', requireAdmin, (req, res) => {
    const configToUse = req.body?.config ? { ...currentConfig, ...req.body.config } : currentConfig;
    currentConfig = configToUse;
    const result = generateScenario(configToUse, null, true, {
        log: (m) => writeToLogFile(m, 'info'),
        warn: (m) => writeToLogFile(m, 'warn'),
        error: (m) => writeToLogFile(m, 'error')
    });
    isGameOver = false;
    currentStep = 0;
    lastGameOverMsg = '';
    // Initialize server state
    serverScenarioState = result.scenarioState;
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
 *                 scenarioState:
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
    if (!serverScenarioState) {
        const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
        if (fs.existsSync(intermediateSavePath)) {
            try {
                const savedState = JSON.parse(fs.readFileSync(intermediateSavePath, 'utf-8'));
                serverScenarioState = savedState.scenarioState ?? savedState.worldState;
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
            scenarioState: serverScenarioState,
            gameOver: true,
            currentStep
        });
    }

    const { on = [] } = req.body;

    // Final safety check: if still no state, we can't proceed
    if (!serverScenarioState) {
        return res.status(400).json({
            msg: 'No active simulation state found. Please generate a scenario first.'
        });
    }

    // 1. Apply cell states: cells in 'on' list are ON, all others are OFF
    const newLevels = serverScenarioState.levels.map(level => ({
        ...level,
        cells: level.cells.map(cell => ({
            ...cell,
            active: on.includes(cell.id)
        }))
    }));

    // 2. Move Minions
    const movedMinions = serverScenarioState.minions.map(m =>
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

    // If failure contains cells to suggest, mark them in the scenario state
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
        scenarioState: { levels: newLevels, minions: minionStates },
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
        scenarioState: responseData.scenarioState,
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

    // Save to player dir (step_N only, no current) when authenticated
    const stepUser = getAuthUser(req);
    if (stepUser) {
        const playerDir = ensurePlayerScenario(stepUser.username);
        const stepsDir = path.join(playerDir, 'steps');
        if (!fs.existsSync(stepsDir)) fs.mkdirSync(stepsDir, { recursive: true });
        fs.writeFileSync(path.join(stepsDir, `step_${currentStep}.json`), JSON.stringify(fullState, null, 2));
        const currentPath = path.join(playerDir, 'current.json');
        if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
        if (currentStep === 1) {
            const step0Path = path.join(stepsDir, 'step_0.json');
            const initialPath = path.join(playerDir, 'initial.json');
            if (fs.existsSync(step0Path) && !fs.existsSync(initialPath)) {
                fs.copyFileSync(step0Path, initialPath);
                writeToLogFile(`[STEP] Copied step_0 to initial.json for ${stepUser.username}`, 'info');
            }
        }
    }

    // Update server state
    serverScenarioState = responseData.scenarioState;
    serverTotalEnergyConsumed = newTotalEnergyConsumed;

    res.json(responseData);
});

/**
 * @openapi
 * /api/player/get-state:
 *   get:
 *     tags: [Player]
 *     summary: Get the latest logical simulation state
 *     description: Returns the scenario state (minions, cells), energy metrics, and step count. Physical layer information (obstacles, transitions) is hidden from the player.
 *     responses:
 *       200:
 *         description: Current logical state
 */
app.get('/api/player/get-state', (req, res) => {
    let loadPath = null;
    const user = getAuthUser(req);
    if (user) {
        const playerDir = getPlayerScenariosDir(user.username);
        loadPath = getLatestStepPath(playerDir);
        if (!loadPath && fs.existsSync(path.join(playerDir, 'initial.json'))) {
            loadPath = path.join(playerDir, 'initial.json');
        }
    }
    if (!loadPath) {
        loadPath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    }
    if (fs.existsSync(loadPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(loadPath, 'utf-8'));
            const playerView = {
                scenarioState: data.scenarioState ?? data.worldState,
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
        res.json({ scenarioState: null, config: currentConfig, currentStep: 0 });
    }
});

/**
 * @openapi
 * /api/player/change-difficulty:
 *   post:
 *     tags: [Player]
 *     summary: Change difficulty (load easy, medium, or hard scenario)
 *     description: Loads the scenario from scenarios_admin and resets the game, like restart but with a different difficulty.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [difficulty]
 *             properties:
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *     responses:
 *       200:
 *         description: Difficulty changed, new state returned
 *       404:
 *         description: Scenario not found for that difficulty
 */
app.post('/api/player/change-difficulty', (req, res) => {
    const { difficulty } = req.body || {};
    const user = getAuthUser(req);
    writeToLogFile(`[CHANGE-DIFFICULTY] Request: difficulty=${difficulty}, user=${user?.username ?? 'anonymous'}`, 'info');

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        writeToLogFile(`[CHANGE-DIFFICULTY] Rejected: invalid difficulty`, 'warn');
        return res.status(400).json({ error: 'difficulty must be easy, medium, or hard' });
    }
    const filename = `${difficulty}.json`;
    const filePath = path.join(SCENARIOS_ADMIN_DIR, filename);
    if (!fs.existsSync(filePath)) {
        writeToLogFile(`[CHANGE-DIFFICULTY] Rejected: ${filename} not found in scenarios_admin`, 'warn');
        return res.status(404).json({ error: `No scenario found for ${difficulty}. Admin must save one first.` });
    }
    writeToLogFile(`[CHANGE-DIFFICULTY] Loading from ${filePath}`, 'info');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const scenarioState = data.scenarioState ?? data.worldState;
    const physicalMap = data.physicalMap;
    const config = data.config || currentConfig;
    if (!scenarioState || !physicalMap) {
        writeToLogFile(`[CHANGE-DIFFICULTY] Rejected: invalid scenario (missing scenarioState or physicalMap)`, 'warn');
        return res.status(400).json({ error: 'Invalid scenario file' });
    }
    writeToLogFile(`[CHANGE-DIFFICULTY] Loaded: ${scenarioState.levels?.length ?? 0} levels, ${scenarioState.minions?.length ?? 0} minions`, 'info');
    let mapRadius = data.mapRadius;
    if (mapRadius == null && config) {
        const numCoverage = Math.max(0, config.COVERAGE_CELL_RADIUS > 0 ? config.COVERAGE_CELLS_COUNT : 0);
        const totalCoverageArea = numCoverage * Math.PI * Math.pow(config.COVERAGE_CELL_RADIUS || 50, 2);
        mapRadius = Math.max(80, Math.sqrt(totalCoverageArea / Math.PI) * 1.2);
    }
    mapRadius = mapRadius || 80;
    const fullState = {
        scenarioState,
        physicalMap,
        config,
        totalEnergyConsumed: 0,
        currentStep: 0,
        mapRadius,
        lastResult: null
    };

    // 1. Copy difficulty to initial.json only
    let restartLoadPath = null;
    if (user) {
        const playerDir = ensurePlayerScenario(user.username);
        const initialPath = path.join(playerDir, 'initial.json');
        fs.writeFileSync(initialPath, JSON.stringify(fullState, null, 2));
        restartLoadPath = initialPath;
        writeToLogFile(`[CHANGE-DIFFICULTY] Copied ${difficulty} to initial.json for ${user.username}`, 'info');
    } else {
        writeToLogFile(`[CHANGE-DIFFICULTY] No auth: saving to global only`, 'info');
        const initialSavePath = path.join(SCENARIOS_DIR, 'map_autosave_initial.json');
        fs.writeFileSync(initialSavePath, JSON.stringify(fullState, null, 2));
        restartLoadPath = initialSavePath;
    }

    // 2. Call restart: copy initial to step_0, update server state (get-state will read from step_0)
    writeToLogFile(`[CHANGE-DIFFICULTY] Calling restart from ${restartLoadPath}`, 'info');
    const result = performRestart(restartLoadPath, req);

    writeToLogFile(`[CHANGE-DIFFICULTY] Complete: ${difficulty}, step=0, user=${user?.username ?? 'anonymous'}`, 'info');

    res.json({
        msg: `Loaded ${difficulty} scenario`,
        scenarioState: result.scenarioState,
        physicalMap: result.physicalMap,
        mapRadius: result.mapRadius,
        config: currentConfig
    });
});

/**
 * @openapi
 * /api/player/init:
 *   post:
 *     tags: [Player]
 *     summary: Initialize player scenario (create dir, copy easy if new user, load into server)
 *     description: On new user login, ensures player dir exists, copies easy.json if needed, loads scenario into server state.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scenario loaded and ready to play
 *       401:
 *         description: Authentication required
 */
app.post('/api/player/init', requireAuth, (req, res) => {
    const playerDir = ensurePlayerScenario(req.authUser.username);
    const currentPath = path.join(playerDir, 'current.json');
    if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath); // Remove current (use steps only)

    // Load latest step if exists, else initial.json
    const latestStepPath = getLatestStepPath(playerDir);
    const loadPath = latestStepPath || path.join(playerDir, 'initial.json');
    if (!fs.existsSync(loadPath)) {
        return res.status(404).json({ error: 'No scenario found. Admin must save easy.json first.' });
    }
    const data = JSON.parse(fs.readFileSync(loadPath, 'utf-8'));
    const scenarioState = data.scenarioState ?? data.worldState;
    const physicalMap = data.physicalMap;
    const config = data.config || currentConfig;
    if (!scenarioState || !physicalMap) {
        return res.status(400).json({ error: 'Invalid scenario file' });
    }
    const loadedStep = data.currentStep ?? 0;
    isGameOver = !!(data.lastResult?.gameOver || data.lastResult?.failure);
    lastGameOverMsg = data.lastResult?.msg || '';
    currentConfig = { ...currentConfig, ...config };
    serverScenarioState = scenarioState;
    serverPhysicalMap = physicalMap;
    serverTotalEnergyConsumed = data.totalEnergyConsumed ?? 0;
    currentStep = loadedStep;
    const initialSavePath = path.join(SCENARIOS_DIR, 'map_autosave_initial.json');
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    let mapRadius = data.mapRadius;
    if (mapRadius == null && config) {
        const numCoverage = Math.max(0, config.COVERAGE_CELL_RADIUS > 0 ? config.COVERAGE_CELLS_COUNT : 0);
        const totalCoverageArea = numCoverage * Math.PI * Math.pow(config.COVERAGE_CELL_RADIUS || 50, 2);
        mapRadius = Math.max(80, Math.sqrt(totalCoverageArea / Math.PI) * 1.2);
    }
    mapRadius = mapRadius || 80;
    const fullState = {
        scenarioState,
        physicalMap,
        config,
        totalEnergyConsumed: data.totalEnergyConsumed ?? 0,
        currentStep: loadedStep,
        mapRadius,
        lastResult: data.lastResult ?? null
    };
    fs.writeFileSync(initialSavePath, JSON.stringify(fullState, null, 2));
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));

    res.json({
        msg: 'Scenario initialized',
        scenarioState,
        physicalMap,
        mapRadius,
        config,
        currentStep: loadedStep,
        totalEnergyConsumed: data.totalEnergyConsumed ?? 0
    });
});

/**
 * @openapi
 * /api/restart:
 *   post:
 *     tags: [Scenario]
 *     summary: Restart the game after game over
 *     description: Resets the game over flag and restores the initial scenario
 *     responses:
 *       200:
 *         description: Game restarted successfully
 */
app.post('/api/restart', (req, res) => {
    let loadPath = null;
    const user = getAuthUser(req);
    if (user) {
        const playerDir = getPlayerScenariosDir(user.username);
        const playerInitial = path.join(playerDir, 'initial.json');
        if (fs.existsSync(playerInitial)) loadPath = playerInitial;
    }
    if (!loadPath) {
        loadPath = path.join(SCENARIOS_DIR, 'map_autosave_initial.json');
    }
    if (!fs.existsSync(loadPath)) {
        return res.status(404).json({
            result: 'failure',
            msg: 'No saved game found to restart'
        });
    }

    writeToLogFile(`[RESTART] Loading from ${loadPath}, user=${user?.username ?? 'anonymous'}`, 'info');
    const result = performRestart(loadPath, req);
    writeToLogFile(`[RESTART] Complete: copied initial to step_0`, 'info');

    res.json({
        msg: 'Game restarted with current map',
        scenarioState: result.scenarioState,
        physicalMap: result.physicalMap,
        mapRadius: result.mapRadius
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
    const user = getAuthUser(req);
    if (!user) {
        return res.status(401).json({ msg: 'Authentication required for undo' });
    }
    if (currentStep === 0) {
        return res.status(400).json({
            msg: 'No previous state to undo to'
        });
    }

    const stepsDir = path.join(getPlayerScenariosDir(user.username), 'steps');
    const prevStepPath = path.join(stepsDir, `step_${currentStep - 1}.json`);
    if (!fs.existsSync(prevStepPath)) {
        return res.status(400).json({
            msg: 'No previous step file found to undo to'
        });
    }

    // Remove latest step file (the one we're undoing from)
    const latestToRemove = path.join(stepsDir, `step_${currentStep}.json`);
    if (fs.existsSync(latestToRemove)) {
        fs.unlinkSync(latestToRemove);
        writeToLogFile(`[UNDO] Removed step_${currentStep}.json for ${user.username}`, 'info');
    }

    // Load previous state from file
    const previousState = JSON.parse(fs.readFileSync(prevStepPath, 'utf-8'));
    const scenarioState = previousState.scenarioState ?? previousState.worldState;
    const { physicalMap, totalEnergyConsumed, mapRadius } = previousState;
    isGameOver = !!(previousState.lastResult?.gameOver || previousState.lastResult?.failure);
    lastGameOverMsg = previousState.lastResult?.msg || '';
    currentStep = previousState.currentStep ?? (currentStep - 1);

    // Update the intermediate save file
    const intermediateSavePath = path.join(SCENARIOS_DIR, 'map_autosave_intermediate.json');
    const fullState = {
        scenarioState,
        physicalMap,
        config: currentConfig,
        totalEnergyConsumed,
        currentStep,
        lastResult: null
    };
    fs.writeFileSync(intermediateSavePath, JSON.stringify(fullState, null, 2));

    // Restore server state
    serverScenarioState = scenarioState;
    serverPhysicalMap = physicalMap;
    serverTotalEnergyConsumed = totalEnergyConsumed;

    writeToLogFile(`[UNDO] Restored to step ${currentStep}`, 'info');

    res.json({
        msg: `Undone to step ${currentStep}`,
        scenarioState,
        physicalMap,
        mapRadius,
        totalEnergyConsumed,
        currentStep
    });
});

try {
    initDb();
    console.log('[DB] Database initialized');
} catch (err) {
    console.error('[DB] Failed to initialize:', err.message);
}
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
});
