import { MINION_TYPES } from '../config';
import { remoteLog } from '../utils/logger';

// Helper for random movement within constraints
export const moveMinion = (minion, config, physicalMap) => {
    const { type, x, z, level } = minion;
    const maxMove = config[type.toUpperCase()].MAX_MOVE;

    // Random angle and distance
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * maxMove;

    let newX = x + Math.cos(angle) * dist;
    let newZ = z + Math.sin(angle) * dist;
    let newLevel = level;

    // Level transition logic
    // 1. Drones: Fly freely between levels
    if (type === MINION_TYPES.DRONE) {
        if (Math.random() < 0.05) {
            newLevel = (level + 1) % config.MAP_LEVELS;
        }
    }
    // 2. Walkers (Human, Humanoid, Dog): Use transition zones
    else if (['HUMAN', 'HUMANOID', 'DOG_ROBOT'].includes(type)) {
        const currentLevelData = physicalMap?.levels?.find(l => l.id === level);
        if (currentLevelData) {
            const zones = currentLevelData.transition_zones ?? currentLevelData.transition_areas?.map(a => ({ x: a.center?.x ?? a.x, z: a.center?.z ?? a.z, radius: a.radius ?? a.r ?? 0, targetLevel: a.target_level ?? a.targetLevel }));
            if (zones) {
                for (const zone of zones) {
                    const zx = zone.x ?? 0;
                    const zz = zone.z ?? 0;
                    const zr = zone.radius ?? 0;
                    const dx = newX - zx;
                    const dz = newZ - zz;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist < zr) {
                        // Inside a zone! Chance to warp.
                        if (Math.random() < 0.10) {
                            if (zone.targetLevel !== undefined) {
                                newLevel = zone.targetLevel;
                            } else {
                                newLevel = (level + 1) % config.MAP_LEVELS;
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    // Constraint: Valid Move Check (Must be in coverage)
    // We need to check if the NEW position at NEW level is covered.
    // If not, we cancel the move and stay put.
    let isValidMove = false;
    const targetLevelData = physicalMap?.levels?.find(l => l.id === newLevel);

    // Check against Type-Specific Exclusion Zones (Physical Layer 2.0)
    if (targetLevelData && targetLevelData.type_exclusion_zones) {
        const typeKey = type.toUpperCase();
        const exclusionList = targetLevelData.type_exclusion_zones[typeKey] || targetLevelData.type_exclusion_zones[type] || [];
        const minionSize = config[typeKey]?.SIZE || 1.0;
        const mHalf = minionSize / 2;

        if (exclusionList) {
            for (const zone of exclusionList) {
                // Square collision check (Axis-Aligned) with padding for minion size
                const halfSize = zone.size / 2;
                if (Math.abs(newX - zone.x) < (halfSize + mHalf) &&
                    Math.abs(newZ - zone.z) < (halfSize + mHalf)) {
                    // Minion would collide with a restricted zone for its type!
                    return { ...minion }; // Revert move immediately
                }
            }
        }
    }

    // Note: To properly check coverage we ideally need access to dynamic cell state (active/inactive),
    // but here we only have physicalMap (static layout) + config.
    // Assuming for movement logic we care about the "potential" coverage layout,
    // or we assume all cells are active for movement constraints, OR we need active cells passed in.
    // Current signature: (minion, config, physicalMap)
    // We will check against physicalMap.cells which contains the layout.

    if (targetLevelData && targetLevelData.cells) {
        for (const cell of targetLevelData.cells) {
            const dx = newX - cell.x;
            const dz = newZ - cell.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Allow movement into Capacity or Coverage zones
            // Using straight distance for movement constraint smoothing
            const radius = (cell.type === 'coverage' ? config.COVERAGE_CELL_RADIUS : config.CAPACITY_CELL_RADIUS);

            if (dist <= radius) {
                isValidMove = true;
                break;
            }
        }
    }

    // fallback for empty map or no cells: stay in bounds if no cells constraint
    if (!targetLevelData || targetLevelData.cells.length === 0) isValidMove = true;

    if (!isValidMove) {
        // Reject move
        return { ...minion };
    }

    // Obstacle/Boundary Check (Simple box for now) - Redundant if coverage check passes, but good safety
    const mapSize = 100; // Increased safety bound
    if (Math.abs(newX) > mapSize) newX = x;
    if (Math.abs(newZ) > mapSize) newZ = z;

    return { ...minion, x: newX, z: newZ, level: newLevel };
};

export const evaluateCoverage = (minions, levels, config) => {
    let energyConsumed = 0;
    let failure = null;

    // Count active cells for energy cost
    levels.forEach(l => {
        l.cells.forEach(c => {
            if (c.active) energyConsumed += config.MINION_ENERGY_COST;
        });
    });

    // 1. Identify "Backhauled" Capacity Cells
    // Aggregate ALL active coverage cells from ALL levels for global backhaul availability
    const allActiveCoverage = [];
    levels.forEach(l => {
        allActiveCoverage.push(...l.cells.filter(c => c.active && c.type === 'coverage'));
    });

    const functionalCapacityCells = [];
    levels.forEach(l => {
        const activeCapacity = l.cells.filter(c => c.active && c.type === 'capacity');

        activeCapacity.forEach(cap => {
            const isBackhauled = allActiveCoverage.some(cov => {
                const dx = cap.x - cov.x;
                const dz = cap.z - cov.z;
                // Backhaul check uses 2D projection distance (ignoring vertical gap)
                const dist = Math.sqrt(dx * dx + dz * dz);
                return dist < config.COVERAGE_CELL_RADIUS;
            });
            if (isBackhauled) functionalCapacityCells.push(cap);
        });
    });

    remoteLog(`[SIM] Global Backhaul: ${functionalCapacityCells.length} Capacity cells active and backhauled.`);

    // 2. Check each minion's coverage
    const minionStates = minions.map(m => {
        const level = levels.find(l => l.id === m.level);
        if (!level) return { ...m, covered: false };

        const activeCoverage = level.cells.filter(c => c.active && c.type === 'coverage');

        // A minion is covered if it's within range of:
        // - An active Coverage cell
        // - A functional (backhauled) active Capacity cell
        const providers = [...activeCoverage, ...functionalCapacityCells.filter(c => c.level === m.level)];

        const coveringCells = providers.filter(c => {
            const dx = m.x - c.x;
            const dz = m.z - c.z;
            const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;

            // Hexagonal In-Bounds Check (Pointy-Top)
            // A point is inside a pointy-top hexagon if:
            // 1. |z| < radius
            // 2. sqrt(3)/2 * |x| + 0.5 * |z| < radius
            const qx = Math.abs(dx);
            const qz = Math.abs(dz);

            // Adjust factor because radius in Three.js is corner-to-center
            const innerRadius = radius * (Math.sqrt(3) / 2); // Distance to edge

            // Simpler check for hex bounds
            const diag = (Math.sqrt(3) / 2) * qx + 0.5 * qz;
            return qz < radius && diag < radius;
        });

        const isCovered = coveringCells.length > 0;
        if (!isCovered) {
            failure = `Minion ${m.id} lost service!`;
        }

        return { ...m, covered: isCovered };
    });

    const coveredMinions = minionStates.filter(m => m.covered).length;
    remoteLog(`[SIM] Coverage: ${coveredMinions}/${minions.length} minions currently served.`);

    return { minionStates, energyConsumed, failure };
};
