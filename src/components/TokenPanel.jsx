import React, { useState } from 'react';
import { Key, Copy, Check } from 'lucide-react';

const TokenPanel = ({ token, useBackend }) => {
    const [copied, setCopied] = useState(false);

    if (!useBackend) return null;

    const handleCopy = async () => {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    const truncated = token ? (token.length > 24 ? `${token.slice(0, 12)}...${token.slice(-8)}` : token) : null;

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1a2332 0%, #0d1117 100%)',
            borderRadius: '8px',
            padding: '12px',
            border: '1px solid #30363d',
            marginBottom: '12px'
        }}>
            <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={12} /> Token
            </div>
            {token ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ flex: 1, fontSize: '11px', color: '#c9d1d9', wordBreak: 'break-all', background: '#0d1117', padding: '6px 8px', borderRadius: '4px' }}>
                        {truncated}
                    </code>
                    <button onClick={handleCopy} title="Copy token" style={{ background: '#21262d', border: '1px solid #30363d', color: copied ? '#00f2ff' : '#8b949e', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            ) : (
                <div style={{ fontSize: '11px', color: '#8b949e' }}>No token. Log in or play as guest.</div>
            )}
        </div>
    );
};

export default TokenPanel;
