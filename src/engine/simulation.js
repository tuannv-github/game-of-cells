import { MINION_TYPES } from '../config.js';
import { remoteLog } from '../utils/logger.js';

/**
 * Check if two line segments intersect (excluding parallel/collinear edge cases).
 * Seg1: (x1,z1) -> (x2,z2), Seg2: (x3,z3) -> (x4,z4)
 */
const segmentsIntersect = (x1, z1, x2, z2, x3, z3, x4, z4) => {
    const dx1 = x2 - x1, dz1 = z2 - z1;
    const dx2 = x4 - x3, dz2 = z4 - z3;
    const det = dx1 * dz2 - dx2 * dz1;
    if (Math.abs(det) < 1e-10) return false; // parallel
    const t = (dx1 * (z3 - z1) - dz1 * (x3 - x1)) / det;
    const s = (dx2 * (z1 - z3) - dz2 * (x1 - x3)) / (-det);
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
};

/**
 * Check if line segment (x1,z1)->(x2,z2) intersects axis-aligned rectangle
 * centered at (cx,cz) with half-size h (bounds [cx-h,cx+h] x [cz-h,cz+h]).
 */
const segmentIntersectsRect = (x1, z1, x2, z2, cx, cz, halfSize) => {
    const xMin = cx - halfSize, xMax = cx + halfSize;
    const zMin = cz - halfSize, zMax = cz + halfSize;
    // Check intersection with each of the 4 edges
    if (segmentsIntersect(x1, z1, x2, z2, xMin, zMin, xMax, zMin)) return true; // bottom
    if (segmentsIntersect(x1, z1, x2, z2, xMax, zMin, xMax, zMax)) return true; // right
    if (segmentsIntersect(x1, z1, x2, z2, xMax, zMax, xMin, zMax)) return true; // top
    if (segmentsIntersect(x1, z1, x2, z2, xMin, zMax, xMin, zMin)) return true; // left
    // Also reject if segment is fully inside (both endpoints inside rect)
    const p1Inside = x1 > xMin && x1 < xMax && z1 > zMin && z1 < zMax;
    const p2Inside = x2 > xMin && x2 < xMax && z2 > zMin && z2 < zMax;
    return p1Inside || p2Inside;
};

// For generation: find covering cell (capacity first, then coverage) - cells need not be active.
export const getCoveringCellForPosition = (x, z, levelId, levels, config) => {
    const level = levels?.find(l => l.id === levelId);
    if (!level) return null;
    const isCoveredBy = (px, pz, c) => {
        const dx = px - c.x, dz = pz - c.z;
        const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;
        return Math.sqrt(dx * dx + dz * dz) < radius;
    };
    const capacityCells = level.cells.filter(c => c.type === 'capacity');
    const coveringCap = capacityCells.filter(c => isCoveredBy(x, z, c));
    if (coveringCap.length > 0) {
        coveringCap.sort((a, b) => ((x - a.x) ** 2 + (z - a.z) ** 2) - ((x - b.x) ** 2 + (z - b.z) ** 2));
        return { cell: coveringCap[0], isCapacity: true };
    }
    const coverageCells = level.cells.filter(c => c.type === 'coverage');
    const coveringCov = coverageCells.filter(c => isCoveredBy(x, z, c));
    if (coveringCov.length > 0) {
        coveringCov.sort((a, b) => ((x - a.x) ** 2 + (z - a.z) ** 2) - ((x - b.x) ** 2 + (z - b.z) ** 2));
        return { cell: coveringCov[0], isCapacity: false };
    }
    return null;
};

// Exported for use in movement: find serving cell (active only, capacity first, then coverage).
export const getServingCellForPosition = (x, z, levelId, levels, config) => {
    const level = levels?.find(l => l.id === levelId);
    if (!level) return null;
    const isCoveredBy = (px, pz, c) => {
        const dx = px - c.x, dz = pz - c.z;
        const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;
        return Math.sqrt(dx * dx + dz * dz) < radius;
    };
    const functionalCapacity = level.cells.filter(c => c.active && c.type === 'capacity');
    const coveringCap = functionalCapacity.filter(c => isCoveredBy(x, z, c));
    if (coveringCap.length > 0) {
        coveringCap.sort((a, b) => ((x - a.x) ** 2 + (z - a.z) ** 2) - ((x - b.x) ** 2 + (z - b.z) ** 2));
        return { cell: coveringCap[0], isCapacity: true };
    }
    const activeCoverage = level.cells.filter(c => c.active && c.type === 'coverage');
    const coveringCov = activeCoverage.filter(c => isCoveredBy(x, z, c));
    if (coveringCov.length > 0) {
        coveringCov.sort((a, b) => ((x - a.x) ** 2 + (z - a.z) ** 2) - ((x - b.x) ** 2 + (z - b.z) ** 2));
        return { cell: coveringCov[0], isCapacity: false };
    }
    return null;
};

// Exported for use in generation
export const getLoadOnCoverageCell = (cellId, minions, overrideMinion, levels, config) => {
    let load = 0;
    const isCoveredBy = (m, c) => {
        const px = (overrideMinion && m.id === overrideMinion.id) ? overrideMinion.x : m.x;
        const pz = (overrideMinion && m.id === overrideMinion.id) ? overrideMinion.z : m.z;
        const pl = (overrideMinion && m.id === overrideMinion.id) ? overrideMinion.level : m.level;
        if (c.level !== pl) return false;
        const dx = px - c.x, dz = pz - c.z;
        const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;
        return Math.sqrt(dx * dx + dz * dz) < radius;
    };
    for (const m of minions) {
        const level = levels?.find(l => l.id === (overrideMinion && m.id === overrideMinion.id ? overrideMinion.level : m.level));
        if (!level) continue;
        const pos = overrideMinion && m.id === overrideMinion.id ? { ...m, x: overrideMinion.x, z: overrideMinion.z, level: overrideMinion.level } : m;
        const functionalCapacity = level.cells.filter(c => c.active && c.type === 'capacity');
        const coveringCap = functionalCapacity.filter(c => isCoveredBy(pos, c));
        if (coveringCap.length > 0) continue;
        const activeCoverage = level.cells.filter(c => c.active && c.type === 'coverage');
        const coveringCov = activeCoverage.filter(c => isCoveredBy(pos, c));
        if (coveringCov.length > 0) {
            coveringCov.sort((a, b) => ((pos.x - a.x) ** 2 + (pos.z - a.z) ** 2) - ((pos.x - b.x) ** 2 + (pos.z - b.z) ** 2));
            if (coveringCov[0].id === cellId) {
                load += config[m.type.toUpperCase()]?.REQ_THROUGHPUT || 0;
            }
        }
    }
    return load;
};

// Helper for random movement within constraints
// For each minion: generate random movement (within max), validate, retry up to 10 times.
// If no valid move found: keep old position (minion stays put).
// allMinions: optional array of all minions (current positions) for overload check when target is coverage cell.
export const moveMinion = (minion, config, physicalMap, activeLevels = null, logger = null, allMinions = null) => {
    const log = logger?.log ? (m) => logger.log(m) : (typeof remoteLog !== 'undefined' ? remoteLog : () => {});
    const { type, x, z, level } = minion;
    const maxMove = config[type.toUpperCase()]?.MAX_MOVE ?? 1;
    const MAX_ATTEMPTS = 10;

    log(`[SIM] moveMinion: ${minion.id} trying from (${x.toFixed(1)}, ${z.toFixed(1)}) level ${level} maxMove=${maxMove}`);

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

        // 0. Check path collision: straight line from (x,z) to (newX,newZ) must not intersect obstacles
        const typeKey = type.toUpperCase();
        const levelsToCheck = level === newLevel ? [level] : [level, newLevel];
        for (const lvlId of levelsToCheck) {
            const lvlData = physicalMap?.levels?.find(l => l.id === lvlId);
            const exclusionList = lvlData?.type_exclusion_zones?.[typeKey] || lvlData?.type_exclusion_zones?.[type] || [];
            for (const zone of exclusionList) {
                const halfSize = zone.size / 2;
                if (segmentIntersectsRect(x, z, newX, newZ, zone.x, zone.z, halfSize)) {
                    isMoveValid = false;
                    log(`[SIM] moveMinion: ${minion.id} attempt ${attempt + 1} rejected: path intersects obstacle at (${zone.x?.toFixed(1)}, ${zone.z?.toFixed(1)})`);
                    break;
                }
            }
            if (!isMoveValid) break;
        }

        if (!isMoveValid) continue;

        // 1. Check Exclusion Zones (destination inside obstacle)
        if (targetLevelData && targetLevelData.type_exclusion_zones) {
            const exclusionList = targetLevelData.type_exclusion_zones[typeKey] || targetLevelData.type_exclusion_zones[type] || [];
            const minionSize = config[typeKey]?.SIZE || 1.0;
            const mHalf = minionSize / 2;

            if (exclusionList) {
                for (const zone of exclusionList) {
                    const halfSize = zone.size / 2;
                    if (Math.abs(newX - zone.x) < (halfSize + mHalf) &&
                        Math.abs(newZ - zone.z) < (halfSize + mHalf)) {
                        isMoveValid = false;
                        log(`[SIM] moveMinion: ${minion.id} attempt ${attempt + 1} rejected: exclusion zone at (${zone.x?.toFixed(1)}, ${zone.z?.toFixed(1)})`);
                        break;
                    }
                }
            }
        }

        if (!isMoveValid) continue;

        // 2. Check Coverage: position must be within any cell's coverage (capacity first, then coverage; cell need not be active)
        const levelsToUse = activeLevels || (targetLevelData ? [{ ...targetLevelData, cells: targetLevelData.cells || [] }] : null);
        const covering = levelsToUse ? getCoveringCellForPosition(newX, newZ, newLevel, levelsToUse, config) : null;

        if (!covering) {
            isMoveValid = false;
            log(`[SIM] moveMinion: ${minion.id} attempt ${attempt + 1} rejected: no cell covers (${newX.toFixed(1)}, ${newZ.toFixed(1)})`);
        } else if (covering.isCapacity) {
            // Capacity cell: always valid (unlimited throughput when active; position check only)
        } else if (covering.cell.active) {
            // Coverage cell active: check overload
            const CELL_LIMIT = config.COVERAGE_LIMIT_MBPS || 100;
            const override = { id: minion.id, x: newX, z: newZ, level: newLevel };
            const load = getLoadOnCoverageCell(covering.cell.id, allMinions || [minion], override, levelsToUse, config);
            if (load > CELL_LIMIT) {
                isMoveValid = false;
                log(`[SIM] moveMinion: ${minion.id} attempt ${attempt + 1} rejected: coverage cell ${covering.cell.id} would be overloaded (${load}/${CELL_LIMIT})`);
            }
        }

        if (isMoveValid) {
            log(`[SIM] moveMinion: ${minion.id} moved (${x.toFixed(1)}, ${z.toFixed(1)}) -> (${newX.toFixed(1)}, ${newZ.toFixed(1)}) level ${newLevel}`);
            return { ...minion, x: newX, z: newZ, level: newLevel };
        }
    }

    // No valid move found: keep old position (back to old position)
    log(`[SIM] moveMinion: ${minion.id} back to old position (${x.toFixed(1)}, ${z.toFixed(1)}) - no valid move after ${MAX_ATTEMPTS} attempts`);
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
    // Count active cells for energy cost (guard against NaN from missing config)
    // Use count * energyPerCell to avoid floating-point accumulation (e.g. 30*1 vs 1+1+...+1 => 29.999...)
    const energyPerCell = Number(config.CELL_ENERGY_COST) || 1;
    let activeCellCount = 0;
    levels.forEach(l => {
        l.cells.forEach(c => {
            if (c.active) activeCellCount++;
        });
    });
    energyConsumed = Math.round(activeCellCount * energyPerCell * 100) / 100;

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

    // Helper: Is Minion Covered by Cell? (Circle)
    const isMinionCoveredByCell = (m, c) => {
        const dx = m.x - c.x;
        const dz = m.z - c.z;
        const radius = c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist < radius;
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
        // Step 2: Check Throughput Capacity (coverage cells only; capacity cells have unlimited throughput)
        for (const [cellId, data] of Object.entries(cellAssignments)) {
            if (data.cell.type === 'capacity') continue; // capacity cells: unlimited, no overload

            const utilization = (data.totalLoad / CELL_CAPACITY_LIMIT) * 100;
            if (log.log) log.log(`[SIM] Cell ${cellId} Load: ${data.totalLoad}/${CELL_CAPACITY_LIMIT} (${utilization.toFixed(1)}%) - Minions: ${data.minions.length}`);

            if (data.totalLoad > CELL_CAPACITY_LIMIT) {
                failure = `Cell ${cellId} Overloaded! Load: ${data.totalLoad} / ${CELL_CAPACITY_LIMIT}`;

                // On overload: suggest capacity cells that should be turned on to offload traffic
                const overloadedCell = data.cell;
                const level = levels.find(l => l.id === overloadedCell.level);
                if (level) {
                    const inactiveCapacity = level.cells.filter(c => c.type === 'capacity' && !c.active);
                    for (const minionId of data.minions) {
                        const m = minions.find(mi => mi.id === minionId);
                        if (!m) continue;
                        const covering = inactiveCapacity.filter(c => isMinionCoveredByCell(m, c));
                        covering.forEach(c => cellsShouldBeOn.add(c.id));
                    }
                }
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

    // Build cellLoads: { cellId: capacityConsumed } for each assigned cell
    const cellLoads = {};
    for (const [cellId, data] of Object.entries(cellAssignments)) {
        cellLoads[cellId] = data.totalLoad;
    }

    return {
        minionStates,
        energyConsumed,
        failure,
        cellsShouldBeOn: Array.from(cellsShouldBeOn),
        uncoveredMinions: uncoveredMinionIds,
        functionalCellIds: allFunctionalIds,
        cellLoads
    };
};
