import React, { useState } from 'react';
import { Hexagon, Layers, Activity, Eye, EyeOff, Save, Upload, UploadCloud, DownloadCloud, X, Trash2, Undo, LogOut } from 'lucide-react';
import { remoteLog } from '../utils/logger';
import LoginForm from './LoginForm';

const Sidebar = ({
    config, setConfig, onGenerate, onStep, onHint,
    onSave, onLoad, onSaveServer, onLoadServer, onDeleteServer,
    onReset, onRestart, onUndo, mapList, onFetchMaps, currentStep,
    layerVisibility, setLayerVisibility,
    useBackend, setUseBackend, autoSync, onToggleAutoSync, lastApiStepResult,
    user, isGuest, onLogout, onShowLogin, showLoginModal, onCloseLoginModal, onLoginFromGuest, onRegisterFromGuest
}) => {
    const [showMapList, setShowMapList] = useState(false);

    const handleConfigChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        remoteLog(`[CONFIG] ${key} changed to ${value}`);
    };

    const toggleLayer = (layer) => {
        setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
        remoteLog(`[UI] Layer ${layer} toggled to ${!layerVisibility[layer]}`);
    };

    const handleMinionToggle = (type, enabled) => {
        setConfig(prev => ({
            ...prev,
            [type]: { ...prev[type], ENABLED: enabled }
        }));
    };

    const handleMinionCount = (type, count) => {
        const val = parseInt(count) || 0;
        setConfig(prev => ({
            ...prev,
            [type]: { ...prev[type], COUNT: val }
        }));
        remoteLog(`[CONFIG] ${type} count set to ${val}`);
    };

    const handleMinionSize = (type, size) => {
        const val = parseFloat(size) || 1.0;
        setConfig(prev => ({
            ...prev,
            [type]: { ...prev[type], SIZE: val }
        }));
        remoteLog(`[CONFIG] ${type} size set to ${val}`);
    };

    return (
        <div className="panel-container">
            {showLoginModal && isGuest && onCloseLoginModal && (
                <div style={{ marginBottom: '16px', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>Sign in to save scores</span>
                        <button onClick={onCloseLoginModal} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px' }} aria-label="Close">×</button>
                    </div>
                    <LoginForm onLogin={onLoginFromGuest} onRegister={onRegisterFromGuest} hideGuestButton compact />
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h1 style={{ margin: 0 }}>Game of Cells</h1>
                {(user || isGuest) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#8b949e' }}>
                            {isGuest ? 'Guest' : user?.username}
                        </span>
                        {isGuest && onShowLogin && (
                            <button className="btn btn-outline" onClick={onShowLogin} title="Sign in to save scores" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                Sign in
                            </button>
                        )}
                        {!isGuest && onLogout && (
                            <button className="btn btn-outline" onClick={onLogout} title="Logout" style={{ padding: '4px 8px' }}>
                                <LogOut size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="action-bar">
                <button className="btn btn-outline" onClick={onGenerate}>
                    GENERATE
                </button>
                <button className="btn btn-primary" onClick={onStep}>
                    NEXT STEP
                </button>
                <button className="btn btn-primary" onClick={onRestart} style={{ backgroundColor: '#ffc107', color: '#000' }}>
                    RESTART
                </button>
                <button className="btn btn-outline" onClick={onUndo} title="Undo Last Step" style={{ borderColor: '#a855f7', color: '#a855f7' }}>
                    <Undo size={16} />
                </button>
                <div className="btn-group">
                    <button className="btn btn-outline" onClick={onSave} title="Save to Local">
                        <Save size={16} />
                    </button>
                    <button className="btn btn-outline" onClick={onSaveServer} title="Save to Server">
                        <UploadCloud size={16} />
                    </button>
                    <button className="btn btn-outline" onClick={onReset} title="Reset to Defaults" style={{ color: '#f85149' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="btn-group">
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <input
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            id="scenario-upload"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    onLoad(e.target.files[0]);
                                    e.target.value = null; // Reset for re-upload
                                }
                            }}
                        />
                        <button
                            className="btn btn-outline"
                            onClick={() => document.getElementById('scenario-upload').click()}
                            title="Load from Local"
                        >
                            <Upload size={16} />
                        </button>
                    </div>
                    <button
                        className="btn btn-outline"
                        onClick={() => {
                            if (!showMapList) onFetchMaps();
                            setShowMapList(!showMapList);
                        }}
                        title="Load from Server"
                    >
                        <DownloadCloud size={16} />
                    </button>
                </div>
            </div>

            {showMapList && (
                <div className="map-list-overlay" style={{
                    position: 'fixed',
                    top: '120px',
                    left: '420px',
                    width: '300px',
                    zIndex: 1000,
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    padding: '10px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0 }}>Server Maps</h4>
                        <button onClick={() => setShowMapList(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
                            <X size={14} />
                        </button>
                    </div>
                    {mapList.length === 0 ? (
                        <div style={{ color: '#8b949e', fontSize: '12px' }}>No maps found on server.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {mapList.map(mapName => (
                                <div key={mapName} style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => {
                                            onLoadServer(mapName);
                                            setShowMapList(false);
                                        }}
                                        style={{
                                            flex: 1,
                                            textAlign: 'left',
                                            background: '#161b22',
                                            border: '1px solid #30363d',
                                            color: '#c9d1d9',
                                            padding: '6px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {mapName}
                                    </button>
                                    <button
                                        onClick={() => onDeleteServer(mapName)}
                                        style={{
                                            background: '#161b22',
                                            border: '1px solid #30363d',
                                            color: '#f85149',
                                            padding: '6px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Delete map"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="step-hud">
                <Activity size={16} /> STEP: {currentStep} / {config.TARGET_STEPS}
            </div>

            <div className="separator" />

            <div className="config-section">
                <section style={{ background: '#1c2128', padding: '12px', borderRadius: '8px', border: '1px solid #444c56', marginBottom: '16px' }}>
                    <h3 style={{ color: '#4db8ff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Activity size={18} /> API Client Integration
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: '#0d1117', borderRadius: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: useBackend ? '#ffc107' : '#8b949e' }}>
                                BACKEND ENGINE MODE
                            </span>
                            <input
                                type="checkbox"
                                checked={useBackend}
                                onChange={(e) => setUseBackend(e.target.checked)}
                            />
                        </div>

                        <button
                            className={`btn ${autoSync ? 'btn-primary' : 'btn-outline'}`}
                            onClick={onToggleAutoSync}
                            style={{ justifyContent: 'center', width: '100%', fontSize: '12px' }}
                        >
                            {autoSync ? 'STOP AUTO-SYNC' : 'START AUTO-SYNC (POLL)'}
                        </button>

                        {lastApiStepResult && (
                            <div style={{
                                marginTop: '8px',
                                padding: '8px',
                                background: '#0d1117',
                                borderLeft: `3px solid ${lastApiStepResult.failure ? '#f85149' : '#3fb950'}`,
                                fontSize: '11px'
                            }}>
                                <div style={{ color: '#8b949e', marginBottom: '4px' }}>Latest API Play Result:</div>
                                <div style={{ color: '#c9d1d9' }}>
                                    Energy Consumed: <span style={{ color: '#4db8ff' }}>{lastApiStepResult.energyConsumed?.toFixed(2)}</span>
                                    {lastApiStepResult.energyLeft !== undefined && (
                                        <div style={{ color: '#c9d1d9', marginTop: '4px' }}>
                                            Energy Left: <span style={{ color: '#00ff66' }}>{lastApiStepResult.energyLeft?.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                                {lastApiStepResult.failure && (
                                    <div style={{ color: '#f85149', fontWeight: 'bold', marginTop: '4px' }}>
                                        FAILURE: {lastApiStepResult.failure}
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#8b949e', fontStyle: 'italic', marginTop: '4px' }}>
                            Syncs UI with Swagger API simulation state.
                        </div>
                    </div>
                </section>

                <section>
                    <h3><Layers size={16} /> World Geometry</h3>
                    <div className="config-group">
                        <label>Levels: {config.MAP_LEVELS}</label>
                        <input
                            type="range" min="1" max="5"
                            value={config.MAP_LEVELS}
                            onChange={e => handleConfigChange('MAP_LEVELS', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Level Spacing: {config.LEVEL_DISTANCE}</label>
                        <input
                            type="range" min="5" max="50" step="1"
                            value={config.LEVEL_DISTANCE}
                            onChange={e => handleConfigChange('LEVEL_DISTANCE', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Coverage Cells per Level: {config.COVERAGE_CELLS_COUNT}</label>
                        <input
                            type="range" min="0" max="80"
                            value={config.COVERAGE_CELLS_COUNT}
                            onChange={e => handleConfigChange('COVERAGE_CELLS_COUNT', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Capacity Cells per Level: {config.CAPACITY_CELLS_COUNT}</label>
                        <input
                            type="range" min="0" max="80"
                            value={config.CAPACITY_CELLS_COUNT}
                            onChange={e => handleConfigChange('CAPACITY_CELLS_COUNT', parseInt(e.target.value))}
                        />
                    </div>
                </section>

                <section>
                    <h3><Layers size={16} /> Layer Visibility</h3>
                    <div className="visibility-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '10px'
                    }}>
                        {Object.keys(layerVisibility).map(layer => (
                            <button
                                key={layer}
                                onClick={() => toggleLayer(layer)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 8px',
                                    fontSize: '11px',
                                    background: layerVisibility[layer] ? '#1a3a5a' : '#161b22',
                                    border: `1px solid ${layerVisibility[layer] ? '#4db8ff' : '#30363d'}`,
                                    color: layerVisibility[layer] ? '#4db8ff' : '#8b949e',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    width: '100%',
                                    fontWeight: '600',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {layerVisibility[layer] ? <Eye size={12} /> : <EyeOff size={12} />}
                                {layer.startsWith('zone_') ? `Zone: ${layer.replace('zone_', '')}` :
                                    layer.startsWith('minion_') ? `Minion: ${layer.replace('minion_', '').replace('_', ' ')}` :
                                        layer.charAt(0).toUpperCase() + layer.slice(1)}
                            </button>
                        ))}
                    </div>
                </section>

                <section>
                    <h3><Hexagon size={16} /> Infrastructure</h3>
                    <div className="config-group">
                        <label>Coverage Cap (Mbps): {config.COVERAGE_LIMIT_MBPS}</label>
                        <input
                            type="range" min="50" max="500" step="10"
                            value={config.COVERAGE_LIMIT_MBPS}
                            onChange={e => handleConfigChange('COVERAGE_LIMIT_MBPS', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Coverage Radius: {config.COVERAGE_CELL_RADIUS}</label>
                        <input
                            type="range" min="0" max="80" step="1"
                            value={config.COVERAGE_CELL_RADIUS}
                            onChange={e => handleConfigChange('COVERAGE_CELL_RADIUS', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Capacity Radius: {config.CAPACITY_CELL_RADIUS}</label>
                        <input
                            type="range" min="0" max="80" step="1"
                            value={config.CAPACITY_CELL_RADIUS}
                            onChange={e => handleConfigChange('CAPACITY_CELL_RADIUS', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Transition Zones per Pair: {config.PORTAL_PAIR_COUNT}</label>
                        <input
                            type="range" min="0" max="10" step="1"
                            value={config.PORTAL_PAIR_COUNT}
                            onChange={e => handleConfigChange('PORTAL_PAIR_COUNT', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Portal Area: {config.PORTAL_AREA}</label>
                        <input
                            type="range" min="10" max="500" step="10"
                            value={config.PORTAL_AREA}
                            onChange={e => handleConfigChange('PORTAL_AREA', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="config-group">
                        <label>Total Obstacle Area (%): {config.TOTAL_OBSTACLE_AREA_PER_LEVEL}</label>
                        <input
                            type="range" min="0" max="100" step="1"
                            value={config.TOTAL_OBSTACLE_AREA_PER_LEVEL}
                            onChange={e => handleConfigChange('TOTAL_OBSTACLE_AREA_PER_LEVEL', parseInt(e.target.value))}
                        />
                    </div>
                </section>

                <section>
                    <h3>👥 Minions</h3>
                    {['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'].map(type => (
                        <div key={type} className="minion-config-row">
                            <div className="minion-type-label">
                                <span className="dot" style={{ background: config[type].COLOR }}></span>
                                {type.replace('_', ' ')}
                            </div>
                            <div className="minion-controls">
                                <input
                                    type="checkbox"
                                    checked={config[type].ENABLED}
                                    onChange={e => handleMinionToggle(type, e.target.checked)}
                                />
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#8b949e' }}>N:</span>
                                    <input
                                        type="number"
                                        className="count-input"
                                        value={config[type].COUNT}
                                        style={{ width: '40px' }}
                                        onChange={e => handleMinionCount(type, e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#8b949e' }}>S:</span>
                                    <input
                                        type="number"
                                        className="count-input"
                                        value={config[type].SIZE}
                                        step="0.1"
                                        min="0.1"
                                        style={{ width: '45px' }}
                                        onChange={e => handleMinionSize(type, e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </section>
            </div>

            <div className="separator" />

            <div className="legend-section">
                <h3>Legend</h3>
                <div className="legend-grid">
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#4db8ff' }}></span>
                        <span>Coverage Cell (ON)</span>
                    </div>
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#30475e', border: '1px solid #ffffff44' }}></span>
                        <span>Coverage Cell (OFF)</span>
                    </div>
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#00ff66' }}></span>
                        <span>Capacity Cell (ON)</span>
                    </div>
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#2a4d3a', border: '1px solid #ffffff44' }}></span>
                        <span>Capacity Cell (OFF)</span>
                    </div>
                    <div className="separator" style={{ margin: '8px 0', opacity: 0.1, height: '1px' }} />
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#00d2ff', border: '1px solid #ffffff44' }}></span>
                        <span>Common Area (Hub)</span>
                    </div>
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#ff0066', border: '1px solid #ffffff44' }}></span>
                        <span>Room Area</span>
                    </div>
                    <div className="legend-item">
                        <span className="swatch" style={{ background: '#f39c12', border: '1px solid #ffffff44' }}></span>
                        <span>Path / Corridor</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
