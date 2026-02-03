/**
 * Sends a log message to the server-side log file via the Vite middleware bridge.
 * Also logs to the local browser console.
 */
export const remoteLog = async (message, level = 'info') => {
    // 1. Local Browser Log
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${level.toUpperCase()}] ${message}`;

    if (level === 'error') console.error(formattedMessage);
    else if (level === 'warn') console.warn(formattedMessage);
    else console.log(formattedMessage);

    // 2. Server-side Log Bridge
    try {
        await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, level })
        });
    } catch (err) {
        // Fallback if bridge fails
        console.warn('[LOGGER] Failed to send remote log:', err);
    }
};
