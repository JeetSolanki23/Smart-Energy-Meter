import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devHost = env.VITE_DEV_HOST || "::";
  const devPort = Number(env.VITE_DEV_PORT || 8080);
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";

  return {
    server: {
      host: devHost,
      port: Number.isNaN(devPort) ? 8080 : devPort,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
