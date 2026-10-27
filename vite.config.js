import { defineConfig } from 'vite';
import { createReadStream } from 'node:fs';

export default defineConfig({
  server: { watch: { ignored: ['**/.test-results/**'] } },
  plugins: [{
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