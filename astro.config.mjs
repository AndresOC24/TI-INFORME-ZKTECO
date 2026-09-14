// @ts-check
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  devToolbar: { enabled: false },

  // La vista del informe es /principal; / entra directo ahí.
  redirects: { '/': '/principal' },

  adapter: node({
    mode: 'standalone',
  }),
});