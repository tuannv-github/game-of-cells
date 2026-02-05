import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Text } from '@react-three/drei';
import Sidebar from './components/Sidebar';
import HexCell from './components/HexCell';
import Minion from './components/Minion';
import { useAuth } from './context/AuthContext';
import { DEFAULT_CONFIG, getGenerationConfig } from './config';
import { moveMinion, evaluateCoverage } from './engine/simulation';
import { generateScenario } from './engine/generation';
import { remoteLog } from './utils/logger';


const GameApp = () => {
    const { user, isGuest, isAdmin, token, login, register, logout } = useAuth();
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
        // Load generation config (scenario params); fallback to legacy goc_config
        const genSaved = localStorage.getItem('goc_generationConfig') || localStorage.getItem('goc_config');
        const viewSaved = localStorage.getItem('goc_viewConfig');
        const merged = { ...DEFAULT_CONFIG };
        if (genSaved) {
            try {
                const parsed = JSON.parse(genSaved);
                for (const key in parsed) {
                    if (key === 'difficulty') continue; // no longer in generation config
                    if (typeof parsed[key] === 'object' && parsed[key] !== null && !Array.isArray(parsed[key])) {
                        merged[key] = { ...merged[key], ...parsed[key] };
                    } else {
                        merged[key] = parsed[key];
                    }
                }
            } catch (e) { /* use defaults */ }
        }
        if (viewSaved) {
            try {
                const view = JSON.parse(viewSaved);
                if (view.LAYER_OFFSETS) merged.LAYER_OFFSETS = { ...merged.LAYER_OFFSETS, ...view.LAYER_OFFSETS };
            } catch (e) { /* use defaults */ }
        }
        return merged;
    });
    const [currentStep, setCurrentStep] = useState(() => {
        const saved = localStorage.getItem('goc_currentStep');
        return saved ? parseInt(saved) : 0;
    });
    const [totalEnergyConsumed, setTotalEnergyConsumed] = useState(() => {
        const saved = localStorage.getItem('goc_totalEnergyConsumed');
        return saved ? parseFloat(saved) : 0;
    });
    const [scenarioState, setScenarioState] = useState(() => {
        const saved = localStorage.getItem('goc_scenarioState');
        return saved ? JSON.parse(saved) : { levels: [], minions: [] };
    });
    const [status, setStatus] = useState('Standby');
    const [physicalMap, setPhysicalMap] = useState(() => {
        const saved = localStorage.getItem('goc_physicalMap');
        return saved ? JSON.parse(saved) : null;
    });
    const [showHint, setShowHint] = useState(false);
    const [mapRadius, setMapRadius] = useState(() => {
        const view = localStorage.getItem('goc_viewConfig');
        if (view) try { const v = JSON.parse(view); if (v.mapRadius != null) return v.mapRadius; } catch (e) {}
        const saved = localStorage.getItem('goc_mapRadius');
        return saved ? JSON.parse(saved) : 50;
    });
    const layerVisibilityDefaults = {
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
        minion_DRONE: true,
        minionRange: true
    };
    const [layerVisibility, setLayerVisibility] = useState(() => {
        const view = localStorage.getItem('goc_viewConfig');
        if (view) try { const v = JSON.parse(view); if (v.layerVisibility) return { ...layerVisibilityDefaults, ...v.layerVisibility }; } catch (e) {}
        const saved = localStorage.getItem('goc_visibility');
        return saved ? { ...layerVisibilityDefaults, ...JSON.parse(saved) } : layerVisibilityDefaults;
    });

    const [mapList, setMapList] = useState([]);
    const orbitRef = useRef();
    const configRef = useRef(config);
    configRef.current = config;

    // Persist settings to localStorage (split: generation vs viewing)
    useEffect(() => {
        localStorage.setItem('goc_generationConfig', JSON.stringify(getGenerationConfig(config)));
    }, [config]);

    useEffect(() => {
        const prev = localStorage.getItem('goc_viewConfig');
        let viewConfig = { layerVisibility, mapRadius, LAYER_OFFSETS: config.LAYER_OFFSETS };
        if (prev) try { const p = JSON.parse(prev); if (p.camera) viewConfig.camera = p.camera; } catch (e) {}
        localStorage.setItem('goc_viewConfig', JSON.stringify(viewConfig));
    }, [layerVisibility, mapRadius, config.LAYER_OFFSETS]);

    useEffect(() => {
        if (scenarioState) localStorage.setItem('goc_scenarioState', JSON.stringify(scenarioState));
    }, [scenarioState]);

    useEffect(() => {
        if (physicalMap) localStorage.setItem('goc_physicalMap', JSON.stringify(physicalMap));
    }, [physicalMap]);

    useEffect(() => {
        localStorage.setItem('goc_currentStep', currentStep.toString());
    }, [currentStep]);

    useEffect(() => {
        localStorage.setItem('goc_totalEnergyConsumed', (totalEnergyConsumed || 0).toString());
    }, [totalEnergyConsumed]);

    // Handle Camera View persistence (stored in goc_viewConfig)
    const handleCameraChange = useCallback((e) => {
        if (!orbitRef.current) return;
        const camera = orbitRef.current.object;
        const target = orbitRef.current.target;
        const cameraState = {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [target.x, target.y, target.z]
        };
        const view = localStorage.getItem('goc_viewConfig');
        let viewConfig = view ? (() => { try { return JSON.parse(view); } catch (e) { return {}; } })() : {};
        viewConfig.camera = cameraState;
        localStorage.setItem('goc_viewConfig', JSON.stringify(viewConfig));
    }, []);

    useEffect(() => {
        const view = localStorage.getItem('goc_viewConfig');
        const savedCamera = view ? (() => { try { const v = JSON.parse(view); return v.camera ? JSON.stringify(v.camera) : null; } catch (e) { return null; } })() : localStorage.getItem('goc_camera');
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

    // API Sync States (players always use backend; guest = local only)
    const useBackend = !isGuest;
    const [autoSync, setAutoSync] = useState(false);
    const [lastApiStepResult, setLastApiStepResult] = useState(null);

    const getAuthHeaders = useCallback(() => {
        const authToken = token || localStorage.getItem('goc_token');
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        return headers;
    }, [token]);

    const fetchApiState = useCallback(async () => {
        try {
            const response = await fetch('/api/player/get-state', { headers: getAuthHeaders() });
            const data = await response.json();
            const state = data.scenarioState ?? data.worldState;
            if (state) {
                setScenarioState(state);
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
    }, [getAuthHeaders]);

    useEffect(() => {
        let interval;
        if (autoSync && !isAdmin && useBackend) {
            interval = setInterval(fetchApiState, 2000);
        }
        return () => clearInterval(interval);
    }, [autoSync, isAdmin, useBackend, fetchApiState]);

    // On login (non-guest, useBackend): init player scenario (create dir, copy easy if new user, load into server)
    useEffect(() => {
        if (!user || isGuest || !useBackend) return;
        const initPlayer = async () => {
            try {
                const response = await fetch('/api/player/init', {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    const state = data.scenarioState ?? data.worldState;
                    if (state) {
                        setScenarioState(state);
                        if (data.physicalMap) setPhysicalMap(data.physicalMap);
                        if (data.config) setConfig(prev => ({ ...prev, ...data.config }));
                        if (data.mapRadius != null) setMapRadius(data.mapRadius);
                        setCurrentStep(data.currentStep ?? 0);
                        setTotalEnergyConsumed(data.totalEnergyConsumed ?? 0);
                        setStatus(`Scenario loaded (step ${data.currentStep ?? 0})`);
                        remoteLog('[API] Player scenario initialized');
                    }
                }
            } catch (err) {
                remoteLog(`[API] Init failed: ${err.message}`, 'error');
            }
        };
        initPlayer();
    }, [user?.id, isGuest, useBackend, getAuthHeaders]); // Run when user logs in

    const handleToggleAutoSync = () => {
        setAutoSync(prev => !prev);
        if (!autoSync) {
            remoteLog('[API] Auto-sync enabled. Polling server state...');
        }
    };

    const fetchMapList = useCallback(async () => {
        try {
            const response = await fetch('/api/maps', { headers: getAuthHeaders() });
            if (response.ok) {
                const list = await response.json();
                setMapList(list);
            } else if (response.status === 401) {
                setMapList([]);
                remoteLog('[UI] Log in to view your saved scenarios.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Failed to fetch map list: ${error.message}`);
        }
    }, [getAuthHeaders]);

    const saveScenarioToServer = useCallback(async (filename, scenarioData) => {
        const name = filename.endsWith('.json') ? filename : `${filename}.json`;
        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, data: scenarioData })
            });
            if (response.ok) {
                remoteLog(`[UI] Scenario saved to server as ${name}`);
                fetchMapList();
            } else {
                const err = await response.json().catch(() => ({}));
                remoteLog(`[ERROR] ${err.error || 'Failed to save map to server.'}`);
            }
        } catch (error) {
            remoteLog(`[ERROR] Server save error: ${error.message}`);
        }
    }, [fetchMapList, getAuthHeaders]);

    // Initialize scenario on mount - REMOVED to prevent auto-generation on reload
    const generateScenario = useCallback(async (resetMap = false) => {
        if (useBackend && isAdmin) {
            remoteLog('[API] Generating scenario via backend...');
            const authToken = token || localStorage.getItem('goc_token');
            if (!authToken) {
                setStatus('Error: Please log in as admin to generate');
                remoteLog('[ERROR] No auth token. Log in as admin.', 'error');
                return;
            }
            try {
                const genConfig = getGenerationConfig(configRef.current);
                const resp = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ config: genConfig })
                });
                const data = await resp.json();

                if (!resp.ok) {
                    const msg = data.error || 'Generation failed';
                    setStatus(`Error: ${msg}`);
                    remoteLog(`[ERROR] ${msg}`, 'error');
                    return;
                }
                const state = data.scenarioState ?? data.worldState;
                if (state) {
                    setScenarioState(state);
                    setPhysicalMap(data.physicalMap);
                    setMapRadius(data.mapRadius);
                    setCurrentStep(0);
                    setTotalEnergyConsumed(0);
                    setLastApiStepResult(null);
                    setStatus('New Backend Simulation Started');
                    remoteLog(`[API] Generated: ${state.levels.length} levels, ${state.minions.length} minions.`);
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

        const { scenarioState: newScenarioState, physicalMap: newPhysicalMap, mapRadius: newRadius } = generateScenario(
            configRef.current,
            physicalMap,
            resetMap,
            logger
        );

        setMapRadius(newRadius);
        setPhysicalMap(newPhysicalMap);
        setScenarioState(newScenarioState);

        // Immediate evaluation after generation
        const { minionStates } = evaluateCoverage(newScenarioState.minions, newScenarioState.levels, configRef.current);
        setScenarioState(prev => ({ ...prev, minions: minionStates }));

        setCurrentStep(0);
        setStatus('New Simulation Started');
        remoteLog(`[SIM] Simulation Initialized: ${newScenarioState.levels.length} levels, ${newScenarioState.minions.length} minions.`);
        setShowHint(false);
    }, [config, physicalMap, useBackend, isAdmin, token]);


    // Reactive coverage update
    useEffect(() => {
        if (scenarioState.levels.length > 0) {
            remoteLog(`[SIM] Re-evaluating coverage due to config change...`);
            const { minionStates } = evaluateCoverage(scenarioState.minions, scenarioState.levels, config);
            setScenarioState(prev => ({ ...prev, minions: minionStates }));
        }
    }, [scenarioState.levels, config.CAPACITY_CELL_RADIUS, config.COVERAGE_CELL_RADIUS]);

    const toggleCell = (levelId, cellId) => {
        setScenarioState(prev => ({
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
            config: getGenerationConfig(config),
            scenarioState: {
                levels: scenarioState.levels,
                minions: scenarioState.minions
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
                if (data.config && (data.scenarioState || data.world) && data.physicalMap) {
                    const merged = { ...DEFAULT_CONFIG };
                    for (const key in data.config) {
                        if (key === 'difficulty') continue;
                        if (typeof data.config[key] === 'object' && data.config[key] !== null && !Array.isArray(data.config[key])) {
                            merged[key] = { ...merged[key], ...data.config[key] };
                        } else {
                            merged[key] = data.config[key];
                        }
                    }
                    setConfig(merged);
                    setScenarioState(data.scenarioState || data.world);
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

    const saveToServer = useCallback(async () => {
        const name = prompt('Enter a name for this scenario:', `scenario_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
        if (!name) return;
        const scenarioData = {
            timestamp: new Date().toISOString(),
            config: getGenerationConfig(config),
            scenarioState: { levels: scenarioState.levels, minions: scenarioState.minions },
            physicalMap: physicalMap
        };
        await saveScenarioToServer(name.endsWith('.json') ? name : `${name}.json`, scenarioData);
    }, [config, scenarioState, physicalMap, saveScenarioToServer]);

    const saveToServerAs = useCallback(async (difficulty) => {
        const scenarioData = {
            timestamp: new Date().toISOString(),
            config: getGenerationConfig(config),
            scenarioState: { levels: scenarioState.levels, minions: scenarioState.minions },
            physicalMap: physicalMap
        };
        await saveScenarioToServer(difficulty, scenarioData);
        setStatus(`Saved as ${difficulty}`);
    }, [config, scenarioState, physicalMap, saveScenarioToServer]);

    const loadFromServer = useCallback(async (filename) => {
        try {
            const response = await fetch(`/api/maps/${filename}`, { headers: getAuthHeaders() });
            if (response.ok) {
                const data = await response.json();
                if (data.config && (data.scenarioState || data.world) && data.physicalMap) {
                    const mergedConfig = { ...DEFAULT_CONFIG };
                    for (const key in data.config) {
                        if (key === 'difficulty') continue;
                        if (typeof data.config[key] === 'object' && data.config[key] !== null && !Array.isArray(data.config[key])) {
                            mergedConfig[key] = { ...mergedConfig[key], ...data.config[key] };
                        } else {
                            mergedConfig[key] = data.config[key];
                        }
                    }
                    setConfig(mergedConfig);
                    setScenarioState(data.scenarioState || data.world);
                    setPhysicalMap(data.physicalMap);

                    const numCoverage = Math.max(0, data.config.COVERAGE_CELL_RADIUS > 0 ? data.config.COVERAGE_CELLS_COUNT : 0);
                    const totalCoverageArea = numCoverage * Math.PI * Math.pow(data.config.COVERAGE_CELL_RADIUS, 2);
                    const areaBasedRadius = Math.sqrt(totalCoverageArea / Math.PI);
                    setMapRadius(data.mapRadius ?? Math.max(80, areaBasedRadius * 1.2));
                    setCurrentStep(data.currentStep ?? 0);
                    setTotalEnergyConsumed(data.totalEnergyConsumed ?? 0);
                    setStatus(`Loaded: ${filename} (step ${data.currentStep ?? 0})`);
                    remoteLog(`[UI] Loaded map from server: ${filename}`);
                }
            } else {
                remoteLog('[ERROR] Failed to load map from server.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Server load error: ${error.message}`);
        }
    }, [getAuthHeaders]);

    const deleteFromServer = useCallback(async (filename) => {
        if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
        try {
            const response = await fetch(`/api/maps/${filename}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (response.ok) {
                remoteLog(`[UI] Deleted map from server: ${filename}`);
                fetchMapList(); // Refresh list
            } else {
                remoteLog('[ERROR] Failed to delete map from server.');
            }
        } catch (error) {
            remoteLog(`[ERROR] Server delete error: ${error.message}`);
        }
    }, [getAuthHeaders, fetchMapList]);

    const nextStep = async () => {
        if (scenarioState.levels.length === 0) return;

        if (useBackend) {
            remoteLog('[API] Executing next step via backend...');
            try {
                // Calculate the list of cells that are currently ON
                const activeCellIds = scenarioState.levels.flatMap(level =>
                    level.cells.filter(cell => cell.active).map(cell => cell.id)
                );

                const response = await fetch('/api/player/step', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ on: activeCellIds })
                });
                const data = await response.json();
                if (data.scenarioState) {
                    setScenarioState(data.scenarioState);
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

        const { minionStates, failure } = evaluateCoverage(scenarioState.minions, scenarioState.levels, config);
        const movedMinions = minionStates.map(m => moveMinion(m, config, physicalMap, scenarioState.levels));

        setScenarioState(prev => ({ ...prev, minions: movedMinions }));
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
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.scenarioState) {
                setScenarioState(data.scenarioState);
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

    const changeDifficulty = async (difficulty) => {
        try {
            remoteLog(`[API] Changing difficulty to ${difficulty}...`);
            const response = await fetch('/api/player/change-difficulty', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ difficulty })
            });
            const data = await response.json();

            if (!response.ok) {
                setStatus(data.error || 'Failed to change difficulty');
                remoteLog(`[ERROR] ${data.error || 'Change difficulty failed'}`, 'error');
                return;
            }
            if (data.scenarioState) {
                if (data.config) {
                    const merged = { ...DEFAULT_CONFIG };
                    for (const key in data.config) {
                        if (key === 'difficulty') continue;
                        if (typeof data.config[key] === 'object' && data.config[key] !== null && !Array.isArray(data.config[key])) {
                            merged[key] = { ...merged[key], ...data.config[key] };
                        } else {
                            merged[key] = data.config[key];
                        }
                    }
                    setConfig(merged);
                }
                setScenarioState(data.scenarioState);
                setPhysicalMap(data.physicalMap);
                setMapRadius(data.mapRadius);
                setCurrentStep(0);
                setTotalEnergyConsumed(0);
                setStatus(`Loaded ${difficulty}`);
                setLastApiStepResult(null);
                remoteLog(`[API] Difficulty changed to ${difficulty}`);
            }
        } catch (err) {
            remoteLog(`[ERROR] Change difficulty failed: ${err.message}`, 'error');
        }
    };

    const undoStep = async () => {
        try {
            remoteLog('[API] Undoing last step...');
            const response = await fetch('/api/undo', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.scenarioState) {
                setScenarioState(data.scenarioState);
                if (data.physicalMap) setPhysicalMap(data.physicalMap);
                if (data.mapRadius != null) setMapRadius(data.mapRadius);
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

    // Auto-load on startup: guests get 401 -> generate locally; logged-in with useBackend -> init effect loads
    useEffect(() => {
        if (user && !isGuest && useBackend) return; // init effect handles logged-in users
        const init = async () => {
            try {
                const response = await fetch('/api/maps', { headers: getAuthHeaders() });
                if (response.ok) {
                    const list = await response.json();
                    if (list && list.length > 0) {
                        const stepFiles = list.filter(f => /^step_\d+\.json$/.test(f));
                        const latest = stepFiles.length > 0
                            ? stepFiles.sort((a, b) => parseInt(b.replace(/\D/g, ''), 10) - parseInt(a.replace(/\D/g, ''), 10))[0]
                            : list.includes('initial.json') ? 'initial.json' : list[0];
                        remoteLog(`[INIT] Auto-loading scenario: ${latest}`);
                        await loadFromServer(latest);
                        setMapList(list);
                    } else {
                        remoteLog('[INIT] No maps — generating local scenario.');
                        generateScenario(true);
                    }
                } else if (response.status === 401) {
                    remoteLog('[INIT] Guest — generating local scenario.');
                    generateScenario(true);
                }
            } catch (e) {
                remoteLog(`[ERROR] Auto-load failed: ${e.message}`);
                if (scenarioState.levels.length === 0) generateScenario(true);
            }
        };
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

    return (
        <div className="app-container">
            <div className="map-container">
                <div className="status-overlay">
                    <div className="status-title">{status}</div>
                    <div className="status-sub">Step {currentStep} / {config.TARGET_STEPS} | Energy Left: {((Number(config.TOTAL_ENERGY) || 0) - (Number(totalEnergyConsumed) || 0) || 0).toFixed(1)}</div>
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
                        {scenarioState.levels.map((level, lIndex) => {
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
                                        {scenarioState.minions
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
                                                    maxMove={config[minion.type.toUpperCase()]?.MAX_MOVE ?? 6}
                                                    showRange={layerVisibility.minionRange}
                                                    currentStep={currentStep}
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
                isAdmin={isAdmin}
                token={token}
                onLogout={logout}
                onShowLogin={isGuest ? () => setShowLoginModal(true) : undefined}
                showLoginModal={showLoginModal}
                onCloseLoginModal={() => setShowLoginModal(false)}
                onLoginFromGuest={handleLoginFromGuest}
                onRegisterFromGuest={handleRegisterFromGuest}
                config={config}
                setConfig={setConfig}
                currentStep={currentStep}
                onGenerate={() => generateScenario(true)}
                onStep={nextStep}
                onHint={() => {
                    setShowHint(!showHint);
                    remoteLog(`[UI] Hint toggled: ${!showHint}`);
                }}
                onSave={saveScenario}
                onSaveServer={saveToServer}
                onSaveServerAs={saveToServerAs}
                onLoad={loadScenario}
                onLoadServer={loadFromServer}
                onDeleteServer={deleteFromServer}
                onReset={resetSettings}
                onRestart={restartGame}
                onChangeDifficulty={changeDifficulty}
                onUndo={undoStep}
                mapList={mapList}
                onFetchMaps={fetchMapList}
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
                useBackend={useBackend}
                autoSync={autoSync}
                onToggleAutoSync={handleToggleAutoSync}
                lastApiStepResult={lastApiStepResult}
            />
        </div>
    );
};

export default GameApp;
