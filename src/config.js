/** Deep merge for difficulty presets */
const deepMerge = (base, overrides) => {
    const out = { ...base };
    for (const k of Object.keys(overrides)) {
        if (overrides[k] && typeof overrides[k] === 'object' && !Array.isArray(overrides[k]) && overrides[k].constructor === Object) {
            out[k] = deepMerge(base[k] || {}, overrides[k]);
        } else {
            out[k] = overrides[k];
        }
    }
    return out;
};

export const DEFAULT_CONFIG = {
    // Global Settings
    TARGET_STEPS: 100,
    MINION_ENERGY_COST: 1.0,
    TOTAL_ENERGY: 1000,
    MAP_LEVELS: 2,
    COVERAGE_CELLS_COUNT: 7,
    CAPACITY_CELLS_COUNT: 37,

    // Infrastructure Parameters
    COVERAGE_LIMIT_MBPS: 100,
    CAPACITY_CELL_RADIUS: 20.0,
    COVERAGE_CELL_RADIUS: 50.0,
    LEVEL_DISTANCE: 20.0,
    PORTAL_PAIR_COUNT: 3,
    PORTAL_AREA: 300,
    TOTAL_OBSTACLE_AREA_PER_LEVEL: 40,
    LAYER_OFFSETS: {
        background: {
            offset: -0.1,
            sublayers: {
                wire: -0.01
            }
        },
        label: { offset: 0 },
        coverage: { offset: 0 },
        capacity: { offset: 0.5 },
        physical: {
            offset: 1.0,
            sublayers: {
                portal: 0.02,
                portalLabel: 1.0,
                HUMAN: 0.2,
                HUMANOID: 0.4,
                DOG_ROBOT: 0.6,
                TURTLE_BOT: 0.8,
                DRONE: 1.0
            }
        },
        minion: { offset: 3.0 }
    },

    // Minion Parameters
    HUMAN: {
        ENABLED: true,
        COUNT: 5,
        MAX_MOVE: 6.0,
        REQ_THROUGHPUT: 5,
        COLOR: '#ffffff',
        SIZE: 2.5
    },
    HUMANOID: {
        ENABLED: true,
        COUNT: 3,
        MAX_MOVE: 8.0,
        REQ_THROUGHPUT: 10,
        COLOR: '#ffcc00',
        SIZE: 2.5
    },
    DOG_ROBOT: {
        ENABLED: true,
        COUNT: 2,
        MAX_MOVE: 20.0,
        REQ_THROUGHPUT: 15,
        COLOR: '#3366ff',
        SIZE: 2.5
    },
    TURTLE_BOT: {
        ENABLED: true,
        COUNT: 2,
        MAX_MOVE: 4.0,
        REQ_THROUGHPUT: 2,
        COLOR: '#00ff66',
        SIZE: 2.5
    },
    DRONE: {
        ENABLED: true,
        COUNT: 1,
        MAX_MOVE: 40.0,
        REQ_THROUGHPUT: 20,
        COLOR: '#9933ff',
        SIZE: 2.5
    }
};

/** Easy = copy of current scenario */
const EASY_CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

/** Medium = harder: less energy, more obstacles, more minions */
const MEDIUM_CONFIG = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), {
    TOTAL_ENERGY: 700,
    TOTAL_OBSTACLE_AREA_PER_LEVEL: 50,
    HUMAN: { ...DEFAULT_CONFIG.HUMAN, COUNT: 6 },
    HUMANOID: { ...DEFAULT_CONFIG.HUMANOID, COUNT: 4 },
    DOG_ROBOT: { ...DEFAULT_CONFIG.DOG_ROBOT, COUNT: 3 }
});

/** Hard = hardest: even less energy, more obstacles, more minions, more levels */
const HARD_CONFIG = deepMerge(JSON.parse(JSON.stringify(MEDIUM_CONFIG)), {
    TOTAL_ENERGY: 500,
    TOTAL_OBSTACLE_AREA_PER_LEVEL: 60,
    MAP_LEVELS: 3,
    HUMAN: { ...MEDIUM_CONFIG.HUMAN, COUNT: 7 },
    HUMANOID: { ...MEDIUM_CONFIG.HUMANOID, COUNT: 5 },
    DOG_ROBOT: { ...MEDIUM_CONFIG.DOG_ROBOT, COUNT: 4 },
    TURTLE_BOT: { ...MEDIUM_CONFIG.TURTLE_BOT, COUNT: 3 },
    DRONE: { ...MEDIUM_CONFIG.DRONE, COUNT: 2 }
});

export const DIFFICULTY_PRESETS = {
    easy: { label: 'Easy', config: EASY_CONFIG },
    medium: { label: 'Medium', config: MEDIUM_CONFIG },
    hard: { label: 'Hard', config: HARD_CONFIG }
};

/** Keys used for scenario generation (sent to /api/generate). Excludes viewing-only keys like LAYER_OFFSETS. */
export const GENERATION_CONFIG_KEYS = [
    'TARGET_STEPS', 'MINION_ENERGY_COST', 'TOTAL_ENERGY', 'MAP_LEVELS',
    'COVERAGE_CELLS_COUNT', 'CAPACITY_CELLS_COUNT', 'COVERAGE_LIMIT_MBPS',
    'COVERAGE_CELL_RADIUS', 'CAPACITY_CELL_RADIUS', 'LEVEL_DISTANCE',
    'PORTAL_PAIR_COUNT', 'PORTAL_AREA', 'TOTAL_OBSTACLE_AREA_PER_LEVEL',
    'HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'
];

/** Extract only scenario generation config from full config (for API / persistence). */
export const getGenerationConfig = (config) => {
    const out = {};
    for (const k of GENERATION_CONFIG_KEYS) {
        if (config[k] !== undefined) out[k] = config[k];
    }
    return out;
};

export const CELL_TYPES = {
    COVERAGE: 'coverage',
    CAPACITY: 'capacity'
};

export const MINION_TYPES = {
    HUMAN: 'human',
    HUMANOID: 'humanoid',
    DOG_ROBOT: 'dog_robot',
    TURTLE_BOT: 'turtle_bot',
    DRONE: 'drone'
};
