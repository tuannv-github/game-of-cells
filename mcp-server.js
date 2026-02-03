
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const MCP_PORT = 40002;
const API_BASE = 'http://localhost:40001/api';

const app = express();
app.use(cors());
app.use(express.json());

// Logging Setup
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}
const LOG_FILE = path.join(LOG_DIR, 'mcp.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
    console.log(message);
}

// Tool Definitions
const TOOLS = [
    {
        name: "get_state",
        description: "Get the current state of the world, including levels, minions, properties, and energy.",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "step",
        description: "Execute the next simulation step with the specified active cells.",
        inputSchema: {
            type: "object",
            properties: {
                on: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of cell IDs that should be turned ON. All other cells will be OFF."
                }
            },
            required: ["on"]
        }
    }
];

// Helper to query the main game server
async function queryGameServer(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`Game server error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

// MCP over HTTP Handler
app.post('/mcp', async (req, res) => {
    const { method, params, id } = req.body;
    log(`[REQ] ${method} (id: ${id})`);

    try {
        switch (method) {
            case 'initialize':
                return res.json({
                    jsonrpc: "2.0",
                    id,
                    result: {
                        protocolVersion: "2024-11-05",
                        capabilities: { tools: {} },
                        serverInfo: { name: "Game of Cells Player", version: "1.0.0" }
                    }
                });

            case 'notifications/initialized':
                return res.send('ok');

            case 'tools/list':
                return res.json({
                    jsonrpc: "2.0",
                    id,
                    result: { tools: TOOLS }
                });

            case 'tools/call':
                const { name, arguments: args } = params;
                let result;

                if (name === "get_state") {
                    const data = await queryGameServer('/player/get-state');
                    if (data.error) {
                        result = { content: [{ type: "text", text: `Error: ${data.error}` }], isError: true };
                    } else {
                        result = { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
                    }
                } else if (name === "step") {
                    const on = args?.on || [];
                    const data = await queryGameServer('/player/step', 'POST', { on });
                    if (data.error) {
                        result = { content: [{ type: "text", text: `Error: ${data.error}` }], isError: true };
                    } else {
                        let output = `Step ${data.currentStep} executed.\n`;
                        if (data.gameOver) output += `GAME OVER: ${data.msg}\n`;
                        else output += `Result: ${data.msg}\n`;
                        output += `Energy: ${data.energyConsumed?.toFixed(1) || 0} consumed, ${data.energyLeft?.toFixed(1) || 0} left.`;
                        result = { content: [{ type: "text", text: output }] };
                    }
                } else {
                    return res.status(404).json({
                        jsonrpc: "2.0",
                        id,
                        error: { code: -32601, message: `Tool not found: ${name}` }
                    });
                }

                return res.json({
                    jsonrpc: "2.0",
                    id,
                    result
                });

            default:
                log(`[ERR] Method not found: ${method}`);
                return res.status(404).json({
                    jsonrpc: "2.0",
                    id,
                    error: { code: -32601, message: "Method not found" }
                });
        }
    } catch (error) {
        log(`[ERR] Internal error: ${error.message}`);
        res.status(500).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: error.message }
        });
    }
});

app.listen(MCP_PORT, () => {
    log(`MCP Player Server running on port ${MCP_PORT}`);
    log(`Endpoint: http://localhost:${MCP_PORT}/mcp`);
});
