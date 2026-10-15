/**
 * Prépare dist/ (export web) pour l'hébergement statique.
 *
 * 1. Expo range les fichiers des paquets (polices, images d'expo-router) dans
 *    dist/assets/node_modules/… ; or Vercel exclut TOUT dossier « node_modules » d'un
 *    déploiement : les polices renvoyaient la page HTML et le navigateur affichait Times.
 *    On renomme le dossier en dist/assets/pkg/ et on corrige les chemins dans le code exporté.
 * 2. On écrit dist/vercel.json : toutes les routes (/i/<code>, /v/<code>…) servent index.html.
 *
 * Lancé par `npm run build:web` ; `node scripts/prepare-web-deploy.ts` pour le relancer seul.
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const from = join(dist, 'assets', 'node_modules');
const to = join(dist, 'assets', 'pkg');

if (existsSync(from)) renameSync(from, to);

let patched = 0;
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|html|json|css)$/.test(name)) {
      const before = readFileSync(path, 'utf8');
      const after = before.replaceAll('/assets/node_modules/', '/assets/pkg/');
      if (after !== before) {
        writeFileSync(path, after);
        patched++;
      }
    }
  }
};
walk(dist);

writeFileSync(
  join(dist, 'vercel.json'),
  JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2) + '\n',
);

console.log(`✅ dist/ prêt pour l'hébergement : assets/pkg/ (${patched} fichier(s) corrigé(s)), vercel.json`);
