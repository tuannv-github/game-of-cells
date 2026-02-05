import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '..', 'data', 'game.json');

let users = [];
let rankings = [];
let nextUserId = 1;

const loadDb = () => {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            users = data.users || [];
            rankings = data.rankings || [];
            nextUserId = Math.max(1, ...users.map(u => u.id), 0) + 1;
        } catch (_) {
            users = [];
            rankings = [];
        }
    }
};

const saveDb = () => {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify({ users, rankings }, null, 2));
};

export const initDb = () => {
    loadDb();
    const adminExists = users.find(u => u.username === 'admin');
    if (!adminExists) {
        const hash = bcrypt.hashSync('admin', 10);
        users.push({ id: nextUserId++, username: 'admin', password_hash: hash, role: 'admin' });
        saveDb();
        console.log('[DB] Seeded default admin (username: admin, password: admin)');
    }
};

export const getDb = () => {
    return {
        get: (sql, param) => {
            const val = Array.isArray(param) ? param[0] : param;
            if (sql.includes('users WHERE username')) {
                const user = users.find(u => u.username === val);
                return user ? { id: user.id, username: user.username, password_hash: user.password_hash, role: user.role } : null;
            }
            if (sql.includes('users WHERE id')) {
                const user = users.find(u => u.id === val);
                return user ? { id: user.id, username: user.username, password_hash: user.password_hash, role: user.role } : null;
            }
            return null;
        },
        run: (sql, params = []) => {
            if (sql.includes('INSERT INTO users')) {
                const [username, hash, role] = params;
                const id = nextUserId++;
                users.push({ id, username, password_hash: hash, role });
                saveDb();
                return { lastInsertRowid: id };
            }
            if (sql.includes('INSERT INTO rankings')) {
                const [userId, username, difficulty, stepsCompleted, totalEnergyConsumed] = params;
                rankings.push({ user_id: userId, username, difficulty, steps_completed: stepsCompleted, total_energy_consumed: totalEnergyConsumed });
                saveDb();
                return { lastInsertRowid: rankings.length };
            }
            return { lastInsertRowid: 0 };
        },
        all: (sql, param) => {
            const val = Array.isArray(param) ? param[0] : param;
            if (sql.includes('FROM rankings WHERE difficulty')) {
                return rankings.filter(r => r.difficulty === val)
                    .sort((a, b) => b.steps_completed - a.steps_completed || a.total_energy_consumed - b.total_energy_consumed)
                    .slice(0, 50);
            }
            return [];
        }
    };
};
