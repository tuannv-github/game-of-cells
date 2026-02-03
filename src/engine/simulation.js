import { MINION_TYPES } from '../config.js';
import { remoteLog } from '../utils/logger.js';

// Helper for random movement within constraints
// Helper for random movement within constraints
export const moveMinion = (minion, config, physicalMap, activeLevels = null) => {
    const { type, x, z, level } = minion;
    const maxMove = config[type.toUpperCase()].MAX_MOVE;
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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
                        const d = Math.sqrt(dx * dx + dz * dz);

                        if (d < zr) {
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

        let isMoveValid = true;
        const targetLevelData = physicalMap?.levels?.find(l => l.id === newLevel);

        // 1. Check Exclusion Zones
        if (targetLevelData && targetLevelData.type_exclusion_zones) {
            const typeKey = type.toUpperCase();
            const exclusionList = targetLevelData.type_exclusion_zones[typeKey] || targetLevelData.type_exclusion_zones[type] || [];
            const minionSize = config[typeKey]?.SIZE || 1.0;
            const mHalf = minionSize / 2;

            if (exclusionList) {
                for (const zone of exclusionList) {
                    const halfSize = zone.size / 2;
                    if (Math.abs(newX - zone.x) < (halfSize + mHalf) &&
                        Math.abs(newZ - zone.z) < (halfSize + mHalf)) {
                        isMoveValid = false;
                        break;
                    }
                }
            }
        }

        if (!isMoveValid) continue;

        // 2. Check Coverage
        // Use activeLevels if provided to check active status
        const checkingActive = !!activeLevels;
        const levelCells = checkingActive
            ? activeLevels.find(l => l.id === newLevel)?.cells
            : targetLevelData?.cells;

        if (levelCells && levelCells.length > 0) {
            let isCovered = false;
            for (const cell of levelCells) {
                const dx = newX - cell.x;
                const dz = newZ - cell.z;
                const radius = (cell.type === 'coverage' ? config.COVERAGE_CELL_RADIUS : config.CAPACITY_CELL_RADIUS);
                // Hexagonal Check logic matching evaluateCoverage
                const qx = Math.abs(dx);
                const qz = Math.abs(dz);
                const diag = (Math.sqrt(3) / 2) * qx + 0.5 * qz;

                if (qz < radius && diag < radius && qx < radius * (Math.sqrt(3) / 2)) {
                    // Per user request: Any cell is OK (active or inactive)
                    isCovered = true;
                    break;
                }
            }
            if (!isCovered) isMoveValid = false;
        } else {
            // If no cells exist at all on level, does it count as valid?
            // Usually implies failure if constraints are strict
            if (activeLevels || (targetLevelData?.cells?.length > 0)) {
                isMoveValid = false;
            }
            // If completely empty map, allow?
            // Keep existing fallback: if (!targetLevelData || ...) isValid=true
        }

        if (isMoveValid) {
            // Apply bounds check just in case
            const mapSize = 100;
            if (Math.abs(newX) > mapSize) newX = x; // Reset if out of bounds (shouldn't happen with coverage check)
            if (Math.abs(newZ) > mapSize) newZ = z;

            return { ...minion, x: newX, z: newZ, level: newLevel };
        }
    }

    // Failed to find valid move
    return { ...minion };
};

export const evaluateCoverage = (minions, levels, config, logger) => {
    let energyConsumed = 0;
    let failure = null;
    let failureMsg = '';
    const cellsShouldBeOn = new Set();
    const uncoveredMinionIds = [];

    // Config limits
    const CELL_CAPACITY_LIMIT = config.COVERAGE_LIMIT_MBPS || 100; // Apply to both for now

    // 1. Calculate Energy & Identify Functional (Backhauled) Capacity Cells
    // Count active cells for energy cost
    levels.forEach(l => {
        l.cells.forEach(c => {
            if (c.active) energyConsumed += config.MINION_ENERGY_COST;
        });
    });

    // Identify functional capacity cells (All Active Cells)
    const functionalCapacityCells = [];
    levels.forEach(l => {
        functionalCapacityCells.push(...l.cells.filter(c => c.active && c.type === 'capacity'));
    });

    const log = logger || (typeof remoteLog !== 'undefined' ? { log: remoteLog } : console);
    // if (log.log) log.log(`[SIM] Functional Cells: ${functionalCapacityCells.length} Capacity cells active.`);

    // Tracking Assignment
    // cellAssignments: { cellId: { cell, load, minions: [] } }
    const cellAssignments = {};

    // Helper to init assignment record
    const trackAssignment = (cell, minion, load) => {
        if (!cellAssignments[cell.id]) {
            cellAssignments[cell.id] = { cell, totalLoad: 0, minions: [] };
        }
        cellAssignments[cell.id].totalLoad += load;
        cellAssignments[cell.id].minions.push(minion.id);
        if (log.log) log.log(`[SIM] Assigned Minion ${minion.id} (${minion.type}) to Cell ${cell.id} (Load: ${load})`);
    };

    // Helper: Is Minion Covered by Cell? (Hex Check)
    const isMinionCoveredByCell = (m, c) => {
        const dx = m.x - c.x;
        const dz = m.z - c.z;
        const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;

        // Hex Check
        const qx = Math.abs(dx);
        const qz = Math.abs(dz);
        const diag = (Math.sqrt(3) / 2) * qx + 0.5 * qz;

        return qz < radius && diag < radius && qx < radius * (Math.sqrt(3) / 2);
    };

    if (log.log) log.log(`[SIM] Evaluating Coverage for ${minions.length} minions...`);

    // Step 1: Check in coverage for each minion
    const minionStates = minions.map(m => {
        const level = levels.find(l => l.id === m.level);
        if (!level) return { ...m, covered: false };

        const reqThroughput = config[m.type.toUpperCase()]?.REQ_THROUGHPUT || 0;
        let assigned = false;

        // 1. Find Nearest Functional Capacity Cell
        // Must be on SAME level (Service rule)
        const relevantCapacity = functionalCapacityCells.filter(c => c.level === m.level);

        // Find those covering the minion
        const coveringCapacity = relevantCapacity.filter(c => isMinionCoveredByCell(m, c));

        if (coveringCapacity.length > 0) {
            // Sort by distance
            coveringCapacity.sort((a, b) => {
                const da = (m.x - a.x) ** 2 + (m.z - a.z) ** 2;
                const db = (m.x - b.x) ** 2 + (m.z - b.z) ** 2;
                return da - db;
            });
            const target = coveringCapacity[0];
            trackAssignment(target, m, reqThroughput);
            assigned = true;
        }

        // 2. If no capacity cell, Find Nearest Coverage Cell
        if (!assigned) {
            const activeCoverage = level.cells.filter(c => c.active && c.type === 'coverage');
            const coveringCoverage = activeCoverage.filter(c => isMinionCoveredByCell(m, c));

            if (coveringCoverage.length > 0) {
                coveringCoverage.sort((a, b) => {
                    const da = (m.x - a.x) ** 2 + (m.z - a.z) ** 2;
                    const db = (m.x - b.x) ** 2 + (m.z - b.z) ** 2;
                    return da - db;
                });
                const target = coveringCoverage[0];
                trackAssignment(target, m, reqThroughput);
                assigned = true;
            }
        }

        if (!assigned) {
            if (!failure) failure = `Minion ${m.id} lost service!`;
            uncoveredMinionIds.push(m.id);
            if (log.log) log.log(`[SIM] FAIL: Minion ${m.id} at (${m.x.toFixed(1)}, ${m.z.toFixed(1)}) Level ${m.level} NOT COVERED.`);

            // Suggest Logic (Find ANY cell on level that covers, active or not)
            const potentialCells = level.cells.filter(c => isMinionCoveredByCell(m, c));
            // Prioritize Capacity
            const cap = potentialCells.filter(c => c.type === 'capacity');
            if (cap.length > 0) cap.forEach(c => cellsShouldBeOn.add(c.id));
            else potentialCells.forEach(c => cellsShouldBeOn.add(c.id));
        }

        return { ...m, covered: assigned };
    });

    if (uncoveredMinionIds.length > 0) {
        // Step 1 Failed
        // Log stats
        const coveredCount = minions.length - uncoveredMinionIds.length;
        if (log.log) log.log(`[SIM] Step 1 Coverage Fail: ${coveredCount}/${minions.length} served.`);
    } else {
        // Step 2: Check Throughput Capacity
        // Iterate all assigned cells
        for (const [cellId, data] of Object.entries(cellAssignments)) {
            const utilization = (data.totalLoad / CELL_CAPACITY_LIMIT) * 100;
            if (log.log) log.log(`[SIM] Cell ${cellId} Load: ${data.totalLoad}/${CELL_CAPACITY_LIMIT} (${utilization.toFixed(1)}%) - Minions: ${data.minions.length}`);

            if (data.totalLoad > CELL_CAPACITY_LIMIT) {
                failure = `Cell ${cellId} Overloaded! Load: ${data.totalLoad} / ${CELL_CAPACITY_LIMIT}`;

                // If overloaded, maybe we should suggest expanding capacity? 
                // Or maybe this counts as "User needs to add more capacity cells" (which means turning them on).
                // But if they are already on?
                // The game assumes user turns on EXISTING cells.
                // If a cell is overloaded, the user probably needs to turn on a NEARBY cell to offload traffic (if logic supported load balancing).
                // But our assignment logic is greedy (Nearest).
                // So user must enable a cell CLOSER to some minions to steal them?
                // Or just enable MORE cells?
                // For "shouldBeOn", we can suggest the overloaded cell itself (it is on), 
                // OR we flag it as critical?
                // Actually, if it's overloaded, it works, but fails game constraints.
                // We should probably mark it as "shouldBeOn" to emphasize it? Or maybe neighboring cells?
                cellsShouldBeOn.add(cellId);
                break; // Game Over
            }
        }
    }

    // Final Stats
    if (!failure) {
        // Log success stats
        if (log.log) log.log(`[SIM] Step 2 Success: All ${minions.length} minions served within capacity.`);
    }

    // Identify ALL functional cells (All Active Cells)
    const allFunctionalIds = [];
    levels.forEach(l => {
        allFunctionalIds.push(...l.cells.filter(c => c.active).map(c => c.id));
    });

    return {
        minionStates,
        energyConsumed,
        failure,
        cellsShouldBeOn: Array.from(cellsShouldBeOn),
        uncoveredMinions: uncoveredMinionIds,
        functionalCellIds: allFunctionalIds
    };
};
