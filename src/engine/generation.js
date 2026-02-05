import { CELL_TYPES } from '../config.js';

// Simplified coordinate helper (shared with HexCell)
export const getHexPosition = (q, r, radius) => {
    const x = radius * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = radius * (1.5 * r);
    return [x, 0, y];
};

/**
 * Generates a scenario based on configuration.
 * @param {Object} config - The game configuration.
 * @param {Object} physicalMap - Optional pre-existing physical map.
 * @param {Boolean} resetMap - Whether to regenerate the physical map.
 * @returns {Object} { scenarioState, physicalMap, mapRadius }
 */
export const generateScenario = (config, physicalMap = null, resetMap = true, logger = console) => {
    const newLevels = [];
    let maxExt = 30; // Minimum floor size

    // Helper to generate concentric hexagonal coordinates
    const generateHexSpiral = (count) => {
        const temp = [];
        const range = Math.ceil(Math.sqrt(count)) + 2;
        for (let q = -range; q <= range; q++) {
            for (let r = -range; r <= range; r++) {
                const s = -q - r;
                const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
                temp.push({ q, r, dist });
            }
        }
        temp.sort((a, b) => {
            if (a.dist !== b.dist) return a.dist - b.dist;
            return Math.atan2(a.r, a.q) - Math.atan2(b.r, b.q);
        });
        return temp.slice(0, count);
    };

    // 1. Pre-calculate Centers (Hexagonal Spiral Layout)
    const numCoverage = Math.max(0, config.COVERAGE_CELL_RADIUS > 0 ? config.COVERAGE_CELLS_COUNT : 0);
    const covSpacing = config.COVERAGE_CELL_RADIUS;
    const covCoords = generateHexSpiral(numCoverage);

    const numCapacity = Math.max(0, config.CAPACITY_CELLS_COUNT);
    const capSpacing = config.CAPACITY_CELL_RADIUS;
    const capCoords = generateHexSpiral(numCapacity);

    // Update maxExt based on spiral distribution
    covCoords.forEach(coord => {
        const pos = getHexPosition(coord.q, coord.r, covSpacing);
        const dist = Math.sqrt(pos[0] ** 2 + pos[2] ** 2);
        if (dist > maxExt) maxExt = dist;
    });
    capCoords.forEach(coord => {
        const pos = getHexPosition(coord.q, coord.r, capSpacing);
        const dist = Math.sqrt(pos[0] ** 2 + pos[2] ** 2);
        if (dist > maxExt) maxExt = dist;
    });

    // 1.3 Calculate Area-Based Radius
    const totalCoverageArea = numCoverage * Math.PI * Math.pow(config.COVERAGE_CELL_RADIUS, 2);
    const areaBasedRadius = Math.sqrt(totalCoverageArea / Math.PI); // Simplifies to sqrt(N) * R

    // Final radius ensures a minimum floor size and adds a 20% margin for the architecture
    const finalRadius = Math.max(80, areaBasedRadius * 1.2);

    logger.log(`[GEN] Starting gNodeB layer generation: levels=${config.MAP_LEVELS}, cov_count=${numCoverage}, cap_count=${numCapacity}`);

    for (let l = 0; l < config.MAP_LEVELS; l++) {
        const levelCells = [];
        covCoords.forEach((center, idx) => {
            const pos = getHexPosition(center.q, center.r, covSpacing);
            levelCells.push({
                id: `cell_${l}_cov_${idx}`,
                x: pos[0], z: pos[2], q: center.q, r: center.r,
                type: CELL_TYPES.COVERAGE, active: false, level: l
            });
        });

        capCoords.forEach((center, idx) => {
            const pos = getHexPosition(center.q, center.r, capSpacing);
            levelCells.push({
                id: `cell_${l}_cap_${idx}`,
                x: pos[0], z: pos[2], q: center.q, r: center.r,
                type: CELL_TYPES.CAPACITY, active: false, level: l
            });
        });

        newLevels.push({ id: l, cells: levelCells });
        logger.log(`[GEN] Level ${l}: Generated ${covCoords.length} coverage cells and ${capCoords.length} capacity cells`);
    }

    logger.log(`[GEN] Starting scenario generation: levels=${config.MAP_LEVELS}, radius=${finalRadius}, obstacle_pct=${config.TOTAL_OBSTACLE_AREA_PER_LEVEL ?? 10}%`);

    let generatedPhysicalMap = physicalMap;
    // 3. Dynamic Physical Map (Only on explicit click/mount)
    if (resetMap || !physicalMap) {
        generatedPhysicalMap = { levels: [] };
        for (let l = 0; l < config.MAP_LEVELS; l++) {
            // 3.5 Type-Specific Exclusion Zones (Physical Layer 2.2 Calibrated)
            const type_exclusion_zones = {};
            const minionTypes = ['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'];

            // Hexagon Area = (3 * sqrt(3) / 2) * R^2 approx 2.598 * R^2
            const hexArea = 2.598 * finalRadius * finalRadius;

            // Obstacle calculation
            const obstaclePct = (config && typeof config.TOTAL_OBSTACLE_AREA_PER_LEVEL === 'number')
                ? config.TOTAL_OBSTACLE_AREA_PER_LEVEL
                : 10;

            const totalTargetArea = hexArea * (obstaclePct / 100);
            const areaPerType = totalTargetArea / minionTypes.length;

            logger.log(`[GEN] Level ${l}: Hex Area=${hexArea.toFixed(1)}, Target Obstacle Area=${totalTargetArea.toFixed(1)} (${obstaclePct}%)`);

            minionTypes.forEach(type => {
                const zones = [];

                // Define fixed sizes for obstacles
                const sizeClasses = [
                    { base: 12, weight: 0.5, label: 'Large' },
                    { base: 8, weight: 0.3, label: 'Medium' },
                    { base: 5, weight: 0.2, label: 'Small' }
                ];

                sizeClasses.forEach(sc => {
                    const targetAreaForClass = areaPerType * sc.weight;
                    const areaPerObstacle = sc.base * sc.base;
                    const N = Math.max(1, Math.round(targetAreaForClass / areaPerObstacle));

                    for (let i = 0; i < N; i++) {
                        let placed = false;
                        let attempts = 0;
                        const maxAttempts = 200;

                        while (!placed && attempts < maxAttempts) {
                            attempts++;

                            // Size with small variance (+/- 10%)
                            const variance = (Math.random() * 0.2) + 0.9; // 0.9 to 1.1
                            const size = sc.base * variance;
                            const halfSize = size / 2;

                            // Random position
                            const spawnRadius = finalRadius - halfSize;
                            if (spawnRadius <= 0) continue;

                            const r = Math.random() * spawnRadius;
                            const theta = Math.random() * 2 * Math.PI;
                            const x = r * Math.cos(theta);
                            const z = r * Math.sin(theta);

                            // 1. Strict Boundary Check
                            const farX = Math.abs(x) + halfSize;
                            const farZ = Math.abs(z) + halfSize;
                            const cornerDist = Math.sqrt(farX * farX + farZ * farZ);
                            if (cornerDist >= finalRadius) continue;

                            // 2. Overlap Check
                            let overlap = false;
                            for (const other of zones) {
                                const otherHalf = other.size / 2;
                                const dx = Math.abs(x - other.x);
                                const dz = Math.abs(z - other.z);
                                const minSpacing = 2;

                                if (dx < (halfSize + otherHalf + minSpacing) &&
                                    dz < (halfSize + otherHalf + minSpacing)) {
                                    overlap = true;
                                    break;
                                }
                            }
                            if (overlap) continue;

                            // 3. Center Hub Safety
                            if (Math.sqrt(x * x + z * z) < 15 + halfSize) continue;

                            zones.push({ x, z, size, type });
                            placed = true;
                        }
                    }
                });

                type_exclusion_zones[type] = zones;
                logger.log(`[GEN] Level ${l} - ${type}: Placed ${zones.length} obstacles`);
            });

            // 3.6 Initialize Empty Transition Zones (Filled in Post-Processing)
            generatedPhysicalMap.levels.push({
                id: l,
                type_exclusion_zones,
                transition_zones: []
            });
        }

        // 4. Post-Processing: Generate Coupled Transition Zones (Level L <-> Level L+1)
        for (let l = 0; l < generatedPhysicalMap.levels.length - 1; l++) {
            const currentLevel = generatedPhysicalMap.levels[l];
            const nextLevel = generatedPhysicalMap.levels[l + 1];

            const numCouples = Math.max(0, Number(config.PORTAL_PAIR_COUNT) || 0);
            const portalAreaValue = Number(config.PORTAL_AREA) || 0;
            logger.log(`[GEN] Portal generation config: pairs=${numCouples}, area=${portalAreaValue}`);

            for (let k = 0; k < numCouples; k++) {
                let placed = false;
                let attempts = 0;
                const maxPairAttempts = 20;
                const minPairSpacing = 2;

                const radius = Math.sqrt(portalAreaValue / Math.PI);
                const hexApothem = finalRadius * (Math.sqrt(3) / 2);
                const spawnRadius = Math.max(0, hexApothem - radius - 1);

                const portalExclusionIgnore = new Set(['TURTLE_BOT', 'DRONE']);

                const checkExclusion = (lvl, cx, cz) => {
                    for (const typeKey in lvl.type_exclusion_zones) {
                        if (portalExclusionIgnore.has(typeKey)) continue;
                        const arr = lvl.type_exclusion_zones[typeKey] || [];
                        for (let zi = 0; zi < arr.length; zi++) {
                            const zone = arr[zi];
                            const half = zone.size / 2;
                            const closestX = Math.max(zone.x - half, Math.min(cx, zone.x + half));
                            const closestZ = Math.max(zone.z - half, Math.min(cz, zone.z + half));
                            const dist = Math.sqrt((cx - closestX) ** 2 + (cz - closestZ) ** 2);
                            if (dist < radius + 2) return { typeKey, index: zi };
                        }
                    }
                    return null;
                };

                while (!placed && attempts < maxPairAttempts) {
                    attempts++;
                    if (spawnRadius <= 0) break;

                    const r = Math.random() * spawnRadius;
                    const theta = Math.random() * 2 * Math.PI;
                    const x = r * Math.cos(theta);
                    const z = r * Math.sin(theta);

                    if (Math.sqrt(x * x + z * z) > spawnRadius) continue;

                    // Overlap current
                    if ((currentLevel.transition_zones || []).some(t => Math.sqrt((x - t.x) ** 2 + (z - t.z) ** 2) < radius + t.radius + minPairSpacing)) continue;
                    // Overlap next
                    if ((nextLevel.transition_zones || []).some(t => Math.sqrt((x - t.x) ** 2 + (z - t.z) ** 2) < radius + t.radius + minPairSpacing)) continue;

                    // Exclusion Both
                    if (checkExclusion(currentLevel, x, z)) continue;
                    if (checkExclusion(nextLevel, x, z)) continue;

                    currentLevel.transition_zones.push({ x, z, radius, targetLevel: l + 1, id: `couple_${l}_${l + 1}_${k}_up` });
                    nextLevel.transition_zones.push({ x, z, radius, targetLevel: l, id: `couple_${l}_${l + 1}_${k}_down` });
                    placed = true;
                    logger.log(`[GEN] Placed Zone Pair ${k} between L${l}-L${l + 1} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
                }

                if (!placed) {
                    // Fallback deterministic search (omitted for brevity in this extraction, but can be added back)
                    logger.warn(`[GEN] Failed to place Zone Pair ${k} randomly. Fallback search could be implemented here.`);
                }
            }
        }
    }

    // 5. Minion Spawning & Activation (LATEST ACTIVITY)
    const newMinions = [];
    const minionKeys = ['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'];
    let validationWarnings = 0;

    minionKeys.forEach(typeKey => {
        const mConfig = config[typeKey];
        if (!mConfig?.ENABLED) return;

        for (let i = 0; i < mConfig.COUNT; i++) {
            const assignedLevel = Math.floor(Math.random() * config.MAP_LEVELS);
            const levelCells = newLevels[assignedLevel]?.cells || [];
            let mx, mz;
            let validPosition = false;
            let attempt = 0;

            while (!validPosition && attempt < 150) {
                attempt++;
                const r = Math.sqrt(Math.random()) * (finalRadius * 0.9);
                const theta = Math.random() * 2 * Math.PI;
                mx = r * Math.cos(theta);
                mz = r * Math.sin(theta);

                // 1. Collision check (Obstacles)
                let insideExclusion = false;
                if (generatedPhysicalMap && generatedPhysicalMap.levels && generatedPhysicalMap.levels[assignedLevel]) {
                    const levelExclusions = generatedPhysicalMap.levels[assignedLevel].type_exclusion_zones?.[typeKey] || [];
                    const mSize = mConfig.SIZE || 1.0;
                    const mHalf = mSize / 2;
                    for (const zone of levelExclusions) {
                        const halfSize = zone.size / 2;
                        if (Math.abs(mx - zone.x) < (halfSize + mHalf) && Math.abs(mz - zone.z) < (halfSize + mHalf)) {
                            insideExclusion = true;
                            break;
                        }
                    }
                }
                if (insideExclusion) continue;

                // 2. Coverage Check (Must be in at least 1 cell)
                const coveringCells = levelCells.filter(cell => {
                    const dx = Math.abs(mx - cell.x);
                    const dz = Math.abs(mz - cell.z);
                    const radius = cell.type === CELL_TYPES.COVERAGE ? covSpacing : capSpacing;

                    // Hexagonal check to match simulation
                    // 1. |z| < radius
                    // 2. sqrt(3)/2 * |x| + 0.5 * |z| < radius
                    const diag = (Math.sqrt(3) / 2) * dx + 0.5 * dz;
                    return dz < radius && diag < radius && dx < radius * (Math.sqrt(3) / 2);
                });

                if (coveringCells.length > 0) {
                    validPosition = true;

                    // 3. Activation Logic
                    const capProvider = coveringCells.find(c => c.type === CELL_TYPES.CAPACITY);
                    if (capProvider) {
                        capProvider.active = true;
                    } else {
                        const covProvider = coveringCells.find(c => c.type === CELL_TYPES.COVERAGE);
                        if (covProvider) covProvider.active = true;
                    }
                }
            }

            if (!validPosition) validationWarnings++;

            newMinions.push({
                id: `${typeKey.toLowerCase()}_${i}`,
                type: typeKey.toLowerCase(),
                x: mx,
                z: mz,
                level: assignedLevel,
                color: mConfig.COLOR,
                covered: true
            });
        }
    });

    if (validationWarnings > 0) {
        logger.warn(`[GEN] Warning: ${validationWarnings} minions could not find a valid cell to stand in.`);
    } else {
        logger.log(`[GEN] Validation Success: All minions are covered by active cells.`);
    }

    const scenarioState = { levels: newLevels, minions: newMinions };
    return { scenarioState, physicalMap: generatedPhysicalMap, mapRadius: finalRadius };
};
