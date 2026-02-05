import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'game-of-cells-secret-change-in-production';
const JWT_EXPIRY = '7d';

export const login = (username, password) => {
    const db = getDb();
    const user = db.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
    return { id: user.id, username: user.username, role: user.role };
};

export const register = (username, password) => {
    const db = getDb();
    const existing = db.get('SELECT id FROM users WHERE username = ?', username);
    if (existing) return null;
    const hash = bcrypt.hashSync(password, 10);
    const result = db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'user']);
    const user = db.get('SELECT id, username, role FROM users WHERE id = ?', result.lastInsertRowid);
    return user;
};

export const createToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
};
