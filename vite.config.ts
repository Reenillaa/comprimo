import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict Content-Security-Policy for production builds: no third-party origins at all,
// connect-src limited to this site (the WASM codecs). Dev mode skips it (HMR needs inline code).
const csp = (): Plugin => ({
  name: 'comprimo-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "worker-src 'self' blob:",
      "connect-src 'self'",
      "img-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

export default defineConfig({
  plugins: [react(), csp()],
  // Codecs locate their .wasm via import.meta.url; pre-bundling would break that.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/oxipng', '@jsquash/webp', '@jsquash/avif', '@jsquash/jxl', '@jsquash/resize'],
  },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
