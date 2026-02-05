import React, { useState } from 'react';
import { DIFFICULTY_PRESETS, MINION_TYPES } from '../config';
import { Hexagon, Layers, Activity, Eye, EyeOff, Save, Upload, UploadCloud, DownloadCloud, X, Trash2, LogOut, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import TokenPanel from './TokenPanel';
import { remoteLog } from '../utils/logger';
import LoginForm from './LoginForm';

const AdminPanel = ({
    config, setConfig, onGenerate,
    onSave, onLoad, onSaveServer, onLoadServer, onDeleteServer,
    onReset, onSaveServerAs, mapList, onFetchMaps,
    layerVisibility, setLayerVisibility,
    user, isGuest, onLogout, onShowLogin, showLoginModal, onCloseLoginModal, onLoginFromGuest, onRegisterFromGuest,
    tokenPanelProps
}) => {
    const [showMapList, setShowMapList] = useState(false);
    const [showSavePicker, setShowSavePicker] = useState(false);
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

    const sectionStyle = { background: 'linear-gradient(135deg, #1a2332 0%, #0d1117 100%)', borderRadius: '8px', padding: '12px', border: '1px solid #30363d', marginBottom: '12px' };
    const labelStyle = { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #30363d' }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                    Game of Cells <span style={{ fontSize: '11px', color: '#ffc107', fontWeight: 500, marginLeft: '4px' }}>(Admin)</span>
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
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '12px' }}>Configure scenarios for players. Click sections to expand.</div>

            {/* Quick Actions */}
            <div style={sectionStyle}>
                <div style={labelStyle}>Generate</div>
                <button className="btn btn-primary" onClick={onGenerate} title="Create new scenario with current settings"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
                    <Zap size={18} /> Generate Scenario
                </button>
                <div style={labelStyle}>File</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button className="btn btn-outline" onClick={onSave} title="Download to file" style={{ flex: 1, fontSize: '11px', padding: '8px', borderRadius: '6px' }}>
                        <Save size={14} /> Save
                    </button>
                    <input type="file" accept=".json" style={{ display: 'none' }} id="admin-scenario-upload"
                        onChange={(e) => { if (e.target.files?.[0]) { onLoad(e.target.files[0]); e.target.value = null; } }} />
                    <button className="btn btn-outline" onClick={() => document.getElementById('admin-scenario-upload').click()} title="Load from file" style={{ flex: 1, fontSize: '11px', padding: '8px', borderRadius: '6px' }}>
                        <Upload size={14} /> Load
                    </button>
                </div>
                <div style={labelStyle}>Server</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={() => setShowSavePicker(true)} title="Save to server (choose Easy/Medium/Hard)" style={{ flex: 1, minWidth: '100px', fontSize: '11px', padding: '8px', borderRadius: '6px' }}>
                        <UploadCloud size={14} /> Server Save
                    </button>
                    <button className="btn btn-outline" onClick={() => { if (!showMapList) onFetchMaps(); setShowMapList(!showMapList); }} title="Load from server" style={{ flex: 1, minWidth: '100px', fontSize: '11px', padding: '8px', borderRadius: '6px' }}>
                        <DownloadCloud size={14} /> Server Load
                    </button>
                    <button className="btn btn-outline" onClick={onReset} title="Reset all to defaults" style={{ color: '#f85149', fontSize: '11px', padding: '8px', borderRadius: '6px' }}>
                        <X size={14} /> Reset
                    </button>
                </div>
            </div>

            {showSavePicker && onSaveServerAs && (
                <div className="map-list-overlay" style={{
                    position: 'fixed', top: '100px', left: '380px', width: '300px', zIndex: 1000,
                    background: 'linear-gradient(180deg, #1a2332 0%, #0d1117 100%)', border: '1px solid #30363d', padding: '14px', borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Save as</h4>
                        <button onClick={() => setShowSavePicker(false)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px', borderRadius: '4px' }} title="Close"><X size={16} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(DIFFICULTY_PRESETS).map(([key, { label }]) => (
                            <button key={key} className="btn btn-primary" onClick={() => { onSaveServerAs(key); setShowSavePicker(false); }}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {showMapList && (
                <div className="map-list-overlay" style={{
                    position: 'fixed', top: '100px', left: '380px', width: '320px', zIndex: 1000,
                    background: 'linear-gradient(180deg, #1a2332 0%, #0d1117 100%)', border: '1px solid #30363d', padding: '14px', borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: '420px', overflowY: 'auto'
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

            <section style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={16} /> Layer Visibility</h3>
                <div className="visibility-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {Object.keys(layerVisibility).map(layer => (
                        <button key={layer} onClick={() => toggleLayer(layer)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', fontSize: '11px',
                                background: layerVisibility[layer] ? 'rgba(0, 242, 255, 0.12)' : '#161b22',
                                border: `1px solid ${layerVisibility[layer] ? '#00f2ff' : '#30363d'}`,
                                color: layerVisibility[layer] ? '#00f2ff' : '#8b949e',
                                borderRadius: '6px', cursor: 'pointer', width: '100%', fontWeight: '600', textTransform: 'capitalize', transition: 'all 0.2s'
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
                <section style={{ ...sectionStyle, marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.global ? '10px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} onClick={() => toggleSection('global')}>
                        {expandedSections.global ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Activity size={16} /> Global
                    </h3>
                    {expandedSections.global && (
                    <div>
                    <div className="config-group">
                        <label>Target Steps: {config.TARGET_STEPS}</label>
                        <input type="range" min="10" max="500" step="10" value={config.TARGET_STEPS} onChange={e => handleConfigChange('TARGET_STEPS', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Total Energy: {config.TOTAL_ENERGY}</label>
                        <input type="range" min="100" max="2000" step="50" value={config.TOTAL_ENERGY} onChange={e => handleConfigChange('TOTAL_ENERGY', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Cell Energy Cost: {config.CELL_ENERGY_COST}</label>
                        <input type="range" min="0.1" max="5" step="0.1" value={config.CELL_ENERGY_COST} onChange={e => handleConfigChange('CELL_ENERGY_COST', parseFloat(e.target.value))} />
                    </div>
                    </div>
                    )}
                </section>

                <section style={{ ...sectionStyle, marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.geometry ? '10px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} onClick={() => toggleSection('geometry')}>
                        {expandedSections.geometry ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Layers size={16} /> Scenario Geometry
                    </h3>
                    {expandedSections.geometry && (
                    <div>
                    <div className="config-group">
                        <label>Levels: {config.MAP_LEVELS}</label>
                        <input type="range" min="1" max="5" value={config.MAP_LEVELS} onChange={e => handleConfigChange('MAP_LEVELS', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Level Spacing: {config.LEVEL_DISTANCE}</label>
                        <input type="range" min="5" max="50" step="1" value={config.LEVEL_DISTANCE} onChange={e => handleConfigChange('LEVEL_DISTANCE', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Coverage Cells: {config.COVERAGE_CELLS_COUNT}</label>
                        <input type="range" min="0" max="80" value={config.COVERAGE_CELLS_COUNT} onChange={e => handleConfigChange('COVERAGE_CELLS_COUNT', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Capacity Cells: {config.CAPACITY_CELLS_COUNT}</label>
                        <input type="range" min="0" max="80" value={config.CAPACITY_CELLS_COUNT} onChange={e => handleConfigChange('CAPACITY_CELLS_COUNT', parseInt(e.target.value))} />
                    </div>
                    </div>
                    )}
                </section>

                <section style={{ ...sectionStyle, marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.infrastructure ? '10px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} onClick={() => toggleSection('infrastructure')}>
                        {expandedSections.infrastructure ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Hexagon size={16} /> Infrastructure
                    </h3>
                    {expandedSections.infrastructure && (
                    <div>
                    <div className="config-group">
                        <label>Coverage Cap (Mbps): {config.COVERAGE_LIMIT_MBPS}</label>
                        <input type="range" min="50" max="500" step="10" value={config.COVERAGE_LIMIT_MBPS} onChange={e => handleConfigChange('COVERAGE_LIMIT_MBPS', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Coverage Radius: {config.COVERAGE_CELL_RADIUS}</label>
                        <input type="range" min="0" max="80" step="1" value={config.COVERAGE_CELL_RADIUS} onChange={e => handleConfigChange('COVERAGE_CELL_RADIUS', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Capacity Radius: {config.CAPACITY_CELL_RADIUS}</label>
                        <input type="range" min="0" max="80" step="1" value={config.CAPACITY_CELL_RADIUS} onChange={e => handleConfigChange('CAPACITY_CELL_RADIUS', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Portal Pairs: {config.PORTAL_PAIR_COUNT}</label>
                        <input type="range" min="0" max="10" step="1" value={config.PORTAL_PAIR_COUNT} onChange={e => handleConfigChange('PORTAL_PAIR_COUNT', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Portal Area: {config.PORTAL_AREA}</label>
                        <input type="range" min="10" max="500" step="10" value={config.PORTAL_AREA} onChange={e => handleConfigChange('PORTAL_AREA', parseInt(e.target.value))} />
                    </div>
                    <div className="config-group">
                        <label>Obstacle Area (%): {config.TOTAL_OBSTACLE_AREA_PER_LEVEL}</label>
                        <input type="range" min="0" max="100" step="1" value={config.TOTAL_OBSTACLE_AREA_PER_LEVEL} onChange={e => handleConfigChange('TOTAL_OBSTACLE_AREA_PER_LEVEL', parseInt(e.target.value))} />
                    </div>
                    </div>
                    )}
                </section>

                <section style={{ ...sectionStyle, marginBottom: '10px' }}>
                    <h3 className="collapsible" style={{ marginTop: 0, marginBottom: expandedSections.minions ? '10px' : 0, userSelect: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} onClick={() => toggleSection('minions')}>
                        {expandedSections.minions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        👥 Minions
                    </h3>
                    {expandedSections.minions && (
                    <div>
                    {['HUMAN', 'HUMANOID', 'DOG_ROBOT', 'TURTLE_BOT', 'DRONE'].map(type => (
                        <div key={type} className="minion-config-row" style={{ padding: '10px', background: '#0d1117', borderRadius: '6px', border: '1px solid #30363d', marginBottom: '8px' }}>
                            <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="color" value={config[type]?.COLOR || '#ffffff'} onChange={e => handleMinionParam(type, 'COLOR', e.target.value)}
                                    style={{ width: '24px', height: '24px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                                <strong>{type.replace('_', ' ')}</strong>
                                <input type="checkbox" checked={config[type]?.ENABLED} onChange={e => handleMinionToggle(type, e.target.checked)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px' }}>
                                <div><label style={{ color: '#8b949e' }}>Count</label>
                                    <input type="number" className="count-input" value={config[type]?.COUNT ?? 0} min="0" style={{ width: '100%' }} onChange={e => handleMinionCount(type, e.target.value)} />
                                </div>
                                <div><label style={{ color: '#8b949e' }}>Size</label>
                                    <input type="number" className="count-input" value={config[type]?.SIZE ?? 1} step="0.1" min="0.1" style={{ width: '100%' }} onChange={e => handleMinionSize(type, e.target.value)} />
                                </div>
                                <div><label style={{ color: '#8b949e' }}>Max Move</label>
                                    <input type="number" className="count-input" value={config[type]?.MAX_MOVE ?? 0} step="0.5" min="0" style={{ width: '100%' }} onChange={e => handleMinionParam(type, 'MAX_MOVE', e.target.value)} />
                                </div>
                                <div><label style={{ color: '#8b949e' }}>Req Mbps</label>
                                    <input type="number" className="count-input" value={config[type]?.REQ_THROUGHPUT ?? 0} min="0" style={{ width: '100%' }} onChange={e => handleMinionParam(type, 'REQ_THROUGHPUT', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                    )}
                </section>
            </div>

            <div className="legend-section" style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '13px' }}>Legend</h3>
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
                    {Object.entries(MINION_TYPES).map(([typeKey]) => (
                        <div key={typeKey} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                            <span className="swatch" style={{ background: config[typeKey]?.COLOR ?? '#888', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                            <span>{typeKey.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
