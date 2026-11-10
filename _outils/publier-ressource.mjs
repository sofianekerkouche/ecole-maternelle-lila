#!/usr/bin/env node
/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — PUBLIER UNE RESSOURCE DE LA MÉDIATHÈQUE
 * Usage (depuis la racine du projet) :
 *   node _outils/publier-ressource.mjs <slug> <fichier.pdf> <dossier-des-apercus>
 * Exemple :
 *   node _outils/publier-ressource.mjs les-animaux-en-francais-et-en-arabe ^
 *     ../_mediatheque/01-animaux-francais-arabe/version-finale/les-animaux-en-francais-et-en-arabe.pdf ^
 *     ../_mediatheque/01-animaux-francais-arabe/version-finale/apercus
 *
 * En une seule commande :
 *   1. copie le PDF dans mediatheque-educative/fichiers/<slug>.pdf ;
 *   2. convertit les aperçus (page-1.png, page-2.png…) en WebP de 800 px de large,
 *      dans mediatheque-educative/apercus/<slug>-1.webp… (Microsoft Edge, déjà installé, sans dépendance) ;
 *   3. passe la ressource en « disponible » dans le catalogue (fichier, pages, aperçus, date de mise en ligne) ;
 *   4. relance le générateur de la Médiathèque.
 * Refuse toute ressource réservée aux familles : leurs PDF ne doivent jamais entrer dans ce dépôt public.
 * Rien n'est publié en ligne : il reste à vérifier, commiter, puis pousser après validation.
 * ==========================================================================
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'mediatheque-educative');
const CATALOGUE = join(DOSSIER, 'catalogue.json');
const LARGEUR = 800;
const QUALITE = 0.82;
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
  .find((p) => existsSync(p));
const stop = (msg) => { console.error('Publication interrompue : ' + msg); process.exit(1); };

const [slug, pdf, dossierApercus] = process.argv.slice(2);
if (!slug || !pdf || !dossierApercus) stop('usage : node _outils/publier-ressource.mjs <slug> <fichier.pdf> <dossier-des-apercus>');

/* ---------- Contrôles ---------- */
const brut = readFileSync(CATALOGUE, 'utf8');
const catalogue = JSON.parse(brut);
const r = catalogue.ressources.find((x) => x.slug === slug);
if (!r) stop(`ressource inconnue dans le catalogue : ${slug}`);
if (r.acces !== 'public') stop(`« ${r.titre} » est réservée aux familles : son PDF ne doit pas être déposé dans le dépôt public (protection prévue plus tard).`);
if (!existsSync(pdf) || !/\.pdf$/i.test(pdf)) stop(`PDF introuvable : ${pdf}`);
if (!readFileSync(pdf).subarray(0, 5).toString().startsWith('%PDF')) stop(`le fichier n'est pas un PDF valide : ${pdf}`);
if (!existsSync(dossierApercus) || !statSync(dossierApercus).isDirectory()) stop(`dossier d'aperçus introuvable : ${dossierApercus}`);
const pages = readdirSync(dossierApercus)
  .map((f) => ({ f, n: Number((f.match(/(\d+)\.(png|jpe?g|webp)$/i) || [])[1]) }))
  .filter((x) => x.n).sort((a, b) => a.n - b.n);
if (!pages.length) stop(`aucun aperçu numéroté (page-1.png, page-2.png…) dans ${dossierApercus}`);
if (!EDGE) stop('Microsoft Edge introuvable (nécessaire pour convertir les aperçus).');
// Nombre de pages lu dans le PDF (objets /Type /Page), à défaut le nombre d'aperçus.
const nbPagesPdf = (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
const nbPages = nbPagesPdf || pages.length;

/* ---------- 1. PDF ---------- */
mkdirSync(join(DOSSIER, 'fichiers'), { recursive: true });
const fichier = `mediatheque-educative/fichiers/${slug}.pdf`;
copyFileSync(pdf, join(RACINE, fichier));
console.log(`PDF copié → ${fichier} (${Math.round(statSync(pdf).size / 1024)} Ko, ${nbPages} pages)`);

/* ---------- 2. Aperçus en WebP (Edge sans interface, protocole DevTools) ---------- */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const port = 9500 + Math.floor(Math.random() * 300);
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lila-apercus-'))}`,
  '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
let info;
for (let k = 0; k < 60 && !info; k++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
if (!info) { edge.kill(); stop('Edge ne répond pas.'); }
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));
let id = 0; const attente = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && attente.has(m.id)) { const p = attente.get(m.id); attente.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } };
const send = (method, params = {}, sessionId) => new Promise((r2, j) => { const i = ++id; attente.set(i, { r: r2, j }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

mkdirSync(join(DOSSIER, 'apercus'), { recursive: true });
const apercus = [];
try {
  for (const { f, n } of pages) {
    const ext = f.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
    const source = `data:image/${ext};base64,${readFileSync(join(dossierApercus, f)).toString('base64')}`;
    const expr = `(async () => {
      const bmp = await createImageBitmap(await (await fetch(${JSON.stringify(source)})).blob());
      const w = Math.min(${LARGEUR}, bmp.width), h = Math.round(bmp.height * w / bmp.width);
      const c = new OffscreenCanvas(w, h); const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
      const b = await c.convertToBlob({ type: 'image/webp', quality: ${QUALITE} });
      const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
      return btoa(s);
    })()`;
    const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'conversion impossible');
    const chemin = `mediatheque-educative/apercus/${slug}-${n}.webp`;
    writeFileSync(join(RACINE, chemin), Buffer.from(res.result.value, 'base64'));
    apercus.push(chemin);
    console.log(`Aperçu ${n} → ${chemin} (${Math.round(statSync(join(RACINE, chemin)).size / 1024)} Ko)`);
  }
} finally { ws.close(); edge.kill(); }

/* ---------- 3. Catalogue (seuls les champs de cette ressource changent) ---------- */
const aujourdhui = new Date();
const iso = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
Object.assign(r, { statut: 'disponible', fichier, pages: nbPages, apercus, publie_le: r.publie_le || iso });
writeFileSync(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n', 'utf8');
console.log(`Catalogue : « ${r.titre} » disponible (mise en ligne le ${r.publie_le})`);

/* ---------- 4. Génération ---------- */
const gen = spawnSync(process.execPath, [join(RACINE, '_outils', 'generer-mediatheque.mjs')], { stdio: 'inherit' });
if (gen.status !== 0) stop('le générateur a signalé une erreur (voir ci-dessus).');
console.log('\nÀ faire ensuite : vérifier la fiche dans le navigateur, puis commiter. Rien n’est encore en ligne.');
