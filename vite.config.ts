import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';

function walkFiles(dir: string, baseDir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, baseDir));
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      results.push(`/${rel}`);
    }
  }
  return results;
}

function tawasulPwaBuildPlugin(): Plugin {
  return {
    name: 'tawasul-pwa-build',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist');
      if (!fs.existsSync(distDir)) return;

      const allFiles = walkFiles(distDir, distDir).sort();
      const precacheUrls = Array.from(
        new Set([
          '/',
          ...allFiles.filter((file) => {
            if (file === '/sw.js') return false;
            return (
              file === '/index.html' ||
              file === '/manifest.json' ||
              file === '/icon.svg' ||
              file === '/theme-init.js' ||
              file === '/sw-register.js' ||
              file.startsWith('/assets/') ||
              file.startsWith('/icons/') ||
              file.startsWith('/seed/')
            );
          }),
        ])
      );

      // Compute deterministic build hash over emitted assets
      const hash = crypto.createHash('sha256');
      for (const rel of precacheUrls) {
        if (rel === '/') continue;
        const full = path.join(distDir, rel.slice(1));
        if (fs.existsSync(full)) {
          hash.update(rel);
          hash.update(fs.readFileSync(full));
        }
      }
      const buildVersion = hash.digest('hex').slice(0, 10);

      // 1. Inject precache asset list and build hash into dist/sw.js
      const swPath = path.join(distDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');
        swContent = swContent.replace("'__BUILD_HASH__'", `'${buildVersion}'`);
        swContent = swContent.replace(
          /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
          `const PRECACHE_ASSETS = ${JSON.stringify(precacheUrls, null, 2)};`
        );
        fs.writeFileSync(swPath, swContent, 'utf-8');
      }

      // 2. Preload the two most used woff2 fonts (Cairo Arabic 400 and 700) in dist/index.html (F11)
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8');
        const font400 = allFiles.find((f) => /\/assets\/cairo-arabic-400-normal.*\.woff2$/.test(f));
        const font700 = allFiles.find((f) => /\/assets\/cairo-arabic-700-normal.*\.woff2$/.test(f));
        const preloadTags = [font400, font700]
          .filter((f): f is string => Boolean(f))
          .map(
            (href) =>
              `    <link rel="preload" as="font" type="font/woff2" crossorigin href="${href}" />`
          )
          .join('\n');

        if (preloadTags && !html.includes('as="font"')) {
          html = html.replace('</head>', `${preloadTags}\n  </head>`);
          fs.writeFileSync(indexPath, html, 'utf-8');
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), tawasulPwaBuildPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)/,
                priority: 20,
              },
              {
                name: 'vendor-zod',
                test: /node_modules[\\/]zod/,
                priority: 15,
              },
              {
                name: 'vendor',
                test: /node_modules/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
