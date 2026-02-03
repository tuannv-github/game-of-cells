import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'

const LOG_DIR = path.resolve(__dirname, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'server.log')

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, `[SYSTEM] Log file initialized: ${new Date().toISOString()}\n`)
}

const writeToLogFile = (message, level = 'info') => {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
    fs.appendFileSync(LOG_FILE, logEntry)
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'log-bridge',
            configureServer(server) {
                server.middlewares.use(bodyParser.json())
                server.middlewares.use((req, res, next) => {
                    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

                    if (parsedUrl.pathname === '/api/log' && req.method === 'POST') {
                        const { message, level = 'info' } = req.body
                        const timestamp = new Date().toISOString()
                        const logMsg = `[BROWSER] ${message}`

                        // Log to server console (standard output)
                        console.log(`[${timestamp}] [${level.toUpperCase()}] ${logMsg}`)

                        // Log to persistent file
                        writeToLogFile(logMsg, level)

                        res.statusCode = 200
                        res.end('OK')
                    } else if (parsedUrl.pathname === '/api/maps' && req.method === 'GET') {
                        const MAPS_DIR = path.resolve(__dirname, 'scenarios');
                        if (!fs.existsSync(MAPS_DIR)) {
                            fs.mkdirSync(MAPS_DIR, { recursive: true });
                        }
                        const files = fs.readdirSync(MAPS_DIR).filter(f => f.endsWith('.json'));
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(files));
                    } else if (parsedUrl.pathname.startsWith('/api/maps/') && req.method === 'GET') {
                        const mapName = parsedUrl.pathname.split('/').pop();
                        const MAPS_DIR = path.resolve(__dirname, 'scenarios');
                        const filePath = path.join(MAPS_DIR, mapName);

                        if (fs.existsSync(filePath)) {
                            const content = fs.readFileSync(filePath, 'utf-8');
                            res.setHeader('Content-Type', 'application/json');
                            res.end(content);
                        } else {
                            res.statusCode = 404;
                            res.end('Not found');
                        }
                    } else if (parsedUrl.pathname === '/api/maps' && req.method === 'POST') {
                        const MAPS_DIR = path.resolve(__dirname, 'scenarios');
                        if (!fs.existsSync(MAPS_DIR)) {
                            fs.mkdirSync(MAPS_DIR, { recursive: true });
                        }
                        const { name, data } = req.body;
                        const filename = name || `scenario_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                        const filePath = path.join(MAPS_DIR, filename);

                        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                        res.statusCode = 200;
                        res.end(JSON.stringify({ success: true, filename }));
                    } else if (parsedUrl.pathname.startsWith('/api/maps/') && req.method === 'DELETE') {
                        const mapName = parsedUrl.pathname.split('/').pop();
                        const MAPS_DIR = path.resolve(__dirname, 'scenarios');
                        const filePath = path.join(MAPS_DIR, mapName);

                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            res.statusCode = 200;
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.statusCode = 404;
                            res.end('Not found');
                        }
                    } else {
                        next()
                    }
                })
            }
        }
    ],
    server: {
        host: true,
        port: 5173,
        watch: {
            usePolling: true
        },
        hmr: {
            clientPort: 5173
        }
    }
})
