/**
 * Sends a log message to the server-side log file via the Vite middleware bridge.
 * Also logs to the local browser console.
 */
export const remoteLog = async (message, level = 'info') => {
    // Local Browser Log
    const formattedMessage = `[${level.toUpperCase()}] ${message}`;

    if (level === 'error') console.error(formattedMessage);
    else if (level === 'warn') console.warn(formattedMessage);
    else console.log(formattedMessage);
};
