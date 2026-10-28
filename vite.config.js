import { defineConfig } from 'vite';
import { createReadStream } from 'node:fs';

export default defineConfig({
  server: { watch: { ignored: ['**/.test-results/**'] } },
  plugins: [{
    name: 'prebuilt-demo-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        if (!path || !/^\/dist\/(?:extensions\/)?[a-z][a-z0-9.-]*\.(?:js|css)$/.test(path)) { next(); return; }
        const stream = createReadStream(new URL(`.${path}`, import.meta.url));
        stream.on('open', () => {
          response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
          response.setHeader('Cache-Control', 'no-cache');
          stream.pipe(response);
        });
        stream.on('error', next);
      });
    },
  }, {
    name: 'demo-host-mermaid',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/host-assets/mermaid.min.js') { next(); return; }
        response.setHeader('Content-Type', 'application/javascript');
        const stream = createReadStream(new URL('./node_modules/mermaid/dist/mermaid.min.js', import.meta.url));
        stream.on('error', () => { response.statusCode = 404; response.end('Host Mermaid asset is unavailable.'); });
        stream.pipe(response);
      });
    },
  }],
});