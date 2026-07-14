import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import react from "@vitejs/plugin-react";
import { normalizeBackendUrl } from "./src/utils/env/backendUrl";

let lastBackendDownLogAt = 0;

function attachBackendProxyGuard(
  proxy: {
    on(
      event: "error",
      listener: (
        err: NodeJS.ErrnoException,
        req: IncomingMessage,
        res: IncomingMessage | Socket,
      ) => void,
    ): void;
  },
  label: string,
  backendUrl: string,
) {
  proxy.on("error", (err, _req, res) => {
    if (err.code === "ECONNREFUSED") {
      const now = Date.now();
      if (now - lastBackendDownLogAt > 15000) {
        lastBackendDownLogAt = now;
        console.warn(
          `\n[vite] Backend unavailable (${label}, ${backendUrl}).\n` +
            "       Run it in a separate terminal: cd backend && cargo run\n" +
            "       or: npm run dev:all (frontend + backend together)\n",
        );
      }

      if ("writeHead" in res && !res.headersSent) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Backend unavailable" }));
      }
      return;
    }

    console.error(`[vite] proxy ${label}:`, err.message);
  });
}

function backendProxy(
  target: string,
  label: string,
  ws = false,
): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws,
    configure: (proxy) => attachBackendProxyGuard(proxy, label, target),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = normalizeBackendUrl(env.VITE_BACKEND_URL || "");

  if (mode === "production" && !env.VITE_TURNSTILE_SITE_KEY?.trim()) {
    throw new Error(
      "VITE_TURNSTILE_SITE_KEY must be set for production builds (frontend/.env).",
    );
  }

  if (mode === "production") {
    const configuredBackend = env.VITE_BACKEND_URL?.trim();
    if (!configuredBackend) {
      throw new Error(
        "VITE_BACKEND_URL must be set for production builds (frontend/.env).",
      );
    }

    try {
      const parsed = new URL(configuredBackend);
      const host = parsed.hostname.toLowerCase();
      if (host === "127.0.0.1" || host === "::1" || host === "[::1]") {
        throw new Error("loopback");
      }
    } catch {
      throw new Error(
        "VITE_BACKEND_URL must be a valid public backend URL for production builds.",
      );
    }
  }

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": backendProxy(backendUrl, "HTTP /api"),
        "/whitelist": backendProxy(backendUrl, "HTTP /whitelist"),
        "/ws": backendProxy(backendUrl, "WebSocket /ws", true),
      },
    },
  };
});
