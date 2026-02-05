import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Text } from '@react-three/drei';
import Sidebar from './components/Sidebar';
import HexCell from './components/HexCell';
import Minion from './components/Minion';
import { useAuth } from './context/AuthContext';
import { DEFAULT_CONFIG } from './config';
import { moveMinion, evaluateCoverage } from './engine/simulation';
import { generateWorld as generateWorldEngine } from './engine/generation';
import { remoteLog } from './utils/logger';


const GameApp = () => {
    const { user, isGuest, login, register, logout } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleLoginFromGuest = useCallback(async (username, password) => {
        await login(username, password);
        setShowLoginModal(false);
    }, [login]);

    const handleRegisterFromGuest = useCallback(async (username, password) => {
        await register(username, password);
        setShowLoginModal(false);
    }, [register]);

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
    const [totalEnergyConsumed, setTotalEnergyConsumed] = useState(() => {
        const saved = localStorage.getItem('goc_totalEnergyConsumed');
        return saved ? parseFloat(saved) : 0;
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
        localStorage.setItem('goc_currentStep', currentStep.toString());
    }, [currentStep]);

    useEffect(() => {
        localStorage.setItem('goc_totalEnergyConsumed', (totalEnergyConsumed || 0).toString());
    }, [totalEnergyConsumed]);

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

    // API Sync States
    const [useBackend, setUseBackend] = useState(true);
    const [autoSync, setAutoSync] = useState(true);
    const [lastApiStepResult, setLastApiStepResult] = useState(null);

    const fetchApiState = useCallback(async () => {
        try {
            const response = await fetch('/api/player/get-state');
            const data = await response.json();
            if (data.worldState) {
                setWorldState(data.worldState);
                if (data.physicalMap) setPhysicalMap(data.physicalMap);
                if (data.config) setConfig(data.config);
                if (data.lastResult) setLastApiStepResult(data.lastResult);
                if (data.currentStep !== undefined) setCurrentStep(data.currentStep);
                if (data.totalEnergyConsumed !== undefined) setTotalEnergyConsumed(data.totalEnergyConsumed);

                // Update radius if physical map changed
                if (data.physicalMap && data.physicalMap.levels) {
                    // Logic to update mapRadius if needed
                }
            }
        } catch (err) {
            remoteLog(`[API] Sync failed: ${err.message}`, 'error');
        }
    }, [setConfig, setCurrentStep, setTotalEnergyConsumed]);

    useEffect(() => {
        let interval;
        if (autoSync) {
            interval = setInterval(fetchApiState, 2000);
        }
        return () => clearInterval(interval);
    }, [autoSync, fetchApiState]);

    const handleToggleAutoSync = () => {
        setAutoSync(prev => !prev);
        if (!autoSync) {
            remoteLog('[API] Auto-sync enabled. Polling server state...');
        }
    };
    // Initialize world on mount
    // Initialize world on mount - REMOVED to prevent auto-generation on reload

    const generateWorld = useCallback(async (resetMap = false) => {
        if (useBackend) {
            remoteLog('[API] Generating world via backend...');
            try {
                // First sync config to backend
                await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });

                // Then trigger generation
                const resp = await fetch('/api/generate', { method: 'POST' });
                const data = await resp.json();

                if (data.worldState) {
                    setWorldState(data.worldState);
                    setPhysicalMap(data.physicalMap);
                    setMapRadius(data.mapRadius);
                    setCurrentStep(0);
                    setTotalEnergyConsumed(0);
                    setLastApiStepResult(null);
                    setStatus('New Backend Simulation Started');
                    remoteLog(`[API] Generated: ${data.worldState.levels.length} levels, ${data.worldState.minions.length} minions.`);
                }
            } catch (err) {
                remoteLog(`[ERROR] Backend generation failed: ${err.message}`, 'error');
            }
            return;
        }

        const logger = {
            log: (msg) => remoteLog(msg, 'info'),
            warn: (msg) => remoteLog(msg, 'warn'),
            error: (msg) => remoteLog(msg, 'error')
        };

        const { worldState: newWorldState, physicalMap: newPhysicalMap, mapRadius: newRadius } = generateWorldEngine(
            config,
            physicalMap,
            resetMap,
            logger
        );

        setMapRadius(newRadius);
        setPhysicalMap(newPhysicalMap);
        setWorldState(newWorldState);

        // Immediate evaluation after generation
        const { minionStates } = evaluateCoverage(newWorldState.minions, newWorldState.levels, config);
        setWorldState(prev => ({ ...prev, minions: minionStates }));

        setCurrentStep(0);
        setStatus('New Simulation Started');
        remoteLog(`[SIM] Simulation Initialized: ${newWorldState.levels.length} levels, ${newWorldState.minions.length} minions.`);
        setShowHint(false);
    }, [config, physicalMap, useBackend]);


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

    const nextStep = async () => {
        if (worldState.levels.length === 0) return;

        if (useBackend) {
            remoteLog('[API] Executing next step via backend...');
            try {
                // Calculate the list of cells that are currently ON
                const activeCellIds = worldState.levels.flatMap(level =>
                    level.cells.filter(cell => cell.active).map(cell => cell.id)
                );

                const response = await fetch('/api/player/step', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ on: activeCellIds })
                });
                const data = await response.json();
                if (data.worldState) {
                    setWorldState(data.worldState);
                    if (data.currentStep !== undefined) setCurrentStep(data.currentStep);
                    setTotalEnergyConsumed(data.totalEnergyConsumed);

                    if (data.gameOver) {
                        setStatus(`GAME OVER: ${data.msg}`);
                        setLastApiStepResult({
                            msg: data.msg,
                            failure: data.msg,
                            cellsShouldBeOn: data.cellsShouldBeOn || [],
                            energyConsumed: data.energyConsumed,
                            totalEnergyConsumed: data.totalEnergyConsumed,
                            energyLeft: data.energyLeft
                        });
                        remoteLog(`[API] Step ${data.currentStep} Failed: ${data.msg}`, 'error');
                    } else {
                        const energyInfo = `Energy: ${(data.energyConsumed || 0).toFixed(1)} (Total: ${(data.totalEnergyConsumed || 0).toFixed(1)}/${config.TOTAL_ENERGY}, Left: ${(data.energyLeft || 0).toFixed(1)})`;
                        const stepMsg = `Step ${data.currentStep} Success - ${energyInfo}`;
                        setStatus(stepMsg);
                        setLastApiStepResult({
                            msg: data.msg,
                            energyConsumed: data.energyConsumed,
                            totalEnergyConsumed: data.totalEnergyConsumed,
                            energyLeft: data.energyLeft
                        });
                        remoteLog(`[API] ${stepMsg}`);
                    }
                }
            } catch (err) {
                remoteLog(`[ERROR] Backend step failed: ${err.message}`, 'error');
            }
            return;
        }

        const { minionStates, failure } = evaluateCoverage(worldState.minions, worldState.levels, config);
        const movedMinions = minionStates.map(m => moveMinion(m, config, physicalMap));

        setWorldState(prev => ({ ...prev, minions: movedMinions }));
        setCurrentStep(prev => prev + 1);
        const stepMsg = failure ? `ALERT: ${failure}` : `Step ${currentStep + 1} Success`;
        setStatus(stepMsg);
        remoteLog(`[SIM] Step ${currentStep + 1}: ${stepMsg}`, failure ? 'warn' : 'info');
        setShowHint(false);
    };

    const restartGame = async () => {
        try {
            remoteLog('[API] Restarting game...');
            const response = await fetch('/api/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.worldState) {
                setWorldState(data.worldState);
                setPhysicalMap(data.physicalMap);
                setMapRadius(data.mapRadius);
                setCurrentStep(0);
                setTotalEnergyConsumed(0);
                setStatus('Game Restarted');
                setLastApiStepResult(null);
                remoteLog('[API] Game restarted successfully');
            }
        } catch (err) {
            remoteLog(`[ERROR] Restart failed: ${err.message}`, 'error');
        }
    };

    const undoStep = async () => {
        try {
            remoteLog('[API] Undoing last step...');
            const response = await fetch('/api/undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.worldState) {
                setWorldState(data.worldState);
                if (data.physicalMap) setPhysicalMap(data.physicalMap);
                setCurrentStep(data.currentStep);
                setTotalEnergyConsumed(data.totalEnergyConsumed);
                setStatus(`Undone to Step ${data.currentStep}`);
                setLastApiStepResult(null);
                remoteLog(`[API] Undone to step ${data.currentStep}`);
            } else {
                setStatus(data.msg || 'Cannot undo');
                remoteLog(`[API] Undo failed: ${data.msg}`, 'warn');
            }
        } catch (err) {
            remoteLog(`[ERROR] Undo failed: ${err.message}`, 'error');
        }
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
                    <div className="status-sub">Step {currentStep} / {config.TARGET_STEPS} | Energy Left: {(config.TOTAL_ENERGY - totalEnergyConsumed).toFixed(1)}</div>
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

                            const isGameOver = !!lastApiStepResult?.failure;

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
                                                shouldBeOn={cell.shouldBeOn}
                                                isGameOver={isGameOver}
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
                                                shouldBeOn={cell.shouldBeOn}
                                                isGameOver={isGameOver}
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
                                                    isUncovered={!minion.covered}
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
                user={user}
                isGuest={isGuest}
                onLogout={logout}
                onShowLogin={isGuest ? () => setShowLoginModal(true) : undefined}
                showLoginModal={showLoginModal}
                onCloseLoginModal={() => setShowLoginModal(false)}
                onLoginFromGuest={handleLoginFromGuest}
                onRegisterFromGuest={handleRegisterFromGuest}
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
                onRestart={restartGame}
                onUndo={undoStep}
                mapList={mapList}
                onFetchMaps={fetchMapList}
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
                useBackend={useBackend}
                setUseBackend={setUseBackend}
                autoSync={autoSync}
                onToggleAutoSync={handleToggleAutoSync}
                lastApiStepResult={lastApiStepResult}
            />
        </div>
    );
};

export default GameApp;
