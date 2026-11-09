import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwind()], envDir: "../..", server: { proxy: { "/api": "http://localhost:8080", "/sitemap.xml": "http://localhost:8080", "/share": "http://localhost:8080" } } });
