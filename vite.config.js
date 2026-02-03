import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 40000,
        proxy: {
            '/api': {
                target: 'http://localhost:40001',
                changeOrigin: true,
                secure: false,
            }
        },
        watch: {
            usePolling: true
        },
        hmr: {
            clientPort: 40000
        }
    }
})
