#!/usr/bin/env node
/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — GÉNÉRATEUR DU COIN DES PARENTS
 * Usage (depuis la racine du projet) :  node _outils/generer-coin-des-parents.mjs
 *
 * Lit coin-des-parents/manifest.json et les sources Markdown de
 * _editorial/coin-des-parents/, puis écrit des pages HTML statiques.
 * Aucune dépendance : Node.js 18 ou plus suffit. Le site publié reste
 * 100 % HTML statique ; ce script ne s'exécute jamais sur le serveur.
 *
 * Version 1 (étape 3) : page d'accueil de la rubrique uniquement.
 * Les pages articles, catégories et le sitemap viendront aux étapes suivantes.
 * ==========================================================================
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_RUBRIQUE = join(RACINE, 'coin-des-parents');
const DOSSIER_EDITORIAL = join(RACINE, '_editorial', 'coin-des-parents');
const MODELES = join(RACINE, '_outils', 'modeles');
const URL_PRODUCTION = 'https://ecolematernellelila.com/';
const MOTS_PAR_MINUTE = 200;

const erreurs = [];
const echec = (msg) => erreurs.push(msg);

/* ---------- Utilitaires ---------- */
const echapper = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function lireMarkdown(chemin) {
  const brut = readFileSync(chemin, 'utf8').replace(/\r\n/g, '\n');
  const m = brut.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  let corps = brut;
  if (m) {
    corps = m[2];
    for (const ligne of m[1].split('\n')) {
      const kv = ligne.match(/^([\w_]+):\s*"?(.*?)"?\s*$/);
      if (kv) meta[kv[1]] = kv[2];
    }
  }
  return { meta, corps };
}

/** Titres H2 du corps, hors conclusion et sources. */
function sectionsPrincipales(corps) {
  return corps.split('\n')
    .filter((l) => /^## /.test(l))
    .map((l) => l.replace(/^## /, '').trim())
    .filter((t) => !/^en conclusion/i.test(t) && !/^sources/i.test(t));
}

/** Temps de lecture : mots du texte éditorial (sans en-tête, titre H1 ni sources). */
function tempsDeLecture(corps) {
  const sansSources = corps.split(/\n## Sources[^\n]*\n/i)[0];
  const texte = sansSources.replace(/^# .*$/m, '').replace(/[#*_>`\[\]()]/g, ' ');
  const mots = texte.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { mots, minutes: Math.max(1, Math.round(mots / MOTS_PAR_MINUTE)) };
}

/* ---------- Lecture et contrôles du manifeste ---------- */
const manifeste = JSON.parse(readFileSync(join(DOSSIER_RUBRIQUE, 'manifest.json'), 'utf8'));
const categories = new Map(manifeste.categories.map((c) => [c.slug, c]));

for (const c of manifeste.categories) {
  if (!c.slug || !c.name) echec(`Catégorie incomplète : ${JSON.stringify(c)}`);
  if (!c.short_name) echec(`Catégorie « ${c.name} » : champ short_name manquant`);
}
const slugs = new Set();
for (const a of manifeste.articles) {
  if (slugs.has(a.slug)) echec(`Slug en double : ${a.slug}`);
  slugs.add(a.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) echec(`Slug non conforme (minuscules, chiffres, tirets) : ${a.slug}`);
  if (!categories.has(a.category)) echec(`Catégorie inconnue pour ${a.slug} : ${a.category}`);
  if (!a.title) echec(`Titre manquant : ${a.slug}`);
  if (!(a.excerpt || a.meta_description)) echec(`Ni extrait ni meta description : ${a.slug}`);
  const source = join(DOSSIER_EDITORIAL, a.file || '');
  if (!a.file || !existsSync(source)) { echec(`Source Markdown introuvable pour ${a.slug} : ${a.file}`); continue; }
  const { meta, corps } = lireMarkdown(source);
  if (meta.slug && meta.slug !== a.slug) echec(`Slug différent entre manifeste et Markdown : ${a.slug} / ${meta.slug}`);
  if (meta.categorie && meta.categorie !== a.category) echec(`Catégorie différente entre manifeste et Markdown : ${a.slug}`);
  a._corps = corps;
  a._lecture = tempsDeLecture(corps);
}
const aLaUne = manifeste.articles.filter((a) => a.featured === true);
if (aLaUne.length !== 1) echec(`Il faut exactement 1 article "featured" (trouvé : ${aLaUne.length})`);
if (typeof manifeste.total_articles === 'number' && manifeste.total_articles !== manifeste.articles.length) {
  echec(`total_articles (${manifeste.total_articles}) ≠ nombre d'articles (${manifeste.articles.length})`);
}
for (const c of manifeste.categories) {
  const reel = manifeste.articles.filter((a) => a.category === c.slug).length;
  if (typeof c.count === 'number' && c.count !== reel) echec(`Compte saisi pour « ${c.name} » (${c.count}) ≠ compte réel (${reel})`);
}

if (erreurs.length) {
  console.error('Génération interrompue :\n - ' + erreurs.join('\n - '));
  process.exit(1);
}

/* ---------- Fragments HTML ---------- */
const extrait = (a) => a.excerpt || a.meta_description;       // champ "excerpt" prioritaire s'il existe
const urlArticle = (a) => `articles/${a.slug}.html`;
const visuel = (a) => `<span class="cdp-illu"><svg class="cdp-wash"><use href="#cdp-wash"/></svg><svg class="cdp-illu-ico" viewBox="0 0 24 24"><use href="#cdp-ico-${a.category}"/></svg></span>`;

function carteArticle(a, indent) {
  const c = categories.get(a.category);
  return [
    `<article class="cdp-post" data-cdp-slug="${a.slug}" data-categorie="${a.category}">`,
    `  <a class="cdp-post-media" href="${urlArticle(a)}" tabindex="-1" aria-hidden="true">${visuel(a)}</a>`,
    `  <span class="cdp-chip">${echapper(c.name)}</span>`,
    `  <h3><a href="${urlArticle(a)}">${echapper(a.title)}</a></h3>`,
    `  <p class="cdp-excerpt">${echapper(extrait(a))}</p>`,
    `</article>`,
  ].map((l) => indent + l).join('\n');
}

function blocALaUne(a, indent) {
  const c = categories.get(a.category);
  const sections = sectionsPrincipales(a._corps);
  return [
    `<article class="cdp-featured" data-cdp-slug="${a.slug}" data-categorie="${a.category}">`,
    `  <a class="cdp-featured-media" href="${urlArticle(a)}" tabindex="-1" aria-hidden="true">`,
    `    ${visuel(a)}`,
    `    <span class="cdp-featured-tag cdp-brand">À la une</span>`,
    `  </a>`,
    `  <div class="cdp-featured-body">`,
    `    <span class="cdp-chip">${echapper(c.name)}</span>`,
    `    <h3><a href="${urlArticle(a)}">${echapper(a.title)}</a></h3>`,
    `    <p>${echapper(extrait(a))}</p>`,
    ...(sections.length ? [
      `    <ul class="cdp-toc" aria-label="Dans cet article">`,
      ...sections.map((s) => `      <li>${echapper(s)}</li>`),
      `    </ul>`,
    ] : []),
    `    <div class="cdp-meta">`,
    `      <span class="cdp-by"><img src="../assets/images/logo-vertical-ecole-maternelle-lila.svg" alt="" width="26" height="26">L'équipe de l'École Maternelle Lila</span>`,
    `      <span class="cdp-sep" aria-hidden="true"></span><span>${a._lecture.minutes} min de lecture</span>`,
    `    </div>`,
    `    <a class="cdp-link-hand" href="${urlArticle(a)}">Lire l'article<span class="cdp-sr-only"> : ${echapper(a.title)}</span> <svg aria-hidden="true"><use href="#cdp-arrow"/></svg></a>`,
    `  </div>`,
    `</article>`,
  ].map((l) => indent + l).join('\n');
}

function donneesStructurees() {
  const url = URL_PRODUCTION + 'coin-des-parents/';
  const graphe = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url + '#page',
        url,
        name: 'Le Coin des parents',
        description: 'Des conseils simples et bienveillants rédigés par l’équipe de l’École Maternelle Lila pour les parents d’enfants de 15 mois à 6 ans.',
        inLanguage: 'fr',
        isPartOf: { '@type': 'WebSite', name: 'École Maternelle Lila', url: URL_PRODUCTION },
        publisher: { '@type': 'Organization', name: 'École Maternelle Lila', url: URL_PRODUCTION },
        breadcrumb: { '@id': url + '#fil-ariane' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: manifeste.articles.length,
          itemListElement: manifeste.articles.map((a, i) => ({
            '@type': 'ListItem', position: i + 1, url: url + urlArticle(a), name: a.title,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': url + '#fil-ariane',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: URL_PRODUCTION },
          { '@type': 'ListItem', position: 2, name: 'Le Coin des parents', item: url },
        ],
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(graphe, null, 2)}\n  </script>`;
}

/* ---------- Page d'accueil ---------- */
let page = readFileSync(join(MODELES, 'accueil.html'), 'utf8').replace(/\r\n/g, '\n');

// Les cartes thématiques du modèle doivent correspondre exactement aux catégories du manifeste.
const cartesModele = [...page.matchAll(/<a class="cdp-cat" data-categorie="([^"]+)"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>/g)]
  .map((m) => ({ slug: m[1], nom: m[2].replace(/&#39;|’/g, "'") }));
const attendues = manifeste.categories.map((c) => ({ slug: c.slug, nom: c.name.replace(/’/g, "'") }));
if (JSON.stringify(cartesModele) !== JSON.stringify(attendues)) {
  console.error('Génération interrompue : les cartes thématiques du modèle ne correspondent pas au manifeste.');
  console.error('  Modèle    :', JSON.stringify(cartesModele));
  console.error('  Manifeste :', JSON.stringify(attendues));
  process.exit(1);
}

const remplacer = (repere, contenu) => {
  const motif = new RegExp(`^([ \\t]*)<!-- ${repere} -->$`, 'm');
  const m = page.match(motif);
  if (!m) { console.error(`Repère <!-- ${repere} --> absent du modèle`); process.exit(1); }
  page = page.replace(motif, () => contenu(m[1] || ''));
};

remplacer('cdp:jsonld', (i) => i + donneesStructurees());
remplacer('cdp:a-la-une', (i) => blocALaUne(aLaUne[0], i));
remplacer('cdp:articles', () => manifeste.articles.map((a) => carteArticle(a, '          ')).join('\n'));

const entete = '<!-- Fichier généré par _outils/generer-coin-des-parents.mjs à partir de _outils/modeles/accueil.html et de manifest.json. Ne pas modifier directement. -->\n';
page = page.replace(/^<!DOCTYPE html>\n/, (d) => d + entete);
writeFileSync(join(DOSSIER_RUBRIQUE, 'index.html'), page, 'utf8');

/* ---------- Bilan ---------- */
console.log('coin-des-parents/index.html généré');
console.log(`  ${manifeste.articles.length} articles · à la une : ${aLaUne[0].slug} (${aLaUne[0]._lecture.minutes} min, ${aLaUne[0]._lecture.mots} mots)`);
for (const c of manifeste.categories) {
  console.log(`  ${c.short_name.padEnd(24)} ${manifeste.articles.filter((a) => a.category === c.slug).length}`);
}
