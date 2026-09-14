import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 5181}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, _req, res) => {
            const msg =
              "API injoignable sur le port " +
              (process.env.API_PORT || 5181) +
              ". Lancez `npm run dev` (API + front), pas seulement le front.";
            console.error(
              "\x1b[33m[proxy]\x1b[0m",
              msg,
              `(${(err as NodeJS.ErrnoException).code ?? err.message})`,
            );
            if (res && "writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: msg }));
            }
          });
        },
      },
    },
  },
});
