import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Enable HTTPS for local dev only when explicitly requested (npm run dev:https),
// so plain `npm run dev` still behaves exactly as before for anyone not
// testing camera access from a phone.
const useHttps = process.env.VITE_HTTPS === "true";

export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    https: useHttps,
    // Bind to all network interfaces (not just localhost) so a phone on the
    // same Wi-Fi can reach this dev server via your computer's LAN IP.
    host: true,
    proxy: {
      // Lets the client call fetch("/api/...") in dev without hardcoding
      // the backend origin, and avoids CORS entirely in local dev.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
