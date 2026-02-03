import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Text } from '@react-three/drei';
import Sidebar from './components/Sidebar';
import HexCell, { getHexPosition } from './components/HexCell';
import Minion from './components/Minion';
import { DEFAULT_CONFIG, CELL_TYPES } from './config';
import { moveMinion, evaluateCoverage } from './engine/simulation';
import { loadMap } from './engine/MapLoader';
import { remoteLog } from './utils/logger';

const App = () => {
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('goc_config');
        if (!saved) return DEFAULT_CONFIG;
        try {
            const parsed = JSON.parse(saved);
            // Deep merge or at least top-level merge to ensure new keys like SIZE are available
            const merged = { ...DEFAULT_CONFIG };
            for (const key in parsed) {
                if (typeof parsed[key] === 'object' && parsed[key] !== null && !Array.isArray(parsed[key])) {
                    merged[key] = { ...merged[key], ...parsed[key] };
                } else {
                    merged[key] = parsed[key];
                }
            }
            return merged;
        } catch (e) {
            return DEFAULT_CONFIG;
        }
    });
    const [currentStep, setCurrentStep] = useState(() => {
        const saved = localStorage.getItem('goc_currentStep');
        return saved ? parseInt(saved) : 0;
    });
    const [worldState, setWorldState] = useState(() => {
        const saved = localStorage.getItem('goc_worldState');
        return saved ? JSON.parse(saved) : { levels: [], minions: [] };
    });
    const [status, setStatus] = useState('Standby');
    const [physicalMap, setPhysicalMap] = useState(() => {
        const saved = localStorage.getItem('goc_physicalMap');
        return saved ? JSON.parse(saved) : null;
    });
    const [showHint, setShowHint] = useState(false);
    const [mapRadius, setMapRadius] = useState(() => {
        const saved = localStorage.getItem('goc_mapRadius');
        return saved ? JSON.parse(saved) : 50;
    });
    const [layerVisibility, setLayerVisibility] = useState(() => {
        const saved = localStorage.getItem('goc_visibility');
        const defaults = {
            coverage: true,
            capacity: true,
            minions: true,
            axes: true,
            zone_HUMAN: true,
            zone_HUMANOID: true,
            zone_DOG_ROBOT: true,
            zone_TURTLE_BOT: true,
            zone_DRONE: true,
            zone_PORTAL: true,
            minion_HUMAN: true,
            minion_HUMANOID: true,
            minion_DOG_ROBOT: true,
            minion_TURTLE_BOT: true,
            minion_DRONE: true
        };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    const [mapList, setMapList] = useState([]);
    const orbitRef = useRef();

    // Persist settings to localStorage
    useEffect(() => {
        localStorage.setItem('goc_config', JSON.stringify(config));
    }, [config]);

    useEffect(() => {
        localStorage.setItem('goc_visibility', JSON.stringify(layerVisibility));
    }, [layerVisibility]);

    useEffect(() => {
        if (worldState) localStorage.setItem('goc_worldState', JSON.stringify(worldState));
    }, [worldState]);

    useEffect(() => {
        if (physicalMap) localStorage.setItem('goc_physicalMap', JSON.stringify(physicalMap));
    }, [physicalMap]);

    useEffect(() => {
        localStorage.setItem('goc_mapRadius', JSON.stringify(mapRadius));
    }, [mapRadius]);

    useEffect(() => {
        localStorage.setItem('goc_currentStep', currentStep.toString());
    }, [currentStep]);

    // Handle Camera View persistence
    const handleCameraChange = useCallback((e) => {
        if (!orbitRef.current) return;
        const camera = orbitRef.current.object;
        const target = orbitRef.current.target;
        const cameraState = {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [target.x, target.y, target.z]
        };
        localStorage.setItem('goc_camera', JSON.stringify(cameraState));
    }, []);

    useEffect(() => {
        const savedCamera = localStorage.getItem('goc_camera');
        remoteLog(`[UI] Initializing Camera Restoration. Saved state: ${savedCamera ? 'YES' : 'NO'}, Ref ready: ${orbitRef.current ? 'YES' : 'NO'}`);
        if (savedCamera && orbitRef.current) {
            try {
                const { position, target } = JSON.parse(savedCamera);
                orbitRef.current.object.position.set(...position);
                orbitRef.current.target.set(...target);
                orbitRef.current.update();
                remoteLog('[UI] Camera view restored from localStorage.');
            } catch (err) {
                remoteLog(`[ERROR] Camera restoration failed: ${err.message}`, 'error');
            }
        }
    }, [orbitRef.current]);

    const resetSettings = () => {
        if (window.confirm('Reset all settings to defaults? This will clear your current session and reload the page.')) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('goc_')) localStorage.removeItem(key);
            });
            window.location.reload();
        }
    };

    const layerOffsets = config.LAYER_OFFSETS || DEFAULT_CONFIG.LAYER_OFFSETS;


    // Initialize world on mount
    // Initialize world on mount - REMOVED to prevent auto-generation on reload

    const generateWorld = useCallback((resetMap = false) => {
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
        setMapRadius(finalRadius);

        remoteLog(`[GEN] Starting gNodeB layer generation: levels=${config.MAP_LEVELS}, cov_count=${numCoverage}, cap_count=${numCapacity}`);

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
            remoteLog(`[GEN] Level ${l}: Generated ${covCoords.length} coverage cells and ${capCoords.length} capacity cells`);
        }

        remoteLog(`[GEN] Starting world generation: levels=${config.MAP_LEVELS}, radius=${finalRadius}, obstacle_pct=${config.TOTAL_OBSTACLE_AREA_PER_LEVEL ?? 10}%`);

        let generatedPhysicalMap = null;
        // 3. Dynamic Physical Map (Only on explicit click/mount)
        if (resetMap || !physicalMap) {
            generatedPhysicalMap = { levels: [] };
            for (let l = 0; l < config.MAP_LEVELS; l++) {
                // 3.5 Type-Specific Exclusion Zones (Physical Layer 2.2 Calibrated)
                const type_exclusion_zones = {};
                const minionTypes = ['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'];

                // Hexagon Area = (3 * sqrt(3) / 2) * R^2 approx 2.598 * R^2
                const hexArea = 2.598 * finalRadius * finalRadius;

                // Explicitly check for the config value to debug "stale state" issues
                const obstaclePct = (config && typeof config.TOTAL_OBSTACLE_AREA_PER_LEVEL === 'number')
                    ? config.TOTAL_OBSTACLE_AREA_PER_LEVEL
                    : (DEFAULT_CONFIG.TOTAL_OBSTACLE_AREA_PER_LEVEL ?? 10);

                const totalTargetArea = hexArea * (obstaclePct / 100);
                const areaPerType = totalTargetArea / minionTypes.length;

                remoteLog(`[GEN] Level ${l}: Hex Area=${hexArea.toFixed(1)}, Target Obstacle Area=${totalTargetArea.toFixed(1)} (${obstaclePct}% from ${typeof config.TOTAL_OBSTACLE_AREA_PER_LEVEL === 'number' ? 'state' : 'DEFAULT_CONFIG fallback'})`);

                minionTypes.forEach(type => {
                    const zones = [];
                    const N = Math.floor(Math.random() * 5) + 1; // 1 to 5 per size class for better distribution

                    // Distribution ratio 3:2:1 for Large:Medium:Small
                    const areaLarge = (areaPerType * 3 / 6) / N;
                    const areaMedium = (areaPerType * 2 / 6) / N;
                    const areaSmall = (areaPerType * 1 / 6) / N;

                    const sizeClasses = [
                        { base: Math.sqrt(areaLarge), label: 'Large' },
                        { base: Math.sqrt(areaMedium), label: 'Medium' },
                        { base: Math.sqrt(areaSmall), label: 'Small' }
                    ];

                    sizeClasses.forEach(sizeClass => {
                        for (let i = 0; i < N; i++) {
                            let placed = false;
                            let attempts = 0;
                            const maxAttempts = 200;

                            while (!placed && attempts < maxAttempts) {
                                attempts++;

                                // Size with small variance (+/- 10%)
                                const variance = (Math.random() * 0.2) + 0.9; // 0.9 to 1.1
                                const size = sizeClass.base * variance;
                                const halfSize = size / 2;

                                // Random position
                                const spawnRadius = finalRadius - halfSize;
                                if (spawnRadius <= 0) continue; // Should not happen with reasonable N

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
                    remoteLog(`[GEN] Level ${l} - ${type}: Placed ${zones.length} obstacles`);
                });

                // 3.6 Initialize Empty Transition Zones (Filled in Post-Processing)
                generatedPhysicalMap.levels.push({
                    type_exclusion_zones,
                    transition_zones: []
                });
            }

            // 4. Post-Processing: Generate Coupled Transition Zones (Level L <-> Level L+1)
            // Iterate through level pairs (0-1, 1-2, 2-3, etc.)
            for (let l = 0; l < generatedPhysicalMap.levels.length - 1; l++) {
                const currentLevel = generatedPhysicalMap.levels[l];
                const nextLevel = generatedPhysicalMap.levels[l + 1];

                const numCouples = Math.max(0, Number(config.PORTAL_PAIR_COUNT) || 0);
                const portalAreaValue = Number(config.PORTAL_AREA) || 0;
                remoteLog(`[GEN] Portal generation config: pairs=${numCouples}, area=${portalAreaValue}`);

                for (let k = 0; k < numCouples; k++) {
                    let placed = false;
                    let attempts = 0;
                    const maxPairAttempts = 20; // try fewer random attempts, then fallback
                    const minPairSpacing = 2; // spacing buffer

                    // Precompute constants so fallback can reference them
                    const radius = Math.sqrt(portalAreaValue / Math.PI);
                    const hexApothem = finalRadius * (Math.sqrt(3) / 2);
                    const spawnRadius = Math.max(0, hexApothem - radius - 1); // -1 buffer

                    const portalExclusionIgnore = new Set(['TURTLE_BOT', 'DRONE']);

                    const checkExclusion = (lvl, cx, cz) => {
                        for (const typeKey in lvl.type_exclusion_zones) {
                            // Skip exclusion zones for minion types when placing portals
                            if (portalExclusionIgnore.has(typeKey)) continue;
                            const arr = lvl.type_exclusion_zones[typeKey] || [];
                            for (let zi = 0; zi < arr.length; zi++) {
                                const zone = arr[zi];
                                const half = zone.size / 2;
                                const closestX = Math.max(zone.x - half, Math.min(cx, zone.x + half));
                                const closestZ = Math.max(zone.z - half, Math.min(cz, zone.z + half));
                                const dist = Math.sqrt((cx - closestX) ** 2 + (cz - closestZ) ** 2);
                                if (dist < radius + 2) {
                                    return { typeKey, index: zi, zone, dist };
                                }
                            }
                        }
                        return null;
                    };

                    const rejectionCounts = {};
                    const noteRejection = (reason) => { rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1; };

                    while (!placed && attempts < maxPairAttempts) {
                        attempts++;

                        if (spawnRadius <= 0) {
                            noteRejection('spawnRadius<=0');
                            remoteLog(`[GEN] spawnRadius <= 0, cannot place zone: hexApothem=${hexApothem.toFixed(2)} radius=${radius.toFixed(2)}`, 'warn');
                            break; // abort attempts for this pair
                        }

                        const r = Math.random() * spawnRadius;
                        const theta = Math.random() * 2 * Math.PI;
                        const x = r * Math.cos(theta);
                        const z = r * Math.sin(theta);

                        // 1. Bounds Check (Redundant with spawnRadius but safe)
                        if (Math.sqrt(x * x + z * z) > spawnRadius) { noteRejection('out_of_bounds'); continue; }

                        // 2. Overlap Check (Current Level Transition Zones)
                        if ((currentLevel.transition_zones || currentLevel.transition_areas || []).some(t => Math.sqrt((x - ((t.x ?? t.center?.x ?? 0))) ** 2 + (z - ((t.z ?? t.center?.z ?? 0))) ** 2) < radius + (t.radius ?? t.r ?? 0) + minPairSpacing)) { noteRejection('overlap_current'); continue; }

                        // 3. Overlap Check (Next Level Transition Zones)
                        if ((nextLevel.transition_zones || nextLevel.transition_areas || []).some(t => Math.sqrt((x - ((t.x ?? t.center?.x ?? 0))) ** 2 + (z - ((t.z ?? t.center?.z ?? 0))) ** 2) < radius + (t.radius ?? t.r ?? 0) + minPairSpacing)) { noteRejection('overlap_next'); continue; }

                        // 4. Exclusion Check (BOTH Levels)
                        const exclCur = checkExclusion(currentLevel, x, z);
                        if (exclCur) { noteRejection(`exclusion_collision:${exclCur.typeKey}:${exclCur.index}`); continue; }
                        const exclNext = checkExclusion(nextLevel, x, z);
                        if (exclNext) { noteRejection(`exclusion_collision:${exclNext.typeKey}:${exclNext.index}`); continue; }

                        // Place Pair
                        // Up Zone (L -> L+1)
                        currentLevel.transition_zones.push({ x, z, radius, targetLevel: l + 1, id: `couple_${l}_${l + 1}_${k}_up` });
                        // Down Zone (L+1 -> L)
                        nextLevel.transition_zones.push({ x, z, radius, targetLevel: l, id: `couple_${l}_${l + 1}_${k}_down` });
                        placed = true;
                        remoteLog(`[GEN] Placed Zone Pair ${k} between L${l}-L${l + 1} at (${x.toFixed(1)}, ${z.toFixed(1)})`);
                    }
                    if (!placed) {
                        // Log aggregated rejection reasons before running fallback
                        try {
                            const reasons = Object.entries(rejectionCounts).map(([k, v]) => `${k}:${v}`).join(', ') || 'none';
                            remoteLog(`[GEN] Random placement failed for pair ${k} after ${attempts} attempts. Reasons: ${reasons}`);
                        } catch (err) {
                            remoteLog(`[ERROR] Failed to log rejection reasons for pair ${k}: ${err.message}`, 'error');
                        }
                        // Fallback deterministic search: try concentric rings to find any valid position
                        let fallbackPlaced = false;
                        try {
                            const ringSteps = 8;
                            const angleSteps = 24;
                            for (let ri = 0; ri <= ringSteps && !fallbackPlaced; ri++) {
                                const rr = (spawnRadius * ri) / Math.max(1, ringSteps);
                                for (let ai = 0; ai < angleSteps && !fallbackPlaced; ai++) {
                                    const thetaF = (ai / angleSteps) * Math.PI * 2;
                                    const fx = rr * Math.cos(thetaF);
                                    const fz = rr * Math.sin(thetaF);

                                    // Bounds check
                                    if (Math.sqrt(fx * fx + fz * fz) > spawnRadius) continue;

                                    // Overlap with current
                                    const overlapCurrent = (currentLevel.transition_zones || currentLevel.transition_areas || []).some(t => Math.sqrt((fx - ((t.x ?? t.center?.x ?? 0))) ** 2 + (fz - ((t.z ?? t.center?.z ?? 0))) ** 2) < radius + (t.radius ?? t.r ?? 0) + minPairSpacing);
                                    if (overlapCurrent) continue;

                                    // Overlap with next
                                    const overlapNext = (nextLevel.transition_zones || nextLevel.transition_areas || []).some(t => Math.sqrt((fx - ((t.x ?? t.center?.x ?? 0))) ** 2 + (fz - ((t.z ?? t.center?.z ?? 0))) ** 2) < radius + (t.radius ?? t.r ?? 0) + minPairSpacing);
                                    if (overlapNext) continue;

                                    // Exclusion check using centralized checker with saved coords
                                    const savedX = fx; const savedZ = fz;
                                    const exclCurF = checkExclusion(currentLevel, savedX, savedZ);
                                    if (exclCurF) { noteRejection(`exclusion_collision:${exclCurF.typeKey}:${exclCurF.index}`); continue; }
                                    const exclNextF = checkExclusion(nextLevel, savedX, savedZ);
                                    if (exclNextF) { noteRejection(`exclusion_collision:${exclNextF.typeKey}:${exclNextF.index}`); continue; }

                                    // Place via fallback
                                    currentLevel.transition_zones.push({ x: savedX, z: savedZ, radius, targetLevel: l + 1, id: `couple_${l}_${l + 1}_${k}_up_fallback` });
                                    nextLevel.transition_zones.push({ x: savedX, z: savedZ, radius, targetLevel: l, id: `couple_${l}_${l + 1}_${k}_down_fallback` });
                                    fallbackPlaced = true;
                                    remoteLog(`[GEN] Fallback placed Zone Pair ${k} between L${l}-L${l + 1} at (${savedX.toFixed(1)}, ${savedZ.toFixed(1)}) after deterministic search`);
                                }
                            }
                        } catch (err) {
                            remoteLog(`[ERROR] Fallback placement error for Zone Pair ${k}: ${err.message}`, 'error');
                        }

                        if (!fallbackPlaced) {
                            remoteLog(`[GEN] Failed to place Zone Pair ${k} after ${maxPairAttempts} attempts and fallback search`);
                        }
                    }
                }

                // Summary log for this level pair: how many pairs were placed and their positions
                try {
                    const placedUpZones = (currentLevel.transition_zones || []).filter(t => t.targetLevel === l + 1);
                    if (placedUpZones.length > 0) {
                        const positions = placedUpZones.map(p => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).join('; ');
                        remoteLog(`[GEN] Summary: Placed ${placedUpZones.length} portal pair(s) between L${l}-L${l + 1}: ${positions}`);
                    } else {
                        remoteLog(`[GEN] Summary: Placed 0 portal pairs between L${l}-L${l + 1}`);
                    }
                } catch (err) {
                    remoteLog(`[ERROR] Failed to summarize portal placements for L${l}-L${l + 1}: ${err.message}`, 'error');
                }
            }

            // Global summary across all level pairs
            try {
                let totalPairs = 0;
                const allPositions = [];
                for (let l = 0; l < generatedPhysicalMap.levels.length - 1; l++) {
                    const ups = (generatedPhysicalMap.levels[l].transition_zones || []).filter(t => t.targetLevel === l + 1);
                    totalPairs += ups.length;
                    ups.forEach(p => allPositions.push(`L${l}->L${l + 1}@(${p.x.toFixed(1)},${p.z.toFixed(1)})`));
                }
                remoteLog(`[GEN] Total portal pairs generated across map: ${totalPairs}. Positions: ${allPositions.join('; ')}`);
            } catch (err) {
                remoteLog(`[ERROR] Failed to produce global portal summary: ${err.message}`, 'error');
            }

            setPhysicalMap(generatedPhysicalMap);
        }

        // Always regenerate minions to match new radius/distribution
        const newMinions = [];
        const minionKeys = ['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'];
        minionKeys.forEach(typeKey => {
            const mConfig = config[typeKey];
            if (mConfig.ENABLED) {
                for (let i = 0; i < mConfig.COUNT; i++) {
                    const assignedLevel = Math.floor(Math.random() * config.MAP_LEVELS);
                    let mx, mz;
                    let validPosition = false;
                    let attempt = 0;

                    // Try to find a position within coverage/capacity and OUTSIDE exclusion zones
                    while (!validPosition && attempt < 100) {
                        attempt++;
                        // Circular random position
                        const r = Math.sqrt(Math.random()) * (finalRadius * 0.9);
                        const theta = Math.random() * 2 * Math.PI;
                        mx = r * Math.cos(theta);
                        mz = r * Math.sin(theta);

                        // 1. Check if covered by any cell in this level
                        const levelData = newLevels[assignedLevel];
                        let isCovered = false;
                        if (levelData) {
                            for (const cell of levelData.cells) {
                                const dx = mx - cell.x;
                                const dz = mz - cell.z;
                                const dist = Math.sqrt(dx * dx + dz * dz);
                                const radius = cell.type === CELL_TYPES.COVERAGE ? covSpacing : capSpacing;
                                if (dist <= radius) {
                                    isCovered = true;
                                    break;
                                }
                            }
                        }
                        if (!isCovered) continue;

                        // 2. Check against Type-Specific Exclusion Zones (Obstacles)
                        const pMap = generatedPhysicalMap || physicalMap;
                        if (pMap && pMap.levels && pMap.levels[assignedLevel]) {
                            const typeKeyUpper = typeKey.toUpperCase();
                            const levelExclusions = pMap.levels[assignedLevel].type_exclusion_zones?.[typeKey] || [];
                            const mSize = config[typeKeyUpper]?.SIZE || 1.0;
                            const mHalf = mSize / 2;

                            let insideExclusion = false;
                            for (const zone of levelExclusions) {
                                const halfSize = zone.size / 2;
                                // Check if minion's bounding box intersects with obstacle's bounding box
                                if (Math.abs(mx - zone.x) < (halfSize + mHalf) &&
                                    Math.abs(mz - zone.z) < (halfSize + mHalf)) {
                                    insideExclusion = true;
                                    break;
                                }
                            }
                            if (insideExclusion) continue;
                        }

                        validPosition = true;
                    }

                    if (!validPosition) {
                        // Keep the last random position generated
                        // Ideally we should warn or retry, but for now we proceed
                    }

                    newMinions.push({
                        id: `${typeKey.toLowerCase()}_${i}`,
                        type: typeKey.toLowerCase(),
                        x: mx,
                        z: mz,
                        level: assignedLevel,
                        color: mConfig.COLOR,
                        covered: true // Will be validated below
                    });
                }
            }
        });
        remoteLog(`[GEN] Total Minions Generated: ${newMinions.length} across ${config.MAP_LEVELS} levels.`);

        // 4. On-Demand Activation Logic
        // "if minion in coverage of capacity cell --> turn on that cell --> ok for that minion"
        // "if no capacity cell --> turn on capacity/coverage cell"
        newMinions.forEach(minion => {
            const levelCells = newLevels[minion.level]?.cells || [];
            let handled = false;

            // Priority 1: Check Capacity Cells
            const capacityCells = levelCells.filter(c => c.type === CELL_TYPES.CAPACITY);
            for (const cap of capacityCells) {
                const dist = Math.sqrt((minion.x - cap.x) ** 2 + (minion.z - cap.z) ** 2);
                if (dist <= capSpacing) {
                    cap.active = true;

                    // NEW: Ensure this Capacity cell is backhauled!
                    // Search all levels for the nearest coverage cell
                    let bestBackhaul = null;
                    let minDist = Infinity;

                    newLevels.forEach(lvl => {
                        lvl.cells.filter(c => c.type === CELL_TYPES.COVERAGE).forEach(cov => {
                            const d = Math.sqrt((cap.x - cov.x) ** 2 + (cap.z - cov.z) ** 2);
                            if (d < config.COVERAGE_CELL_RADIUS && d < minDist) {
                                minDist = d;
                                bestBackhaul = cov;
                            }
                        });
                    });

                    if (bestBackhaul) {
                        bestBackhaul.active = true;
                    }

                    handled = true;
                    break; // Minion served by capacity
                }
            }

            // Priority 2: Check Coverage Cells if not served
            if (!handled) {
                const coverageCells = levelCells.filter(c => c.type === CELL_TYPES.COVERAGE);
                for (const cell of coverageCells) {
                    const dist = Math.sqrt((minion.x - cell.x) ** 2 + (minion.z - cell.z) ** 2);
                    if (dist <= covSpacing) {
                        cell.active = true;
                        handled = true;
                        break; // Minion served by coverage
                    }
                }
            }
        });

        // 5. Final Global Backhaul Validation
        // Ensure that the serving logic didn't miss anything that simulation might catch
        let validationFailed = false;
        newMinions.forEach(minion => {
            const level = newLevels[minion.level];
            const activeCoverageOnLevel = level.cells.filter(c => c.active && c.type === CELL_TYPES.COVERAGE);

            // Collect all functional capacity cells (active + backhauled)
            const allActiveCoverage = [];
            newLevels.forEach(l => allActiveCoverage.push(...l.cells.filter(c => c.active && c.type === CELL_TYPES.COVERAGE)));

            const functionalCapacityOnLevel = level.cells.filter(c => {
                if (!c.active || c.type !== CELL_TYPES.CAPACITY) return false;
                return allActiveCoverage.some(cov => {
                    const d = Math.sqrt((c.x - cov.x) ** 2 + (c.z - cov.z) ** 2);
                    return d < config.COVERAGE_CELL_RADIUS;
                });
            });

            const providers = [...activeCoverageOnLevel, ...functionalCapacityOnLevel];
            const isServed = providers.some(p => {
                const d = Math.sqrt((minion.x - p.x) ** 2 + (minion.z - p.z) ** 2);
                const r = p.type === CELL_TYPES.CAPACITY ? capSpacing : covSpacing;
                return d <= r;
            });

            if (!isServed) {
                remoteLog(`[WARN] Minion ${minion.id} is placed but NOT SERVED (likely backhaul gap)!`, 'warn');
                validationFailed = true;
            }
        });
        if (validationFailed) {
            remoteLog(`[GEN] Warning: Some minions could not be covered even after activation.`, 'warn');
        } else {
            remoteLog(`[GEN] Validation Success: All minions are covered.`, 'info');
        }

        setWorldState({ levels: newLevels, minions: newMinions });

        // Immediate evaluation after generation
        const { minionStates } = evaluateCoverage(newMinions, newLevels, config);
        setWorldState(prev => ({ ...prev, minions: minionStates }));

        setCurrentStep(0);
        setStatus('New Simulation Started');
        remoteLog(`[SIM] Simulation Initialized: ${newLevels.length} levels, ${newMinions.length} minions.`);
        setShowHint(false);
    }, [config]);


    // Reactive coverage update
    useEffect(() => {
        if (worldState.levels.length > 0) {
            remoteLog(`[SIM] Re-evaluating coverage due to config change...`);
            const { minionStates } = evaluateCoverage(worldState.minions, worldState.levels, config);
            setWorldState(prev => ({ ...prev, minions: minionStates }));
        }
    }, [worldState.levels, config.CAPACITY_CELL_RADIUS, config.COVERAGE_CELL_RADIUS]);

    const toggleCell = (levelId, cellId) => {
        setWorldState(prev => ({
            ...prev,
            levels: prev.levels.map(l => l.id === levelId ? {
                ...l,
                cells: l.cells.map(c => c.id === cellId ? { ...c, active: !c.active } : c)
            } : l)
        }));
        remoteLog(`[UI] Cell toggled: ${cellId} at level ${levelId}`);
    };

    const saveScenario = () => {
        const scenarioData = {
            timestamp: new Date().toISOString(),
            config: config,
            world: {
                levels: worldState.levels,
                minions: worldState.minions
            },
            physicalMap: physicalMap
        };

        const blob = new Blob([JSON.stringify(scenarioData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scenario_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        remoteLog('[UI] Scenario saved to JSON.');
    };

    const loadScenario = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.config && data.world && data.physicalMap) {
                    setConfig(data.config);
                    setWorldState(data.world);
                    setPhysicalMap(data.physicalMap);

                    // Recalculate radius if needed or trust the loaded config
                    const numCoverage = Math.max(0, data.config.COVERAGE_CELL_RADIUS > 0 ? data.config.COVERAGE_CELLS_COUNT : 0);
                    const totalCoverageArea = numCoverage * Math.PI * Math.pow(data.config.COVERAGE_CELL_RADIUS, 2);
                    const areaBasedRadius = Math.sqrt(totalCoverageArea / Math.PI);
                    setMapRadius(Math.max(80, areaBasedRadius * 1.2));

                    setCurrentStep(0);
                    setStatus('Scenario Loaded');
                    remoteLog('[UI] Scenario loaded successfully.');
                } else {
                    remoteLog('[ERROR] Invalid scenario file format.');
                }
            } catch (err) {
                remoteLog(`[ERROR] Failed to parse scenario file: ${err.message}`);
            }
        };
        reader.readAsText(file);
    };

    const fetchMapList = async () => {
        try {
            const response = await fetch('/api/maps');
            if (response.ok) {
                const list = await response.json();
                setMapList(list);
            }
        } catch (error) {
            remoteLog(`[ERROR] Failed to fetch map list: ${error.message}`);
        }
    };

    const saveToServer = async () => {
        const name = prompt('Enter a name for this map scenario:', `scenario_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
        if (!name) return;

        const scenarioData = {
            timestamp: new Date().toISOString(),
            config: config,
            world: {
                levels: worldState.levels,
                minions: worldState.minions
            },
            physicalMap: physicalMap
        };

        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.endsWith('.json') ? name : `${name}.json`, data: scenarioData })
            });

            if (response.ok) {
                remoteLog(`[UI] Map saved to server as ${name}`);
                fetchMapList(); // Refresh list
            } else {
                remoteLog('[ERROR] Failed to save map to server.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Server save error: ${error.message}`);
        }
    };

    const loadFromServer = async (filename) => {
        try {
            const response = await fetch(`/api/maps/${filename}`);
            if (response.ok) {
                const data = await response.json();
                if (data.config && data.world && data.physicalMap) {
                    // Merge loaded config with DEFAULT_CONFIG to ensure new keys exist
                    const mergedConfig = { ...DEFAULT_CONFIG };
                    for (const key in data.config) {
                        if (typeof data.config[key] === 'object' && data.config[key] !== null && !Array.isArray(data.config[key])) {
                            mergedConfig[key] = { ...mergedConfig[key], ...data.config[key] };
                        } else {
                            mergedConfig[key] = data.config[key];
                        }
                    }
                    setConfig(mergedConfig);
                    setWorldState(data.world);
                    setPhysicalMap(data.physicalMap);

                    const numCoverage = Math.max(0, data.config.COVERAGE_CELL_RADIUS > 0 ? data.config.COVERAGE_CELLS_COUNT : 0);
                    const totalCoverageArea = numCoverage * Math.PI * Math.pow(data.config.COVERAGE_CELL_RADIUS, 2);
                    const areaBasedRadius = Math.sqrt(totalCoverageArea / Math.PI);
                    setMapRadius(Math.max(80, areaBasedRadius * 1.2));

                    setCurrentStep(0);
                    setStatus(`Loaded: ${filename}`);
                    remoteLog(`[UI] Loaded map from server: ${filename}`);
                }
            } else {
                remoteLog('[ERROR] Failed to load map from server.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Server load error: ${error.message}`);
        }
    };

    const deleteFromServer = async (filename) => {
        if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
        try {
            const response = await fetch(`/api/maps/${filename}`, { method: 'DELETE' });
            if (response.ok) {
                remoteLog(`[UI] Deleted map from server: ${filename}`);
                fetchMapList(); // Refresh list
            } else {
                remoteLog('[ERROR] Failed to delete map from server.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Server delete error: ${error.message}`);
        }
    };

    const nextStep = () => {
        if (worldState.levels.length === 0) return;

        const { minionStates, failure } = evaluateCoverage(worldState.minions, worldState.levels, config);
        const movedMinions = minionStates.map(m => moveMinion(m, config, physicalMap));

        setWorldState(prev => ({ ...prev, minions: movedMinions }));
        setCurrentStep(prev => prev + 1);
        const stepMsg = failure ? `ALERT: ${failure}` : `Step ${currentStep + 1} Success`;
        setStatus(stepMsg);
        remoteLog(`[SIM] Step ${currentStep + 1}: ${stepMsg}`, failure ? 'warn' : 'info');
        setShowHint(false);
    };

    // Auto-load latest map on startup
    useEffect(() => {
        const init = async () => {
            try {
                const response = await fetch('/api/maps');
                if (response.ok) {
                    const list = await response.json();
                    if (list && list.length > 0) {
                        // Sort by name descending to get the latest timestamp
                        list.sort((a, b) => b.localeCompare(a));
                        const latest = list[0];
                        remoteLog(`[INIT] Auto-loading latest scenario: ${latest}`);
                        await loadFromServer(latest);
                        setMapList(list); // Also populate the list
                    } else {
                        // No maps available on server - generate a world locally
                        remoteLog('[INIT] No server maps found — generating local world.');
                        generateWorld(true);
                    }
                }
            } catch (e) {
                remoteLog(`[ERROR] Auto-load failed: ${e.message}`);
                // If auto-load fails (no server), generate a local world so UI isn't empty
                generateWorld(true);
            }
        };
        init();
    }, []);

    return (
        <div className="app-container">
            <div className="map-container">
                <div className="status-overlay">
                    <div className="status-title">{status}</div>
                    <div className="status-sub">Step {currentStep} / {config.TARGET_STEPS}</div>
                </div>

                <Canvas camera={{ position: [30, 40, 50], fov: 45 }}>
                    <color attach="background" args={['#06070a']} />
                    <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
                    <ambientLight intensity={0.2} />
                    <pointLight position={[30, 50, 30]} intensity={1.2} />
                    <Environment preset="night" />

                    {/* Coordinate Axes */}
                    {layerVisibility.axes && (
                        <group>
                            <axesHelper args={[mapRadius + 20]} />
                            <Text position={[mapRadius + 22, 0, 0]} fontSize={3} color="#ff4444">X</Text>
                            <Text position={[0, mapRadius + 22, 0]} fontSize={3} color="#44ff44">Y</Text>
                            <Text position={[0, 0, mapRadius + 22]} fontSize={3} color="#4444ff">Z</Text>
                        </group>
                    )}

                    <group>
                        {worldState.levels.map((level, lIndex) => {
                            const baseY = lIndex * config.LEVEL_DISTANCE;
                            return (
                                <group key={level.id}>
                                    {/* Level Floor Background (Dynamic Radius) */}
                                    <mesh position={[0, baseY + (layerOffsets.background?.offset || -0.1), 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
                                        <circleGeometry args={[mapRadius, 6]} />
                                        <meshStandardMaterial color="#f8f9ff" transparent opacity={0.15} metalness={0.2} roughness={0.5} />
                                    </mesh>
                                    <mesh position={[0, baseY + (layerOffsets.background?.offset || -0.1) + (layerOffsets.background?.sublayers?.wire || -0.01), 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
                                        <circleGeometry args={[mapRadius, 6]} />
                                        <meshStandardMaterial color="#ffffff" transparent opacity={0.2} wireframe />
                                    </mesh>
                                    {/* Level Label */}
                                    <Text
                                        position={[-mapRadius - 8, baseY + (layerOffsets.label?.offset || 0), 0]}
                                        rotation={[0, Math.PI / 2, 0]}
                                        fontSize={2.5}
                                        color="#00d2ff"
                                        anchorX="right"
                                        anchorY="middle"
                                    >
                                        {`LEVEL ${lIndex}`}
                                    </Text>
                                    {/* 1. Coverage Layer (Y=0) */}
                                    <group position={[0, baseY + (layerOffsets.coverage?.offset || 0), 0]} visible={layerVisibility.coverage}>
                                        {level.cells.filter(c => c.type === 'coverage').map(cell => (
                                            <HexCell
                                                key={`cov_${cell.id}`}
                                                position={[cell.x, 0, cell.z]}
                                                type={cell.type}
                                                active={cell.active}
                                                serviceRadius={config.COVERAGE_CELL_RADIUS}
                                                onClick={() => toggleCell(level.id, cell.id)}
                                            />
                                        ))}
                                    </group>

                                    {/* 2. Capacity Layer (Y=0.5) */}
                                    <group position={[0, baseY + (layerOffsets.capacity?.offset || 0.5), 0]} visible={layerVisibility.capacity}>
                                        {level.cells.filter(c => c.type === 'capacity').map(cell => (
                                            <HexCell
                                                key={`cap_${cell.id}`}
                                                position={[cell.x, 0, cell.z]}
                                                type={cell.type}
                                                active={cell.active}
                                                serviceRadius={config.CAPACITY_CELL_RADIUS}
                                                onClick={() => toggleCell(level.id, cell.id)}
                                            />
                                        ))}
                                    </group>

                                    {/* 3. Physical Layer (Y=1.0) - Infrastructure Map Features Only */}
                                    <group position={[0, baseY + (layerOffsets.physical?.offset || 1.0), 0]}>
                                        {physicalMap?.levels?.[lIndex] && (
                                            <group>
                                                {/* Transition Zones */}
                                                {layerVisibility.zone_PORTAL && (
                                                    (physicalMap.levels[lIndex].transition_zones ?? physicalMap.levels[lIndex].transition_areas?.map(a => ({ x: a.center?.x ?? a.x, z: a.center?.z ?? a.z, radius: a.radius ?? a.r ?? 0, id: a.id ?? a.name, targetLevel: a.target_level ?? a.targetLevel })))?.map((zone, i) => {
                                                        const radius = Number(zone.radius);
                                                        const portalYOffset = layerOffsets.physical?.sublayers?.portal ?? 0.02;
                                                        const portalLabelYOffset = layerOffsets.physical?.sublayers?.portalLabel ?? 1.0;
                                                        if (!Number.isFinite(radius) || radius <= 0) {
                                                            return (
                                                                <group key={`trans_${i}`} position={[zone.x, portalYOffset, zone.z]}>
                                                                    <Text
                                                                        position={[0, portalLabelYOffset, 0]}
                                                                        fontSize={1.2}
                                                                        color="#00ff88"
                                                                        billboard
                                                                    >
                                                                        PORTAL
                                                                    </Text>
                                                                </group>
                                                            );
                                                        }

                                                        return (
                                                            <group key={`trans_${i}`} position={[zone.x, portalYOffset, zone.z]}>
                                                                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                                                                    <ringGeometry args={[0, radius, 32]} />
                                                                    <meshStandardMaterial
                                                                        color="#00ff88"
                                                                        transparent
                                                                        opacity={0.3}
                                                                        emissive="#00ff88"
                                                                        emissiveIntensity={1.0}
                                                                    />
                                                                </mesh>
                                                                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                                                                    <ringGeometry args={[radius * 0.9, radius, 32]} />
                                                                    <meshStandardMaterial color="#ffffff" />
                                                                </mesh>
                                                                {/* Floating Label */}
                                                                <Text
                                                                    position={[0, portalLabelYOffset, 0]}
                                                                    fontSize={1.2}
                                                                    color="#00ff88"
                                                                    billboard
                                                                >
                                                                    PORTAL
                                                                </Text>
                                                            </group>
                                                        );
                                                    })
                                                )}

                                                {/* Type-Specific Exclusion Zones (Stacked Layers) */}
                                                {['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'].map((typeKey, tIndex) => {
                                                    const zones = physicalMap.levels[lIndex].type_exclusion_zones?.[typeKey];
                                                    if (!zones) return null;

                                                    // Check individual visibility
                                                    if (!layerVisibility[`zone_${typeKey}`]) return null;
                                                    const layerY = (layerOffsets.physical?.sublayers && layerOffsets.physical?.sublayers[typeKey] !== undefined)
                                                        ? layerOffsets.physical?.sublayers[typeKey]
                                                        : (0.1 + (tIndex * 0.1));
                                                    const color = config[typeKey]?.COLOR || '#ffffff';

                                                    return (
                                                        <group key={typeKey} position={[0, layerY, 0]}>
                                                            {zones.map((zone, zIndex) => (
                                                                <group key={`${typeKey}_${zIndex}`} position={[zone.x, 0, zone.z]}>
                                                                    <mesh>
                                                                        <boxGeometry args={[zone.size, 0.05, zone.size]} />
                                                                        <meshStandardMaterial
                                                                            color={color}
                                                                            transparent
                                                                            opacity={0.2}
                                                                            emissive={color}
                                                                            emissiveIntensity={0.5}
                                                                        />
                                                                    </mesh>
                                                                    <mesh>
                                                                        <boxGeometry args={[zone.size, 0.05, zone.size]} />
                                                                        <meshStandardMaterial color={color} wireframe transparent opacity={0.5} />
                                                                    </mesh>
                                                                    {/* Label for the zone type */}
                                                                    {zIndex === 0 && ( // Only label the first one to reduce clutter
                                                                        <Text
                                                                            position={[0, 0.5, 0]}
                                                                            fontSize={1.5}
                                                                            color={color}
                                                                            billboard
                                                                        >
                                                                            {typeKey} ZONE
                                                                        </Text>
                                                                    )}
                                                                </group>
                                                            ))}
                                                        </group>
                                                    );
                                                })}
                                            </group>
                                        )}
                                    </group>

                                    {/* 4. Minion Layer (Y=1.5) */}
                                    <group visible={layerVisibility.minions}>
                                        {worldState.minions
                                            .filter(m => m.level === lIndex && layerVisibility[`minion_${m.type.toUpperCase()}`] !== false)
                                            .map(minion => (
                                                <Minion
                                                    key={minion.id}
                                                    position={[minion.x, baseY + (layerOffsets.minion?.offset || 1.5), minion.z]}
                                                    type={minion.type}
                                                    color={minion.color}
                                                    label={minion.type.charAt(0).toUpperCase()}
                                                    size={config[minion.type.toUpperCase()]?.SIZE || 1.0}
                                                />
                                            ))}
                                    </group>
                                </group>
                            );
                        })}
                    </group>

                    <OrbitControls
                        ref={orbitRef}
                        makeDefault
                        onChange={handleCameraChange}
                    />
                </Canvas>
            </div>

            <Sidebar
                config={config}
                setConfig={setConfig}
                currentStep={currentStep}
                onGenerate={() => generateWorld(true)}
                onStep={nextStep}
                onHint={() => {
                    setShowHint(!showHint);
                    remoteLog(`[UI] Hint toggled: ${!showHint}`);
                }}
                onSave={saveScenario}
                onSaveServer={saveToServer}
                onLoad={loadScenario}
                onLoadServer={loadFromServer}
                onDeleteServer={deleteFromServer}
                onReset={resetSettings}
                mapList={mapList}
                onFetchMaps={fetchMapList}
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
            />
        </div>
    );
};

export default App;
