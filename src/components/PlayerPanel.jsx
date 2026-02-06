import React, { useState, useCallback } from 'react';
import { Activity, Eye, EyeOff, Save, Upload, DownloadCloud, X, Undo, LogOut, RefreshCw, Trophy } from 'lucide-react';
import TokenPanel from './TokenPanel';
import { DIFFICULTY_PRESETS, MINION_TYPES } from '../config';
import { remoteLog } from '../utils/logger';
import LoginForm from './LoginForm';

const PlayerPanel = ({
    config, onStep, onSave, onLoad, onSaveServer, onLoadServer,
    onReset, onRestart, onChangeDifficulty, onUndo, mapList, onFetchMaps, currentStep,
    useBackend, autoSync, onToggleAutoSync, stepInProgress = false,
    layerVisibility, setLayerVisibility,
    user, isGuest, onLogout, onShowLogin, showLoginModal, onCloseLoginModal, onLoginFromGuest, onRegisterFromGuest,
    tokenPanelProps
}) => {
    const [showMapList, setShowMapList] = useState(false);
    const [showRankModal, setShowRankModal] = useState(false);
    const [leaderboards, setLeaderboards] = useState(null);
    const [rankLoading, setRankLoading] = useState(false);

    const toggleLayer = (layer) => {
        setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
        remoteLog(`[UI] Layer ${layer} toggled to ${!layerVisibility[layer]}`);
    };

    const fetchRank = useCallback(async () => {
        setShowRankModal(true);
        setRankLoading(true);
        try {
            const res = await fetch('/api/scores');
            const data = res.ok ? await res.json() : null;
            setLeaderboards(data?.leaderboards ?? []);
        } catch (e) {
            setLeaderboards([]);
            remoteLog(`[UI] Failed to load scores: ${e.message}`);
        } finally {
            setRankLoading(false);
        }
    }, []);

    const sectionStyle = { background: 'linear-gradient(135deg, #1a2332 0%, #0d1117 100%)', borderRadius: '8px', padding: '12px', border: '1px solid #30363d', marginBottom: '12px' };
    const paneStyle = { ...sectionStyle, padding: '10px 12px', marginBottom: '8px' };
    const labelStyle = { fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 };
    const modalOverlay = { position: 'fixed', left: '420px', zIndex: 1000, background: 'linear-gradient(180deg, #1a2332 0%, #0d1117 100%)', border: '1px solid #30363d', padding: '14px', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflowY: 'auto' };
    const closeBtn = { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px', borderRadius: '4px' };

    return (
        <div className="panel-container">
            {showLoginModal && isGuest && onCloseLoginModal && (
                <div style={{ ...sectionStyle, marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>Sign in to save scores</span>
                        <button onClick={onCloseLoginModal} style={{ ...closeBtn, fontSize: '18px', lineHeight: 1 }} aria-label="Close">×</button>
                    </div>
                    <LoginForm onLogin={onLoginFromGuest} onRegister={onRegisterFromGuest} hideGuestButton compact />
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #30363d' }}>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Game of Cells</h1>
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

            {!isGuest && onToggleAutoSync != null && (
                <div style={paneStyle}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: '#c9d1d9' }}>
                        <input type="checkbox" checked={autoSync} onChange={onToggleAutoSync}
                            style={{ accentColor: '#00f2ff', width: '14px', height: '14px', cursor: 'pointer' }} />
                        <RefreshCw size={14} style={{ opacity: autoSync ? 1 : 0.4, color: autoSync ? '#00f2ff' : '#8b949e' }} />
                        <span>Auto Sync</span>
                    </label>
                </div>
            )}

            {/* Difficulty */}
            <div style={paneStyle}>
                <div style={labelStyle}>Difficulty</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {Object.entries(DIFFICULTY_PRESETS).map(([key, { label }]) => (
                        <button key={key} className="btn btn-outline" onClick={() => onChangeDifficulty ? onChangeDifficulty(key) : onLoadServer(`${key}.json`)}
                            style={{ flex: 1, padding: '8px', fontSize: '11px', borderRadius: '6px' }}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Play */}
            <div style={paneStyle}>
                <div style={labelStyle}>Play</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={onStep} disabled={stepInProgress} style={{ flex: 1, minWidth: '90px', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', opacity: stepInProgress ? 0.6 : 1, cursor: stepInProgress ? 'not-allowed' : 'pointer' }}>{stepInProgress ? '...' : 'NEXT STEP'}</button>
                    <button className="btn btn-primary" onClick={onRestart} style={{ flex: 1, minWidth: '70px', padding: '8px', fontSize: '12px', borderRadius: '6px', backgroundColor: '#ffc107', color: '#000' }}>RESTART</button>
                    <button className="btn btn-outline" onClick={onUndo} style={{ padding: '8px', borderRadius: '6px', borderColor: '#a855f7', color: '#a855f7' }}><Undo size={16} /></button>
                </div>
            </div>

            {/* Rank */}
            <div style={paneStyle}>
                <button className="btn btn-outline" onClick={fetchRank} style={{ width: '100%', fontSize: '11px', padding: '8px', borderRadius: '6px', borderColor: '#f59e0b', color: '#f59e0b' }} title="View leaderboard"><Trophy size={14} /> Rank</button>
            </div>

            {/* File */}
            <div style={paneStyle}>
                <div style={labelStyle}>File</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={onSave} style={{ flex: 1, minWidth: '60px', fontSize: '11px', padding: '6px 8px', borderRadius: '6px' }}><Save size={12} /> Save</button>
                    <input type="file" accept=".json" style={{ display: 'none' }} id="player-scenario-upload"
                        onChange={(e) => { if (e.target.files?.[0]) { onLoad(e.target.files[0]); e.target.value = null; } }} />
                    <button className="btn btn-outline" onClick={() => document.getElementById('player-scenario-upload').click()} style={{ flex: 1, minWidth: '60px', fontSize: '11px', padding: '6px 8px', borderRadius: '6px' }}><Upload size={12} /> Load</button>
                    <button className="btn btn-outline" onClick={() => { if (!showMapList) onFetchMaps(); setShowMapList(!showMapList); }} style={{ flex: 1, minWidth: '60px', fontSize: '11px', padding: '6px 8px', borderRadius: '6px' }}><DownloadCloud size={12} /> Server</button>
                    <button className="btn btn-outline" onClick={onReset} style={{ color: '#f85149', fontSize: '11px', padding: '6px 8px', borderRadius: '6px' }}><X size={12} /> Reset</button>
                </div>
            </div>

            {showMapList && (
                <div className="map-list-overlay" style={{ ...modalOverlay, top: '120px', width: '300px', maxHeight: '380px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Server Load</h4>
                        <button onClick={() => setShowMapList(false)} style={closeBtn}><X size={16} /></button>
                    </div>
                    {(() => {
                        const filtered = mapList.filter(m => m !== 'initial.json' && !/^step_\d+\.json$/.test(m));
                        return filtered.length === 0 ? (
                        <div style={{ color: '#8b949e', fontSize: '12px', padding: '12px', textAlign: 'center' }}>No maps on server.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {filtered.map(mapName => (
                                <button key={mapName} onClick={() => { onLoadServer(mapName); setShowMapList(false); }}
                                    className="btn btn-outline"
                                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '6px', fontSize: '12px' }}>
                                    {mapName.replace('.json', '')}
                                </button>
                            ))}
                        </div>
                    );
                    })()}
                </div>
            )}

            {showRankModal && (
                <div className="rank-modal-overlay" style={{ ...modalOverlay, top: '80px', width: '320px', maxHeight: '420px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={16} style={{ color: '#f59e0b' }} /> Leaderboard</h4>
                        <button onClick={() => setShowRankModal(false)} style={closeBtn}><X size={16} /></button>
                    </div>
                    {rankLoading ? (
                        <div style={{ color: '#8b949e', fontSize: '12px', padding: '24px', textAlign: 'center' }}>Loading...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {(leaderboards || []).map(({ difficulty, entries }) => (
                                <div key={difficulty}>
                                    <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>{difficulty}</div>
                                    {entries.length === 0 ? (
                                        <div style={{ color: '#6e7681', fontSize: '12px', padding: '8px 0' }}>No scores yet</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {entries.slice(0, 10).map(({ rank, username, score, energyConsumed }) => (
                                                <div key={`${difficulty}-${username}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: rank <= 3 ? 'rgba(245, 158, 11, 0.1)' : '#161b22', borderRadius: '6px', fontSize: '12px' }}>
                                                    <span style={{ fontWeight: 600, color: rank <= 3 ? '#f59e0b' : '#c9d1d9' }}>#{rank}</span>
                                                    <span style={{ flex: 1, marginLeft: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{username}</span>
                                                    <span style={{ color: '#00f2ff', fontWeight: 600 }}>{score}</span>
                                                    <span style={{ marginLeft: '8px', color: '#8b949e', fontSize: '11px' }} title="Energy consumed">E:{energyConsumed ?? 0}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="step-hud" style={{ ...paneStyle, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <Activity size={18} style={{ color: '#00f2ff' }} />
                <span>STEP: {currentStep} / {config.TARGET_STEPS}</span>
            </div>

            <section style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><Eye size={16} /> Layer Visibility</h3>
                <div className="visibility-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {['coverage', 'capacity', 'cellLoad', 'minions', 'axes', 'minionRange', ...Object.keys(layerVisibility).filter(k => !['coverage', 'capacity', 'cellLoad', 'minions', 'axes', 'minionRange'].includes(k))].map(layer => (
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
                                layer === 'cellLoad' ? 'Cell Load' :
                                layer.startsWith('zone_') ? `Zone: ${layer.replace('zone_', '')}` :
                                layer.startsWith('minion_') ? `Minion: ${layer.replace('minion_', '').replace('_', ' ')}` :
                                    layer.charAt(0).toUpperCase() + layer.slice(1)}
                        </button>
                    ))}
                </div>
            </section>

            {tokenPanelProps && <TokenPanel {...tokenPanelProps} />}

            <div className="legend-section" style={sectionStyle}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '13px' }}>Legend</h3>
                <div className="legend-grid" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#4db8ff', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Coverage Cell (ON)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#30475e', border: '1px solid #ffffff44', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Coverage Cell (OFF)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#00ff66', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Capacity Cell (ON)</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                        <span className="swatch" style={{ background: '#2a4d3a', border: '1px solid #ffffff44', width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0 }}></span>
                        <span>Capacity Cell (OFF)</span>
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

export default PlayerPanel;
