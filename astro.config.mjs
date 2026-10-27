// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1', port: 4321 },
  vite: { server: { strictPort: true } },
  redirects: { '/': '/principal' },
  adapter: node({ mode: 'standalone' }),
});
