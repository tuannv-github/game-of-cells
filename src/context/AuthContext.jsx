import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'goc_token';
const USER_KEY = 'goc_user';
const GUEST_KEY = 'goc_guest';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === 'true');

    useEffect(() => {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
            const u = localStorage.getItem(USER_KEY);
            if (u) setUser(JSON.parse(u));
            localStorage.removeItem(GUEST_KEY);
            setIsGuest(false);
        } else {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        }
    }, [token]);

    useEffect(() => {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    }, [user]);

    const login = useCallback(async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const register = useCallback(async (username, password) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        setToken(data.token);
        setUser(data.user);
        return data;
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        setIsGuest(false);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(GUEST_KEY);
    }, []);

    const playAsGuest = useCallback(() => {
        setToken(null);
        setUser(null);
        setIsGuest(true);
        localStorage.setItem(GUEST_KEY, 'true');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }, []);

    const isAuthenticated = !!token || isGuest;

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isGuest,
            isAuthenticated,
            login,
            register,
            logout,
            playAsGuest
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
