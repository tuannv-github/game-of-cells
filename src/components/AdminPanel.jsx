import React, { useState } from 'react';
import { DIFFICULTY_PRESETS, MINION_TYPES, DEFAULT_CONFIG } from '../config';
import { Hexagon, Layers, Activity, Eye, EyeOff, Save, Upload, UploadCloud, DownloadCloud, X, Trash2, LogOut, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import TokenPanel from './TokenPanel';
import { remoteLog } from '../utils/logger';
import LoginForm from './LoginForm';

const AdminPanel = ({
    config, setConfig, onGenerate,
    onSave, onLoad, onSaveServer, onLoadServer, onDeleteServer,
    onReset, onSaveServerAs, mapList, onFetchMaps,
    adminSelectedDifficulty, onSelectDifficulty,
    layerVisibility, setLayerVisibility,
    user, isGuest, onLogout, onShowLogin, showLoginModal, onCloseLoginModal, onLoginFromGuest, onRegisterFromGuest,
    tokenPanelProps
}) => {
    const [showMapList, setShowMapList] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ global: true, geometry: true, infrastructure: false, minions: false });

    const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

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

    const handleMinionParam = (type, key, value) => {
        const val = key === 'MAX_MOVE' || key === 'REQ_THROUGHPUT' ? parseFloat(value) || 0 : value;
        setConfig(prev => ({
            ...prev,
            [type]: { ...prev[type], [key]: val }
        }));
        remoteLog(`[CONFIG] ${type} ${key} set to ${val}`);
    };

    const sectionStyle = { background: 'linear-gradient(145deg, rgba(26, 35, 50, 0.6) 0%, rgba(13, 17, 23, 0.9) 100%)', borderRadius: '10px', padding: '14px 16px', border: '1px solid rgba(48, 54, 61, 0.6)', marginBottom: '12px' };
    const labelStyle = { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px', fontWeight: 600 };

    return (
        <div className="panel-container">
            {showLoginModal && isGuest && onCloseLoginModal && (
                <div style={{ ...sectionStyle, marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>Sign in to save scores</span>
                        <button onClick={onCloseLoginModal} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px', fontSize: '18px', lineHeight: 1 }} aria-label="Close">×</button>
                    </div>
                    <LoginForm onLogin={onLoginFromGuest} onRegister={onRegisterFromGuest} hideGuestButton compact />
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid rgba(48, 54, 61, 0.6)' }}>
                <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                    Game of Cells <span style={{ fontSize: '10px', color: '#ffc107', fontWeight: 600, marginLeft: '6px', padding: '2px 6px', background: 'rgba(255, 193, 7, 0.15)', borderRadius: '4px' }}>ADMIN</span>
                </h1>
                {(user || isGuest) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#8b949e', padding: '4px 8px', background: '#21262d', borderRadius: '6px' }}>
                            {isGuest ? 'Guest' : user?.username}
                        </span>
                        {isGuest && onShowLogin && (
                            <button className="btn btn-outline" onClick={onShowLogin} title="Sign in to save scores" style={{ padding: '4px 10px', fontSize: '11px' }}>
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
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '14px', lineHeight: 1.5 }}>Configure scenarios for players. Click sections to expand.</div>

            {/* Difficulty Selection */}
            {onSelectDifficulty && (
                <div style={{ ...sectionStyle, marginBottom: '14px' }}>
                    <div style={labelStyle}>Difficulty (auto-saves)</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {Object.entries(DIFFICULTY_PRESETS).map(([key, { label }]) => (
                            <button
                                key={key}
                                className={adminSelectedDifficulty === key ? 'btn btn-primary' : 'btn btn-outline'}
                                onClick={() => onSelectDifficulty(key)}
                                style={{ flex: 1, padding: '9px 10px', fontSize: '11px', borderRadius: '6px' }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '6px' }}>
                        Editing {(adminSelectedDifficulty || 'easy')} — config auto-saves on change
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div style={{ ...sectionStyle, padding: '16px' }}>
                <div style={labelStyle}>Generate</div>
                <button className="btn btn-primary" onClick={onGenerate} title="Create new scenario with current settings"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                    <Zap size={18} /> Generate Scenario
                </button>
                <div style={labelStyle}>File</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button className="btn btn-outline" onClick={onSave} title="Download to file" style={{ flex: 1, fontSize: '11px', padding: '9px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Save size={14} /> Save
                    </button>
                    <input type="file" accept=".json" style={{ display: 'none' }} id="admin-scenario-upload"
                        onChange={(e) => { if (e.target.files?.[0]) { onLoad(e.target.files[0]); e.target.value = null; } }} />
                    <button className="btn btn-outline" onClick={() => document.getElementById('admin-scenario-upload').click()} title="Load from file" style={{ flex: 1, fontSize: '11px', padding: '9px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Upload size={14} /> Load
                    </button>
                </div>
                <div style={labelStyle}>Server</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={() => onSaveServerAs && onSaveServerAs(adminSelectedDifficulty || 'easy')} title={`Save scenario to ${(adminSelectedDifficulty || 'easy')}`} style={{ flex: 1, minWidth: '100px', fontSize: '11px', padding: '9px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <UploadCloud size={14} /> Server Save
                    </button>
                    <button className="btn btn-outline" onClick={() => { if (!showMapList) onFetchMaps(); setShowMapList(!showMapList); }} title="Load from server" style={{ flex: 1, minWidth: '100px', fontSize: '11px', padding: '9px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <DownloadCloud size={14} /> Server Load
                    </button>
                    <button className="btn btn-outline" onClick={onReset} title="Reset all to defaults" style={{ color: '#f85149', fontSize: '11px', padding: '9px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <X size={14} /> Reset
                    </button>
                </div>
            </div>

            {showMapList && (
                <div className="map-list-overlay" style={{
                    position: 'fixed', top: '100px', left: '380px', width: '320px', zIndex: 1000,
                    background: 'linear-gradient(180deg, #1a2332 0%, #0d1117 100%)', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '16px', borderRadius: '12px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0, 242, 255, 0.05)', maxHeight: '420px', overflowY: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Server Load</h4>
                        <button onClick={() => setShowMapList(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} title="Close"><X size={16} /></button>
                    </div>
                    {mapList.length === 0 ? (
                        <div style={{ color: '#8b949e', fontSize: '12px', padding: '12px', textAlign: 'center' }}>No scenarios on server. Generate one first.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {mapList.map(mapName => (
                                <div key={mapName} style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                                    <button className="btn btn-outline" onClick={() => { onLoadServer(mapName); setShowMapList(false); }}
                                        style={{ flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: '6px', fontSize: '12px' }}>
                                        {mapName.replace('.json', '')}
                                    </button>
                                    <button onClick={() => onDeleteServer(mapName)}
                                        style={{ background: '#0d1117', border: '1px solid #30363d', color: '#f85149', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Delete">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <section className="admin-section" style={{ marginBottom: '12px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Layer Visibility</h3>
                <div className="visibility-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {Object.keys(layerVisibility).map(layer => (
                        <button key={layer} onClick={() => toggleLayer(layer)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 10px', fontSize: '11px',
                                background: layerVisibility[layer] ? 'rgba(0, 242, 255, 0.1)' : 'rgba(22, 27, 34, 0.8)',
                                border: `1px solid ${layerVisibility[layer] ? 'rgba(0, 242, 255, 0.4)' : 'rgba(48, 54, 61, 0.6)'}`,
                                color: layerVisibility[layer] ? '#00f2ff' : '#8b949e',
                                borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: '600', textTransform: 'capitalize', transition: 'all 0.2s'
                            }}>
                            {layerVisibility[layer] ? <Eye size={12} /> : <EyeOff size={12} />}
                            {layer === 'minionRange' ? 'Movement Range' :
                                layer.startsWith('zone_') ? `Zone: ${layer.replace('zone_', '')}` :
                                layer.startsWith('minion_') ? `Minion: ${layer.replace('minion_', '').replace('_', ' ')}` :
                                    layer.charAt(0).toUpperCase() + layer.slice(1)}
                        </button>
                    ))}
                </div>
            </section>

            {tokenPanelProps && <TokenPanel {...tokenPanelProps} />}

            <div className="config-section config-section-compact">
                <section className="admin-section" style={{ marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.global ? '12px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }} onClick={() => toggleSection('global')}>
                        {expandedSections.global ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Activity size={16} /> Global
                    </h3>
                    {expandedSections.global && (
                    <div>
                    <div className="config-group">
                        <label>Target Steps</label>
                        <input type="number" step="1" value={config.TARGET_STEPS} onChange={e => handleConfigChange('TARGET_STEPS', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Total Energy</label>
                        <input type="number" step="1" value={config.TOTAL_ENERGY} onChange={e => handleConfigChange('TOTAL_ENERGY', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Cell Energy Cost</label>
                        <input type="number" step="0.1" value={config.CELL_ENERGY_COST} onChange={e => handleConfigChange('CELL_ENERGY_COST', parseFloat(e.target.value) || 0)} />
                    </div>
                    </div>
                    )}
                </section>

                <section className="admin-section" style={{ marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.geometry ? '12px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }} onClick={() => toggleSection('geometry')}>
                        {expandedSections.geometry ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Layers size={16} /> Scenario Geometry
                    </h3>
                    {expandedSections.geometry && (
                    <div>
                    <div className="config-group">
                        <label>Levels</label>
                        <input type="number" step="1" value={config.MAP_LEVELS ?? DEFAULT_CONFIG.MAP_LEVELS} onChange={e => handleConfigChange('MAP_LEVELS', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Level Spacing</label>
                        <input type="number" step="1" value={config.LEVEL_DISTANCE} onChange={e => handleConfigChange('LEVEL_DISTANCE', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Coverage Cells</label>
                        <input type="number" step="1" value={config.COVERAGE_CELLS_COUNT} onChange={e => handleConfigChange('COVERAGE_CELLS_COUNT', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Capacity Cells</label>
                        <input type="number" step="1" value={config.CAPACITY_CELLS_COUNT} onChange={e => handleConfigChange('CAPACITY_CELLS_COUNT', parseInt(e.target.value) || 0)} />
                    </div>
                    </div>
                    )}
                </section>

                <section className="admin-section" style={{ marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.infrastructure ? '12px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }} onClick={() => toggleSection('infrastructure')}>
                        {expandedSections.infrastructure ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Hexagon size={16} /> Infrastructure
                    </h3>
                    {expandedSections.infrastructure && (
                    <div>
                    <div className="config-group">
                        <label>Coverage Cap (Mbps)</label>
                        <input type="number" step="1" value={config.COVERAGE_LIMIT_MBPS} onChange={e => handleConfigChange('COVERAGE_LIMIT_MBPS', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Coverage Radius</label>
                        <input type="number" step="1" value={config.COVERAGE_CELL_RADIUS} onChange={e => handleConfigChange('COVERAGE_CELL_RADIUS', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Capacity Radius</label>
                        <input type="number" step="1" value={config.CAPACITY_CELL_RADIUS} onChange={e => handleConfigChange('CAPACITY_CELL_RADIUS', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Portal Pairs</label>
                        <input type="number" step="1" value={config.PORTAL_PAIR_COUNT} onChange={e => handleConfigChange('PORTAL_PAIR_COUNT', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Portal Area</label>
                        <input type="number" step="1" value={config.PORTAL_AREA} onChange={e => handleConfigChange('PORTAL_AREA', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="config-group">
                        <label>Obstacle Area (%)</label>
                        <input type="number" step="1" value={config.TOTAL_OBSTACLE_AREA_PER_LEVEL} onChange={e => handleConfigChange('TOTAL_OBSTACLE_AREA_PER_LEVEL', parseInt(e.target.value) || 0)} />
                    </div>
                    </div>
                    )}
                </section>

                <section className="admin-section" style={{ marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.minions ? '12px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }} onClick={() => toggleSection('minions')}>
                        {expandedSections.minions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        👥 Minions
                    </h3>
                    {expandedSections.minions && (
                    <div>
                    {['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'].map(type => (
                        <div key={type} className="minion-config-row" style={{ padding: '12px', background: 'rgba(13, 17, 23, 0.7)', borderRadius: '8px', border: '1px solid rgba(48, 54, 61, 0.5)', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <input type="color" value={config[type]?.COLOR || '#ffffff'} onChange={e => handleMinionParam(type, 'COLOR', e.target.value)}
                                    style={{ width: '24px', height: '24px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                                <strong>{type.replace('_', ' ')}</strong>
                                <input type="checkbox" checked={config[type]?.ENABLED} onChange={e => handleMinionToggle(type, e.target.checked)} />
                            </div>
                            <div className="config-group"><label>Count</label>
                                <input type="number" className="count-input" value={config[type]?.COUNT ?? 0} onChange={e => handleMinionCount(type, e.target.value)} />
                            </div>
                            <div className="config-group"><label>Size</label>
                                <input type="number" className="count-input" value={config[type]?.SIZE ?? 1} step="0.1" onChange={e => handleMinionSize(type, e.target.value)} />
                            </div>
                            <div className="config-group"><label>Max Move</label>
                                <input type="number" className="count-input" value={config[type]?.MAX_MOVE ?? 0} step="0.1" onChange={e => handleMinionParam(type, 'MAX_MOVE', e.target.value)} />
                            </div>
                            <div className="config-group"><label>Req Mbps</label>
                                <input type="number" className="count-input" value={config[type]?.REQ_THROUGHPUT ?? 0} onChange={e => handleMinionParam(type, 'REQ_THROUGHPUT', e.target.value)} />
                            </div>
                        </div>
                    ))}
                    </div>
                    )}
                </section>
            </div>

            <div className="legend-section admin-section" style={{ marginTop: 'auto', paddingTop: '16px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '13px', fontWeight: 600 }}>Legend</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#4db8ff', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Coverage (ON)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#30475e', border: '1px solid #ffffff44', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Coverage (OFF)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#00ff66', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Capacity (ON)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#2a4d3a', border: '1px solid #ffffff44', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Capacity (OFF)</span>
                    </div>
                    <div style={{ margin: '8px 0', height: '1px', background: '#30363d', opacity: 0.5 }} />
                    {Object.entries(MINION_TYPES).map(([typeKey]) => {
                        const labelPrefix = { HUMAN: 'H', HUMANOID: 'O', DOG_ROBOT: 'D', TURTLE_BOT: 'T', DRONE: 'R' }[typeKey] ?? '';
                        return (
                        <div key={typeKey} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                            <span className="swatch" style={{ background: config[typeKey]?.COLOR ?? '#888', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                            <span><strong>{labelPrefix}</strong> — {typeKey.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                        </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
