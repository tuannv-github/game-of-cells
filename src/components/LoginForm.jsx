import React, { useState } from 'react';

const LoginForm = ({ onLogin, onRegister, onGuest, hideGuestButton = false, compact = false }) => {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (mode === 'login') {
                await onLogin(username, password);
            } else {
                await onRegister(username, password);
            }
        } catch (err) {
            setError(err.message || 'Failed');
        } finally {
            setLoading(false);
        }
    };

    const containerStyle = compact ? {
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        padding: '16px',
        width: '100%',
        color: '#c9d1d9'
    } : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
        color: '#c9d1d9',
        padding: '20px'
    };

    const formBoxStyle = compact ? {} : {
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        maxWidth: '320px'
    };

    return (
        <div style={containerStyle}>
            {!compact && (
                <>
                    <h1 style={{ marginBottom: '8px', fontSize: '1.8rem', color: '#4db8ff' }}>Game of Cells</h1>
                    <p style={{ marginBottom: '24px', color: '#8b949e', fontSize: '14px' }}>Strategic infrastructure simulation</p>
                </>
            )}
            {compact && <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#4db8ff' }}>Sign in</h3>}
            <div style={formBoxStyle}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#c9d1d9' }}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={2}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#0d1117',
                                border: '1px solid #30363d',
                                borderRadius: '6px',
                                color: '#c9d1d9',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#c9d1d9' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={4}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#0d1117',
                                border: '1px solid #30363d',
                                borderRadius: '6px',
                                color: '#c9d1d9',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    {error && (
                        <div style={{ marginBottom: '12px', color: '#f85149', fontSize: '13px' }}>{error}</div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#00f2ff',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#000',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? '...' : mode === 'login' ? 'Login' : 'Register'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    style={{
                        marginTop: '12px',
                        background: 'none',
                        border: 'none',
                        color: '#00f2ff',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                    }}
                >
                    {mode === 'login' ? 'Create account' : 'Already have account? Login'}
                </button>

                {!hideGuestButton && onGuest && (
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #30363d' }}>
                        <button
                            type="button"
                            onClick={() => onGuest?.()}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'transparent',
                                border: '1px solid #30363d',
                                borderRadius: '6px',
                                color: '#8b949e',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            Play as Guest (local only)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginForm;
