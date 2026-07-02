import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'

// Read envs for dev server (these are provided by docker-compose)
const DEV_HOST = process.env.VITE_DEV_HOST ?? '0.0.0.0'             // where Vite binds
const DEV_PORT = Number(process.env.VITE_DEV_PORT ?? 3000)         // external map 3000:3000

// Proxy target: DEV_PROXY_TARGET in Docker (service hostname); else VITE_BACKEND_API_URL; local fallback
const rawBackend =
    process.env.DEV_PROXY_TARGET ?? process.env.VITE_BACKEND_API_URL ?? '127.0.0.1:5001'
const BACKEND_API_URL = /^https?:\/\//i.test(rawBackend) ? rawBackend : `http://${rawBackend}`


// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    clearScreen: false,
    server: {
        host: DEV_HOST,         // 0.0.0.0 so it’s reachable from host
        port: DEV_PORT,
        strictPort: true,
        watch: {
            usePolling: true,   // crucial for Docker bind mounts
            interval: 100       // ms
        },
        proxy: {
            '/api': {
                target: BACKEND_API_URL,
                changeOrigin: true,
            },
        },
        // HMR is configured automatically when accessed via localhost.
        // If you want to test on another device over your LAN and keep hot reload working,
        // add an explicit hmr.host here (e.g. your machine’s LAN IP).
    },
})