export const DEFAULT_CONFIG = {
    // Global Settings
    TARGET_STEPS: 100,
    MINION_ENERGY_COST: 1.0,
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
        MAX_MOVE: 1.5,
        REQ_THROUGHPUT: 5,
        COLOR: '#ffffff',
        SIZE: 2.5
    },
    HUMANOID: {
        ENABLED: true,
        COUNT: 3,
        MAX_MOVE: 2.0,
        REQ_THROUGHPUT: 10,
        COLOR: '#ffcc00',
        SIZE: 2.5
    },
    DOG_ROBOT: {
        ENABLED: true,
        COUNT: 2,
        MAX_MOVE: 5.0,
        REQ_THROUGHPUT: 15,
        COLOR: '#ff0066',
        SIZE: 2.5
    },
    TURTLE_BOT: {
        ENABLED: true,
        COUNT: 2,
        MAX_MOVE: 1.0,
        REQ_THROUGHPUT: 2,
        COLOR: '#00ff66',
        SIZE: 2.5
    },
    DRONE: {
        ENABLED: true,
        COUNT: 1,
        MAX_MOVE: 10.0,
        REQ_THROUGHPUT: 20,
        COLOR: '#9933ff',
        SIZE: 2.5
    }
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
