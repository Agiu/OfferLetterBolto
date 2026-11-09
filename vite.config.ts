import path from 'node:path';
import type { Connect } from 'vite';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiHandler } from './server/api';

/**
 * Serves the offers database (data/bolto.db) at /api from both `vite` (dev) and `vite preview`.
 * `vite build` doesn't start a server, so it never opens the database.
 */
function offersApi(): Plugin {
  let root = process.cwd();

  const mount = async (middlewares: Connect.Server) => {
    // Imported here rather than at the top: node:sqlite logs an "experimental" warning on load.
    const { openDatabase } = await import('./server/database');
    const db = openDatabase(path.join(root, 'data', 'bolto.db'));
    middlewares.use('/api', createApiHandler(db));
  };

  return {
    name: 'bolto-offers-api',
    configResolved(config) {
      root = config.root;
    },
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

/**
 * The promotional page is a static site in public/promo. Built and hosted, /promo/ serves its
 * index.html like any folder. Vite's own servers send unknown URLs to the React app instead, so
 * here /promo goes to /promo/ and /promo/ to the page.
 */
function promoPage(): Plugin {
  const route: Connect.NextHandleFunction = (req, res, next) => {
    const [pathname, query] = (req.url ?? '').split('?');
    const search = query ? `?${query}` : '';
    if (pathname === '/promo') {
      res.statusCode = 301;
      res.setHeader('Location', `/promo/${search}`);
      res.end();
      return;
    }
    if (pathname === '/promo/') req.url = `/promo/index.html${search}`;
    next();
  };

  return {
    name: 'bolto-promo-page',
    configureServer: (server) => {
      server.middlewares.use(route);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(route);
    },
  };
}

export default defineConfig({
  plugins: [react(), offersApi(), promoPage()],
});
