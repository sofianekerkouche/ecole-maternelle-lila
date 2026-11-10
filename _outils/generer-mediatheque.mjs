#!/usr/bin/env node
/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — GÉNÉRATEUR DE LA MÉDIATHÈQUE ÉDUCATIVE
 * Usage (depuis la racine du projet) :  node _outils/generer-mediatheque.mjs
 *
 * Lit mediatheque-educative/catalogue.json (source unique) et écrit des pages HTML statiques :
 *   - mediatheque-educative/index.html                    (accueil : catégories, recherche, filtres, catalogue)
 *   - mediatheque-educative/<categorie>/index.html        (6 pages catégories)
 *   - mediatheque-educative/ressources/<slug>.html        (1 fiche par ressource)
 * Aucune dépendance : Node.js 18 ou plus suffit. Le site publié reste 100 % HTML statique.
 *
 * En-tête, tiroir mobile, pied de page et définitions SVG sont repris du modèle
 * _outils/modeles/accueil.html (le même que le Coin des parents) : le menu reste identique partout.
 *
 * Règle de sécurité (cahier des charges) : une ressource « familles » n'a jamais de fichier dans ce dépôt.
 * Le générateur s'arrête si un PDF privé est référencé ou déposé dans mediatheque-educative/fichiers/.
 * ==========================================================================
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Prévisualisation : pages en « noindex, follow », hors sitemap.
   Passer à false uniquement lors de la mise en ligne validée. */
const PREVISUALISATION = true;

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'mediatheque-educative');
const MODELES = join(RACINE, '_outils', 'modeles');
const URL_PRODUCTION = 'https://ecolematernellelila.com/';
const URL_RUBRIQUE = URL_PRODUCTION + 'mediatheque-educative/';
const ROBOTS = PREVISUALISATION ? 'noindex,follow' : 'index,follow';
const ECOLE = { '@type': 'Organization', name: 'École Maternelle Lila', url: URL_PRODUCTION };
const NOM = 'La Médiathèque éducative';
const ACCES = new Set(['public', 'familles']);
const STATUTS = new Set(['a-venir', 'disponible']);
const LANGUES = { 'Français': 'fr', 'Arabe standard': 'ar', 'Anglais': 'en' };

const erreurs = [];
const echec = (msg) => erreurs.push(msg);
const arreter = () => {
  if (!erreurs.length) return;
  console.error('Génération interrompue :\n - ' + erreurs.join('\n - '));
  process.exit(1);
};

/* ---------- Utilitaires ---------- */
const echapper = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Espaces insécables de la typographie française (fine avant ; ! ?, insécable avant : et dans « »).
const typo = (s) => s
  .replace(/ ([;!?])/g, '\u202F$1')
  .replace(/ :/g, '\u00A0:')
  .replace(/« /g, '«\u00A0').replace(/ »/g, '\u00A0»');
const texte = (s) => typo(echapper(s));
const jsonLd = (graphe, indent = '  ') =>
  `<script type="application/ld+json">\n${JSON.stringify(graphe, null, 2).replace(/<\//g, '<\\/')}\n${indent}</script>`;
const normaliser = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const indenter = (bloc, i) => bloc.split('\n').map((l) => (l ? i + l : l)).join('\n');
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* ---------- Lecture et contrôles du catalogue ---------- */
const catalogue = JSON.parse(readFileSync(join(DOSSIER, 'catalogue.json'), 'utf8'));
const categories = new Map(catalogue.categories.map((c) => [c.slug, c]));
/* Ordre d'affichage partout : ressources disponibles d'abord (les plus récentes en tête), puis les ressources à venir,
   chacune dans l'ordre du catalogue. */
const ressources = [...catalogue.ressources].sort((a, b) => {
  const da = a.statut === 'disponible', db = b.statut === 'disponible';
  if (da !== db) return da ? -1 : 1;
  if (da && a.publie_le !== b.publie_le) return String(b.publie_le).localeCompare(String(a.publie_le));
  return a.numero - b.numero;
});
/* Pastille « Nouveau » : ressources mises en ligne depuis moins de NOUVEAUTE_JOURS jours au moment de la génération.
   Les pages étant statiques, relancer le générateur à chaque publication suffit à faire vieillir les pastilles. */
const NOUVEAUTE_JOURS = 45;
const AUJOURDHUI = new Date();
const estNouvelle = (r) => r.statut === 'disponible' && (AUJOURDHUI - new Date(r.publie_le + 'T00:00:00')) / 864e5 < NOUVEAUTE_JOURS;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (iso) => { const [a, m, j] = iso.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`; };

for (const c of catalogue.categories) {
  if (!SLUG.test(c.slug || '')) echec(`Slug de catégorie non conforme : ${c.slug}`);
  for (const champ of ['nom', 'nom_court', 'description', 'intro']) if (!c[champ]) echec(`Catégorie « ${c.slug} » : champ ${champ} manquant`);
}
const vus = new Set();
for (const r of ressources) {
  const id = r.slug || `n°${r.numero}`;
  if (vus.has(r.slug)) echec(`Slug en double : ${r.slug}`);
  vus.add(r.slug);
  if (!SLUG.test(r.slug || '')) echec(`Slug non conforme (minuscules, chiffres, tirets) : ${id}`);
  for (const champ of ['titre', 'type', 'description']) if (!r[champ]) echec(`${id} : champ ${champ} manquant`);
  if (!categories.has(r.categorie)) echec(`${id} : catégorie inconnue (${r.categorie})`);
  if (!ACCES.has(r.acces)) echec(`${id} : accès inconnu (${r.acces}) — attendu public ou familles`);
  if (!STATUTS.has(r.statut)) echec(`${id} : statut inconnu (${r.statut}) — attendu a-venir ou disponible`);
  if (!(Number.isInteger(r.age_min) && Number.isInteger(r.age_max) && r.age_min <= r.age_max)) echec(`${id} : tranche d'âge invalide`);
  // Fichiers privés : jamais dans le dépôt public.
  if (r.acces === 'familles' && r.fichier) echec(`${id} : une ressource réservée aux familles ne doit pas avoir de champ "fichier" (le PDF ne va pas dans ce dépôt public)`);
  if (r.acces === 'public' && r.statut === 'disponible') {
    if (!r.fichier) echec(`${id} : ressource publique disponible sans champ "fichier"`);
    else if (!/^mediatheque-educative\/fichiers\/[a-z0-9-]+\.pdf$/.test(r.fichier)) echec(`${id} : le fichier doit se trouver dans mediatheque-educative/fichiers/ (${r.fichier})`);
    else if (!existsSync(join(RACINE, r.fichier))) echec(`${id} : fichier introuvable (${r.fichier})`);
    if (!r.pages) echec(`${id} : nombre de pages manquant pour une ressource disponible`);
  }
  if (r.statut === 'disponible') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.publie_le || '') || Number.isNaN(new Date(r.publie_le).getTime())) echec(`${id} : date de mise en ligne "publie_le" manquante ou invalide (format AAAA-MM-JJ)`);
    if (!(r.apercus && r.apercus.length)) echec(`${id} : au moins un aperçu est nécessaire pour une ressource disponible (champ "apercus")`);
    else for (const img of r.apercus) if (!/^mediatheque-educative\/apercus\/[a-z0-9-]+\.(webp|jpg|png)$/.test(img)) echec(`${id} : les aperçus doivent se trouver dans mediatheque-educative/apercus/ (${img})`);
  }
  if (r.fichier && r.statut !== 'disponible') echec(`${id} : champ "fichier" renseigné alors que la ressource n'est pas disponible`);
  for (const img of r.apercus || []) if (!existsSync(join(RACINE, img))) echec(`${id} : aperçu introuvable (${img})`);
  for (const l of r.langues || []) if (!LANGUES[l]) echec(`${id} : langue inconnue (${l})`);
}
const ressourcesDe = (slug) => ressources.filter((r) => r.categorie === slug);
const familles = new Set(ressources.filter((r) => r.acces === 'familles').map((r) => r.slug));
const dossierFichiers = join(DOSSIER, 'fichiers');
if (existsSync(dossierFichiers)) {
  for (const f of readdirSync(dossierFichiers)) {
    const base = f.replace(/\.[^.]+$/, '');
    if (familles.has(base) || [...familles].some((s) => base.startsWith(s))) echec(`mediatheque-educative/fichiers/${f} : fichier d'une ressource réservée aux familles, à retirer du dépôt public`);
  }
}
if (ressources.filter((r) => r.a_la_une).length > 1) echec('Une seule ressource peut être "a_la_une"');
arreter();

/* ---------- Composants partagés, repris du modèle de l'accueil du Coin des parents ---------- */
const modele = readFileSync(join(MODELES, 'accueil.html'), 'utf8').replace(/\r\n/g, '\n');
const extraire = (motif, nom) => {
  const m = modele.match(motif);
  if (!m) { console.error(`Génération interrompue : composant « ${nom} » introuvable dans le modèle.`); process.exit(1); }
  return m[0];
};
const COMPOSANTS = {
  defs: extraire(/  <!-- Définitions SVG[\s\S]*?<\/svg>\n/, 'définitions SVG'),
  entete: extraire(/  <!-- =+\n\s+EN-TÊTE[\s\S]*?<\/aside>\n/, 'en-tête et tiroir mobile'),
  pied: extraire(/  <!-- =+\n\s+PIED DE PAGE[\s\S]*?<\/footer>\n/, 'pied de page'),
};
if (/floating-call/.test(COMPOSANTS.entete + COMPOSANTS.pied)) {
  console.error('Génération interrompue : pas de bouton d’appel flottant dans la rubrique Ressources.');
  process.exit(1);
}

/** Adapte un composant du modèle (Coin des parents, profondeur 1) à la Médiathèque.
    `accueil` : la page est l'accueil de la Médiathèque (marque « Vous êtes ici »). */
function adapter(html, { profondeur, accueil }) {
  let s = html
    // Le Coin des parents n'est plus la rubrique en cours
    .replace(/ aria-current="page"/g, '')
    .replace(/<span class="nav-ressources-here">Vous êtes ici<\/span>/g, '')
    .replace(/ <\/a><\/li>/g, '</a></li>')
    .replace(/href="index\.html"/g, 'href="../coin-des-parents/index.html"');
  if (!/href="\.\.\/mediatheque-educative\/index\.html"/.test(s)) { console.error('Génération interrompue : lien vers la Médiathèque absent d’un composant du modèle (menu, tiroir ou pied de page).'); process.exit(1); }
  if (accueil) {
    s = s
      .replace(/<a class="nav-ressources-item" href="\.\.\/mediatheque-educative\/index\.html">([\s\S]*?<small>[^<]*<\/small>)<\/span>/,
        '<a class="nav-ressources-item is-media-current" href="index.html" aria-current="page">$1<span class="nav-ressources-here">Vous êtes ici</span></span>')
      .replace(/<li><a href="\.\.\/mediatheque-educative\/index\.html">Médiathèque éducative<\/a><\/li>/,
        '<li><a class="is-media-current" href="index.html" aria-current="page">Médiathèque éducative <span class="nav-ressources-here">Vous êtes ici</span></a></li>')
      .replace(/<li><a href="\.\.\/mediatheque-educative\/index\.html">La Médiathèque éducative<\/a><\/li>/,
        '<li><a href="index.html" aria-current="page">La Médiathèque éducative</a></li>');
  }
  if (profondeur === 2) s = s.replace(/(href|src)="\.\.\//g, '$1="../../').replace(/href="index\.html"/g, 'href="../index.html"');
  return s;
}

/* Pictogrammes propres à la Médiathèque (catégories, accès, informations). */
const ico = (corps) => `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${corps}</g>`;
const DEFS_MDT = `  <!-- Pictogrammes de la Médiathèque éducative -->
  <svg class="cdp-svg-defs" aria-hidden="true" focusable="false">
    <defs>
      <symbol id="mdt-ico-premiers-apprentissages" viewBox="0 0 24 24">${ico('<circle cx="7" cy="7" r="3.5"/><path d="M17 3.5 21 10.5h-8Z"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M14 17h7M17.5 13.5v7"/>')}</symbol>
      <symbol id="mdt-ico-activites-creatives" viewBox="0 0 24 24">${ico('<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15.5" cy="7.5" r="1.1"/>')}</symbol>
      <symbol id="mdt-ico-jeux-et-logique" viewBox="0 0 24 24">${ico('<path d="M5 8.5a1 1 0 0 1 1-1h3a2.2 2.2 0 1 1 4 0h3a1 1 0 0 1 1 1v3a2.2 2.2 0 1 1 0 4v3a1 1 0 0 1-1 1h-3a2.2 2.2 0 1 0-4 0H6a1 1 0 0 1-1-1v-3a2.2 2.2 0 1 0 0-4Z"/>')}</symbol>
      <symbol id="mdt-ico-decouverte-du-monde" viewBox="0 0 24 24">${ico('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5M12 3.5C9.7 5.9 8.6 8.7 8.6 12s1.1 6.1 3.4 8.5"/>')}</symbol>
      <symbol id="mdt-ico-langues-eveil-linguistique" viewBox="0 0 24 24">${ico('<path d="M4 4.5h10a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H8.5L5 15.8V13H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M15 8.5h5a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-1v2.8L15.5 17H11a1 1 0 0 1-1-1v-1"/>')}</symbol>
      <symbol id="mdt-ico-vie-quotidienne-autonomie" viewBox="0 0 24 24">${ico('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M12 17.2s-2.6-1.6-2.6-3.3a1.4 1.4 0 0 1 2.6-.8 1.4 1.4 0 0 1 2.6.8c0 1.7-2.6 3.3-2.6 3.3Z"/>')}</symbol>
      <symbol id="mdt-lock" viewBox="0 0 24 24">${ico('<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.5v2"/>')}</symbol>
      <symbol id="mdt-open" viewBox="0 0 24 24">${ico('<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 7.7-1.6"/>')}</symbol>
      <symbol id="mdt-download" viewBox="0 0 24 24">${ico('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>')}</symbol>
      <symbol id="mdt-search" viewBox="0 0 24 24">${ico('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>')}</symbol>
      <symbol id="mdt-age" viewBox="0 0 24 24">${ico('<circle cx="12" cy="12" r="8.5"/><path d="M9 14.2a4 4 0 0 0 6 0M9.5 9.8h.01M14.5 9.8h.01"/>')}</symbol>
      <symbol id="mdt-type" viewBox="0 0 24 24">${ico('<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10Z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h4.5"/>')}</symbol>
      <symbol id="mdt-clock" viewBox="0 0 24 24">${ico('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>')}</symbol>
      <symbol id="mdt-pages" viewBox="0 0 24 24">${ico('<path d="M8 3.5h9a2 2 0 0 1 2 2v11"/><rect x="5" y="7" width="11" height="13.5" rx="2"/>')}</symbol>
      <symbol id="mdt-lang" viewBox="0 0 24 24">${ico('<path d="M4 5.5h9M8.5 3.5v2M6 5.5c.8 3.3 3 5.8 6 7M11 5.5c-.8 3.3-3 5.8-6 7"/><path d="m12.5 20.5 4-9 4 9M14 17.3h5"/>')}</symbol>
      <symbol id="mdt-print" viewBox="0 0 24 24">${ico('<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7Z"/>')}</symbol>
      <symbol id="mdt-pointer" viewBox="0 0 24 24">${ico('<path d="M4.5 12.5h4l2.5-6 3 11 2.5-5h3"/>')}</symbol>
      <symbol id="mdt-close" viewBox="0 0 24 24">${ico('<path d="M6 6l12 12M18 6 6 18"/>')}</symbol>
    </defs>
  </svg>
`;

/* ---------- En-tête de page ---------- */
const PARTAGE = {
  url: URL_PRODUCTION + 'assets/images/coin-des-parents/mediatheque-educative.webp',
  type: 'image/webp', largeur: 1600, hauteur: 900,
  alt: 'Fillette concentrée qui construit avec des blocs de bois devant des étagères de livres',
};
function tete({ titre, description, canonique, typeOg = 'website', ld, profondeur, accueil = false, robots = ROBOTS }) {
  const r = profondeur === 2 ? '../../' : '../';
  return `<!DOCTYPE html>
<!-- Fichier généré par _outils/generer-mediatheque.mjs à partir de mediatheque-educative/catalogue.json. Ne pas modifier directement. -->
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${robots}">
  <title>${echapper(titre)}</title>
  <meta name="description" content="${echapper(description)}">
  <link rel="canonical" href="${canonique}">

  <!-- Open Graph / Réseaux sociaux -->
  <meta property="og:type" content="${typeOg}">
  <meta property="og:locale" content="fr_DZ">
  <meta property="og:site_name" content="École Maternelle Lila">
  <meta property="og:url" content="${canonique}">
  <meta property="og:title" content="${echapper(titre)}">
  <meta property="og:description" content="${echapper(description)}">
  <meta property="og:image" content="${PARTAGE.url}">
  <meta property="og:image:type" content="${PARTAGE.type}">
  <meta property="og:image:width" content="${PARTAGE.largeur}">
  <meta property="og:image:height" content="${PARTAGE.hauteur}">
  <meta property="og:image:alt" content="${echapper(PARTAGE.alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${PARTAGE.url}">
  <meta name="twitter:image:alt" content="${echapper(PARTAGE.alt)}">

  <link rel="icon" type="image/svg+xml" href="${r}assets/images/Logo-principal-Ecole-Maternelle-Lila.svg">

  <!-- Fraunces (titres des rubriques Ressources) ; Nunito et Pacifico sont déjà chargées par style.css -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400&display=swap">

  <link rel="stylesheet" href="${r}css/style.css">
  <link rel="stylesheet" href="${r}css/menu-ressources.css">
  <link rel="stylesheet" href="${r}css/coin-des-parents.css">
  <link rel="stylesheet" href="${r}css/mediatheque.css">

  ${jsonLd(ld)}
</head>
<body class="cdp mdt">

${COMPOSANTS.defs}${DEFS_MDT}
${adapter(COMPOSANTS.entete, { profondeur, accueil })}`;
}

function pied({ profondeur, accueil = false }) {
  const r = profondeur === 2 ? '../../' : '../';
  return `
${adapter(COMPOSANTS.pied, { profondeur, accueil })}
  <!-- Rubrique « Ressources » : pas de bouton d'appel flottant. Retour en haut : composant du site (style.css, main.js). -->
  <button class="back-to-top-btn" id="back-to-top" aria-label="Remonter en haut de page">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  </button>

  <script src="${r}js/main.js"></script>
  <script src="${r}js/menu-ressources.js"></script>
  <script src="${r}js/mediatheque.js"></script>
</body>
</html>
`;
}

/* ---------- Fragments ---------- */
const age = (r) => `${r.age_min} à ${r.age_max} ans`;
const urlProdRessource = (r) => `${URL_RUBRIQUE}ressources/${r.slug}.html`;
const urlProdCategorie = (c) => `${URL_RUBRIQUE}${c.slug}/`;
const svg = (id, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#${id}"/></svg>`;
const libelleAcces = (r) => (r.acces === 'public' ? 'Accès libre' : 'Réservée aux familles de l’école');
const motsCles = (r) => normaliser([r.titre, r.description, r.type, categories.get(r.categorie).nom, ...(r.langues || []), ...(r.mots_cles || [])].join(' '));
const filAriane = (elements) => ({
  '@type': 'BreadcrumbList',
  itemListElement: elements.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(item ? { item } : {}) })),
});

/** Visuel d'une ressource : premier aperçu s'il existe, sinon une feuille A4 stylisée aux couleurs de la catégorie. */
function visuel(r, racine, grand = false) {
  // Avec un aperçu : la vraie première page, présentée sur la même feuille inclinée que le visuel d'attente.
  const contenu = r.apercus && r.apercus.length
    ? `<span class="mdt-sheet mdt-sheet--apercu"><img src="${racine}${r.apercus[0]}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="mdt-sheet"><span class="mdt-sheet-band"></span><span class="mdt-sheet-ico">${svg(`mdt-ico-${r.categorie}`)}</span><span class="mdt-sheet-lines"><i></i><i></i><i></i></span></span>`;
  return [
    `<span class="mdt-mock${grand ? ' mdt-mock--grand' : ''}" aria-hidden="true">`,
    `  <svg class="cdp-wash"><use href="#cdp-wash"/></svg>`,
    `  ${contenu}`,
    `</span>`,
  ].join('\n');
}

/** Pastille d'accès (carte et fiche). */
const pastilleAcces = (r) => r.acces === 'public'
  ? `<p class="mdt-access mdt-access--public">${svg('mdt-open')}<span>Accès libre</span></p>`
  : `<p class="mdt-access mdt-access--familles">${svg('mdt-lock')}<span>Réservée aux familles de l’école</span></p>`;

/** Carte de ressource. `base` : chemin du dossier des fiches ; `racine` : racine du site depuis la page. */
function carte(r, { base, racine, titre = 'h3', chip = true }) {
  const c = categories.get(r.categorie);
  const url = `${base}${r.slug}.html`;
  const drapeaux = [
    r.statut === 'a-venir' ? `<span class="mdt-flag">Bientôt disponible</span>` : '',
    estNouvelle(r) ? `<span class="mdt-flag mdt-flag--new">Nouveau</span>` : '',
    r.acces === 'familles' ? `<span class="mdt-lock-badge" title="Réservée aux familles de l’école">${svg('mdt-lock')}<span class="cdp-sr-only">Réservée aux familles de l’école</span></span>` : '',
  ].filter(Boolean).join('');
  return `<article class="mdt-card" data-categorie="${r.categorie}" data-age-min="${r.age_min}" data-age-max="${r.age_max}" data-acces="${r.acces}" data-statut="${r.statut}" data-recherche="${echapper(motsCles(r))}">
  <a class="mdt-card-media" href="${url}" tabindex="-1" aria-hidden="true">
${indenter(visuel(r, racine), '    ')}
    ${drapeaux}
  </a>
  <div class="mdt-card-body">
    ${chip ? `<span class="cdp-chip">${echapper(c.nom)}</span>` : ''}
    <${titre}><a href="${url}">${texte(r.titre)}</a></${titre}>
    <p class="mdt-card-desc">${texte(r.description)}</p>
    <ul class="mdt-card-meta">
      <li>${svg('mdt-age')}${age(r)}</li>
      <li>${svg('mdt-type')}${texte(r.type)}</li>
    </ul>
    ${pastilleAcces(r)}
  </div>
</article>`;
}

/** Compteur d'une catégorie : ressources disponibles dès qu'il y en a, sinon total et accès libre. */
function compteCategorie(liste) {
  const dispo = liste.filter((r) => r.statut === 'disponible').length;
  if (dispo) return `${pluriel(dispo, 'disponible', 'disponibles')} · ${liste.length} au total`;
  const libres = liste.filter((r) => r.acces === 'public').length;
  return `${pluriel(liste.length, 'ressource', 'ressources')}${libres ? ` · ${libres} en accès libre` : ''}`;
}

/** Carte de catégorie (même balisage que le Coin des parents). */
function carteCategorie(c, base) {
  const liste = ressourcesDe(c.slug);
  return `<a class="cdp-cat" data-categorie="${c.slug}" href="${base}${c.slug}/index.html">
  <svg class="cdp-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>
  <span class="cdp-cat-ico">${svg(`mdt-ico-${c.slug}`)}</span>
  <h3>${texte(c.nom)}</h3>
  <p>${texte(c.description)}</p>
  <span class="cdp-cat-foot"><span class="cdp-count">${compteCategorie(liste)}</span><span class="cdp-cat-arrow">${svg('cdp-arrow')}</span></span>
</a>`;
}

const ENCADRE_PARTAGE = `<aside class="mdt-share" aria-labelledby="mdt-share-title">
  <span class="mdt-share-ico">${svg('cdp-heart')}</span>
  <div>
    <h2 id="mdt-share-title">Une activité à partager avec votre enfant</h2>
    <p>Chaque ressource est pensée pour être utilisée avec un adulte. Votre présence, votre attention et vos encouragements font partie de l'activité : prenez le temps de jouer ensemble, sans chercher la performance, et adaptez le rythme à celui de votre enfant.</p>
  </div>
</aside>`;

/* ---------- 1. Accueil de la Médiathèque ---------- */
function genererAccueil() {
  const url = URL_RUBRIQUE;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url + '#page',
        url,
        name: NOM,
        description: 'Des ressources éducatives à imprimer et à partager avec les enfants de 2 à 6 ans : imagiers, jeux, activités créatives et supports du quotidien.',
        inLanguage: 'fr',
        isPartOf: { '@type': 'WebSite', name: 'École Maternelle Lila', url: URL_PRODUCTION },
        publisher: ECOLE,
        breadcrumb: { '@id': url + '#fil-ariane' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: ressources.length,
          itemListElement: ressources.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: urlProdRessource(r), name: r.titre })),
        },
      },
      { '@id': url + '#fil-ariane', ...filAriane([['Accueil', URL_PRODUCTION], [NOM, url]]) },
    ],
  };

  const agesPossibles = [];
  for (let a = Math.min(...ressources.map((r) => r.age_min)); a <= Math.max(...ressources.map((r) => r.age_max)); a++) agesPossibles.push(a);
  /* Filtres en listes déroulantes natives : compactes, accessibles au clavier et adaptées au mobile. */
  const listeDeroulante = (groupe, libelle, options) => `<div class="mdt-select">
  <label class="cdp-sr-only" for="mdt-f-${groupe}">${libelle}</label>
  <select id="mdt-f-${groupe}" data-mdt-filtre="${groupe}">
${options.map(([v, t]) => `    <option value="${v}">${t}</option>`).join('\n')}
  </select>
  <svg class="mdt-select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>`;

  const page = `${tete({
    titre: `${NOM} — Ressources à imprimer pour les 2-6 ans | École Maternelle Lila`,
    description: 'Imagiers, jeux de mémoire, coloriages, routines en images : la Médiathèque éducative de l’École Maternelle Lila propose des ressources à imprimer et à partager avec votre enfant de 2 à 6 ans.',
    canonique: url,
    ld,
    profondeur: 1,
    accueil: true,
  })}
  <main class="cdp-main mdt-main" id="contenu">

    <!-- ==================== 1. HERO ==================== -->
    <section class="cdp-hero mdt-hero" aria-labelledby="mdt-hero-title">
      <div class="cdp-wrap">
        <nav class="cdp-crumbs" aria-label="Fil d'Ariane">
          <ol><li><a href="../index.html">Accueil</a></li><li>Ressources</li><li aria-current="page">${NOM}</li></ol>
        </nav>
        <div class="cdp-hero-grid">
          <div class="cdp-hero-copy">
            <p class="cdp-kicker">Ressources pour les familles</p>
            <h1 id="mdt-hero-title">La Médiathèque <em>éducative<svg viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true"><path d="M4 20 C 50 8, 120 26, 196 13" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" opacity=".5" filter="url(#cdp-brush)"/></svg></em></h1>
            <p class="cdp-signature"><span class="cdp-brand">${echapper(catalogue.signature)}</span></p>
            <p class="cdp-hero-lead">Imagiers, jeux, activités créatives, supports du quotidien : des ressources à imprimer pour prolonger à la maison les découvertes de votre enfant, de 2 à 6 ans.</p>
            <div class="cdp-hero-actions">
              <a class="cdp-btn cdp-btn--green" href="#mdt-catalogue">Explorer les ressources</a>
              <a class="cdp-link-hand" href="#mdt-categories">Voir les catégories ${svg('cdp-arrow')}</a>
            </div>
          </div>
          <div class="cdp-hero-visual">
            <svg class="cdp-wash cdp-wash--a" aria-hidden="true"><use href="#cdp-wash"/></svg>
            <svg class="cdp-wash cdp-wash--b" aria-hidden="true"><use href="#cdp-wash"/></svg>
            <svg class="cdp-heart cdp-heart--1" viewBox="0 0 24 24" aria-hidden="true"><use href="#cdp-heart"/></svg>
            <svg class="cdp-heart cdp-heart--2" viewBox="0 0 24 24" aria-hidden="true"><use href="#cdp-heart"/></svg>
            <figure class="cdp-arch"><img src="../assets/images/coin-des-parents/mediatheque-educative.webp" srcset="../assets/images/coin-des-parents/mediatheque-educative-800.webp 800w, ../assets/images/coin-des-parents/mediatheque-educative.webp 1600w" sizes="(max-width: 820px) min(calc(100vw - 48px), 520px), 560px" width="1600" height="900" alt="${echapper(PARTAGE.alt)}" fetchpriority="high" decoding="async"></figure>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== 2. CATÉGORIES ==================== -->
    <section class="cdp-band cdp-band--cream" id="mdt-categories" aria-labelledby="mdt-categories-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Selon les envies de votre enfant</p>
          <h2 id="mdt-categories-title">Explorez les ressources par catégorie</h2>
        </div>
        <div class="cdp-cats">
${indenter(catalogue.categories.map((c) => carteCategorie(c, '')).join('\n'), '          ')}
        </div>
      </div>
    </section>

    <!-- ==================== 5. CATALOGUE : RECHERCHE ET FILTRES ==================== -->
    <section class="cdp-band" id="mdt-catalogue" aria-labelledby="mdt-catalogue-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Le catalogue de la Médiathèque éducative</p>
          <h2 id="mdt-catalogue-title">Parcourez toutes nos ressources</h2>
        </div>

        <!-- Recherche et filtres : actifs avec JavaScript (js/mediatheque.js) ; sans JavaScript, toutes les ressources restent affichées. -->
        <div class="mdt-tools" id="mdt-tools" hidden>
          <div class="mdt-tools-row">
            <div class="mdt-search">
              <label class="cdp-sr-only" for="mdt-q">Rechercher une ressource</label>
              ${svg('mdt-search', 'mdt-search-ico')}
              <input id="mdt-q" type="search" placeholder="Rechercher : animaux, couleurs…" autocomplete="off" spellcheck="false" enterkeyhint="search">
            </div>
${indenter([
    listeDeroulante('age', 'Âge de l’enfant', [['tous', 'Tous les âges'], ...agesPossibles.map((a) => [String(a), `${a} ans`])]),
    listeDeroulante('categorie', 'Catégorie', [['tous', 'Toutes les catégories'], ...catalogue.categories.map((c) => [c.slug, texte(c.nom)])]),
    listeDeroulante('acces', 'Accès', [['tous', 'Tous les accès'], ['public', 'Accès libre'], ['familles', 'Réservées aux familles']]),
  ].join('\n'), '            ')}
          </div>
          <div class="cdp-results-bar" id="mdt-results-bar" hidden>
            <p id="mdt-results-status" role="status" aria-live="polite"></p>
            <button type="button" class="mdt-reset" id="mdt-reset" hidden>${svg('mdt-close')}Effacer les filtres</button>
          </div>
        </div>

        <!-- Les ${ressources.length} cartes restent dans le HTML ; recherche, filtres et « Afficher plus » (9 par 9) ne font que les masquer. -->
        <div class="mdt-cards" id="mdt-cards">
${indenter(ressources.map((r) => carte(r, { base: 'ressources/', racine: '../' })).join('\n'), '          ')}
        </div>
        <div class="cdp-more-wrap" id="mdt-more-wrap" hidden><button class="cdp-btn cdp-btn--ghost" type="button" id="mdt-more" aria-controls="mdt-cards">Afficher plus de ressources</button></div>
        <div class="cdp-empty mdt-empty" id="mdt-empty" hidden>
          <p>Aucune ressource ne correspond à votre recherche.</p>
          <button type="button" class="cdp-btn cdp-btn--ghost" data-mdt-reset>Voir toutes les ressources</button>
        </div>
      </div>
    </section>

    <!-- ==================== 4. COIN DES PARENTS (même présentation que la Médiathèque dans le Coin des parents) ==================== -->
    <section class="cdp-band cdp-media-band mdt-cross-band" aria-labelledby="mdt-cross-title">
      <svg class="cdp-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>
      <div class="cdp-wrap">
        <div class="cdp-media-grid">
          <div class="cdp-media-copy">
            <p class="cdp-kicker">Aussi dans Ressources</p>
            <h2 id="mdt-cross-title">Le Coin des parents</h2>
            <p>En complément des ressources à imprimer, le Coin des parents propose des articles pour comprendre les grandes étapes du développement de votre enfant et l'accompagner au quotidien, de 15 mois à 6 ans.</p>
            <p class="cdp-media-lead">Parmi les thèmes abordés :</p>
            <ul class="cdp-media-tags">
              <li>Sommeil</li><li>Émotions</li><li>Langage</li><li>Autonomie</li><li>Alimentation</li><li>Première rentrée</li>
            </ul>
            <p class="cdp-media-actions"><a class="cdp-link-hand" href="../coin-des-parents/index.html">Découvrir le Coin des parents ${svg('cdp-arrow')}</a></p>
          </div>
          <div class="cdp-media-visual">
            <svg class="cdp-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>
            <figure><img src="../assets/images/coin-des-parents/coin-des-parents-800.webp" srcset="../assets/images/coin-des-parents/coin-des-parents-800.webp 800w, ../assets/images/coin-des-parents/coin-des-parents.webp 1600w" sizes="(max-width: 820px) min(calc(100vw - 48px), 360px), 480px" width="800" height="450" alt="Une maman et sa fille lisent ensemble un album illustré, toutes deux souriantes" loading="lazy" decoding="async"></figure>
          </div>
        </div>
      </div>
    </section>
  </main>
${pied({ profondeur: 1, accueil: true })}`;
  writeFileSync(join(DOSSIER, 'index.html'), page, 'utf8');
}

/* ---------- 2. Pages catégories ---------- */
function genererCategorie(c) {
  const liste = ressourcesDe(c.slug);

  const url = urlProdCategorie(c);
  const autres = catalogue.categories.filter((x) => x.slug !== c.slug);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url + '#page',
        url,
        name: `${c.nom} — ${NOM}`,
        description: c.intro,
        inLanguage: 'fr',
        isPartOf: { '@type': 'CollectionPage', '@id': URL_RUBRIQUE + '#page', name: NOM, url: URL_RUBRIQUE },
        publisher: ECOLE,
        breadcrumb: { '@id': url + '#fil-ariane' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: liste.length,
          itemListElement: liste.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: urlProdRessource(r), name: r.titre })),
        },
      },
      { '@id': url + '#fil-ariane', ...filAriane([['Accueil', URL_PRODUCTION], [NOM, URL_RUBRIQUE], [c.nom, url]]) },
    ],
  };
  const page = `${tete({
    titre: `${c.nom} — ${NOM} | École Maternelle Lila`,
    description: `${c.description} Des ressources à imprimer de la Médiathèque éducative de l’École Maternelle Lila.`,
    canonique: url,
    ld,
    profondeur: 2,
  })}
  <main class="cdp-main mdt-main mdt-cat-page" id="contenu">

    <!-- ==================== EN-TÊTE DE LA CATÉGORIE ==================== -->
    <section class="cdp-hero cdp-cat-hero" data-categorie="${c.slug}" aria-labelledby="mdt-cat-title">
      <div class="cdp-wrap">
        <nav class="cdp-crumbs" aria-label="Fil d'Ariane">
          <ol><li><a href="../../index.html">Accueil</a></li><li><a href="../index.html">${NOM}</a></li><li aria-current="page">${texte(c.nom)}</li></ol>
        </nav>
        <div class="cdp-hero-grid">
          <div class="cdp-hero-copy">
            <p class="cdp-kicker">Catégorie</p>
            <h1 id="mdt-cat-title">${texte(c.nom)}</h1>
            <p class="cdp-hero-lead">${texte(c.intro)}</p>
            <p class="cdp-cat-total"><span class="cdp-chip">${compteCategorie(liste)}</span></p>
          </div>
          <div class="cdp-cat-visual" aria-hidden="true">
            <svg class="cdp-wash"><use href="#cdp-wash"/></svg>
            <span class="cdp-cat-visual-ico"><svg viewBox="0 0 24 24"><use href="#mdt-ico-${c.slug}"/></svg></span>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== RESSOURCES DE LA CATÉGORIE ==================== -->
    <section class="cdp-band cdp-cat-articles" aria-labelledby="mdt-cat-list-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">La collection</p>
          <h2 id="mdt-cat-list-title">Les ressources de cette catégorie</h2>
        </div>
        ${liste.length ? `<div class="mdt-cards">
${indenter(liste.map((r) => carte(r, { base: '../ressources/', racine: '../../', chip: false })).join('\n'), '          ')}
        </div>` : `<p class="cdp-empty">Aucune ressource n'est encore publiée dans cette catégorie.</p>`}
        <div class="cdp-article-nav">
          <a class="cdp-link-hand" href="../index.html#mdt-catalogue">Voir tout le catalogue ${svg('cdp-arrow')}</a>
        </div>
      </div>
    </section>

    <!-- ==================== AUTRES CATÉGORIES ==================== -->
    <section class="cdp-band cdp-band--cream" aria-labelledby="mdt-autres-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Continuer l'exploration</p>
          <h2 id="mdt-autres-title">Les autres catégories</h2>
        </div>
        <div class="cdp-cats">
${indenter(autres.map((x) => carteCategorie(x, '../')).join('\n'), '          ')}
        </div>
      </div>
    </section>
  </main>
${pied({ profondeur: 2 })}`;
  mkdirSync(join(DOSSIER, c.slug), { recursive: true });
  writeFileSync(join(DOSSIER, c.slug, 'index.html'), page, 'utf8');
}

/* ---------- 3. Fiches ressources ---------- */
function liste(titre, id, items, ordonnee = false) {
  if (!items || !items.length) return '';
  const balise = ordonnee ? 'ol' : 'ul';
  return `<section class="mdt-fiche-section" aria-labelledby="${id}">
  <h2 id="${id}">${titre}</h2>
  <${balise}>
${items.map((x) => `    <li>${texte(x)}</li>`).join('\n')}
  </${balise}>
</section>`;
}

function blocAction(r) {
  if (r.acces === 'public' && r.statut === 'disponible') {
    return `<a class="cdp-btn cdp-btn--green mdt-download" href="../../${r.fichier}" download>${svg('mdt-download')}Télécharger le PDF</a>
<p class="mdt-action-note">Gratuit · PDF${r.pages ? ` · ${pluriel(r.pages, 'page', 'pages')}` : ''} · format A4</p>`;
  }
  if (r.acces === 'public') {
    return `<div class="mdt-action-soon">
  <p class="mdt-action-title"><span class="cdp-pulse" aria-hidden="true"></span>Bientôt disponible</p>
  <p>Ce document est en cours de préparation. Il sera téléchargeable gratuitement sur cette page dès sa publication.</p>
</div>`;
  }
  const espace = catalogue.espace_familles_url && r.statut === 'disponible'
    ? `\n  <a class="cdp-btn cdp-btn--green" href="${echapper(catalogue.espace_familles_url)}">Accéder à l'espace familles</a>` : '';
  return `<div class="mdt-action-lock">
  <p class="mdt-action-title">${svg('mdt-lock')}Réservée aux familles de l’école</p>
  <p>Cette ressource fait partie des contenus réservés aux familles dont l'enfant est inscrit à l'École Maternelle Lila. Les modalités d'accès sont communiquées directement par l'école.</p>${r.statut === 'a-venir' ? `\n  <p class="mdt-action-soon-line"><span class="cdp-pulse" aria-hidden="true"></span>Bientôt disponible</p>` : ''}${espace}
  <a class="mdt-action-link" href="../../index.html#inscriptions">Inscrire mon enfant ${svg('cdp-arrow')}</a>
</div>`;
}

function genererFiche(r) {
  const c = categories.get(r.categorie);
  const url = urlProdRessource(r);
  const voisines = ressourcesDe(r.categorie).filter((x) => x.slug !== r.slug);
  const details = Boolean(r.objectifs || r.materiel || r.conseils || r.contenu);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        '@id': url + '#ressource',
        name: r.titre,
        description: r.description,
        url,
        learningResourceType: r.type,
        typicalAgeRange: `${r.age_min}-${r.age_max}`,
        educationalLevel: 'Préscolaire',
        inLanguage: (r.langues || ['Français']).map((l) => LANGUES[l]),
        isAccessibleForFree: r.acces === 'public',
        audience: { '@type': 'Audience', audienceType: 'Parents' },
        ...(r.objectifs ? { teaches: r.objectifs } : {}),
        ...(r.pages ? { numberOfPages: r.pages } : {}),
        ...(r.acces === 'public' && r.statut === 'disponible' ? { encoding: { '@type': 'MediaObject', contentUrl: URL_PRODUCTION + r.fichier, encodingFormat: 'application/pdf' } } : {}),
        ...(r.publie_le ? { datePublished: r.publie_le } : {}),
        isPartOf: { '@type': 'CollectionPage', '@id': URL_RUBRIQUE + '#page', name: NOM, url: URL_RUBRIQUE },
        publisher: ECOLE,
        breadcrumb: { '@id': url + '#fil-ariane' },
      },
      { '@id': url + '#fil-ariane', ...filAriane([['Accueil', URL_PRODUCTION], [NOM, URL_RUBRIQUE], [c.nom, urlProdCategorie(c)], [r.titre, url]]) },
    ],
  };

  const infos = [
    ['mdt-ico-' + r.categorie, 'Catégorie', `<a href="../${c.slug}/index.html">${texte(c.nom)}</a>`],
    ['mdt-age', 'Âge', age(r)],
    ['mdt-type', 'Type d\'activité', texte(r.type)],
    r.langues ? ['mdt-lang', 'Langues', r.langues.map(echapper).join(', ')] : null,
    r.duree ? ['mdt-clock', 'Durée indicative', texte(r.duree)] : null,
    r.pages ? ['mdt-pages', 'Nombre de pages', String(r.pages)] : null,
    [r.acces === 'public' ? 'mdt-open' : 'mdt-lock', 'Accès', libelleAcces(r)],
    r.publie_le ? ['mdt-clock', 'Mise en ligne', dateFr(r.publie_le)] : null,
  ].filter(Boolean);

  const apercu = r.apercus && r.apercus.length
    ? `<div class="mdt-apercus">${r.apercus.map((img, i) => `<img src="../../${img}" alt="Aperçu de la page ${i + 1} du document « ${echapper(r.titre)} »" loading="lazy" decoding="async">`).join('')}</div>`
    : `<div class="mdt-apercu-vide">
${indenter(visuel(r, '../../', true), '  ')}
  <p>L'aperçu des pages sera visible ici dès la publication du document.</p>
</div>`;

  const page = `${tete({
    titre: `${r.titre} — ${NOM} | École Maternelle Lila`,
    description: `${r.description} Ressource à imprimer pour les ${age(r)}.`,
    canonique: url,
    ld,
    profondeur: 2,
    // Une fiche « bientôt disponible » reste consultable mais hors des moteurs de recherche (contenu encore trop mince).
    robots: r.statut === 'disponible' ? ROBOTS : 'noindex,follow',
  })}
  <main class="cdp-main mdt-main mdt-fiche-page" id="contenu">
    <article class="mdt-fiche" data-categorie="${r.categorie}" aria-labelledby="mdt-fiche-title">
      <!-- ==================== EN-TÊTE DE LA FICHE ==================== -->
      <header class="cdp-article-head mdt-fiche-head">
        <svg class="cdp-wash cdp-article-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>
        <div class="cdp-wrap">
          <nav class="cdp-crumbs" aria-label="Fil d'Ariane">
            <ol><li><a href="../../index.html">Accueil</a></li><li><a href="../index.html">${NOM}</a></li><li><a href="../${c.slug}/index.html">${texte(c.nom)}</a></li><li aria-current="page" class="cdp-crumbs-current">${texte(r.titre)}</li></ol>
          </nav>
          <a class="cdp-chip cdp-chip--link" href="../${c.slug}/index.html">${texte(c.nom)}</a>
          <h1 id="mdt-fiche-title">${texte(r.titre)}</h1>
          <p class="mdt-fiche-lead">${texte(r.description)}</p>
          <ul class="mdt-badges">
            <li>${svg('mdt-age')}${age(r)}</li>
            <li>${svg('mdt-type')}${texte(r.type)}</li>
            <li class="mdt-badge--${r.acces}">${svg(r.acces === 'public' ? 'mdt-open' : 'mdt-lock')}${libelleAcces(r)}</li>
            ${r.statut === 'a-venir' ? `<li class="mdt-badge--soon"><span class="cdp-pulse" aria-hidden="true"></span>Bientôt disponible</li>` : ''}
          </ul>
        </div>
      </header>

      <div class="cdp-wrap mdt-fiche-grid">
        <!-- ==================== CONTENU DE LA FICHE ==================== -->
        <div class="mdt-fiche-main">
          <section class="mdt-fiche-section" aria-labelledby="mdt-apercu-title">
            <h2 id="mdt-apercu-title">Aperçu du document</h2>
${indenter(apercu, '            ')}
          </section>
${indenter(ENCADRE_PARTAGE.replace(/mdt-share-title/g, 'mdt-share-title-fiche'), '          ')}
${[
    liste('Ce que contient le document', 'mdt-contenu-title', r.contenu, true),
    liste('Objectifs pédagogiques', 'mdt-objectifs-title', r.objectifs),
    liste('Matériel nécessaire', 'mdt-materiel-title', r.materiel),
    liste('Conseils pour accompagner l\'enfant', 'mdt-conseils-title', r.conseils),
  ].filter(Boolean).map((b) => indenter(b, '          ')).join('\n')}${r.securite ? `
          <p class="mdt-securite"><strong>Sécurité :</strong> ${texte(r.securite)}</p>` : ''}${details ? '' : `
          <p class="mdt-fiche-later">Les objectifs pédagogiques, le matériel nécessaire et les conseils pour accompagner votre enfant seront présentés ici à la publication de la ressource.</p>`}
        </div>

        <!-- ==================== EN BREF ET TÉLÉCHARGEMENT ==================== -->
        <aside class="mdt-fiche-aside" aria-labelledby="mdt-bref-title">
          <div class="mdt-bref">
            <h2 id="mdt-bref-title">En bref</h2>
            <dl>
${infos.map(([i, t, v]) => `              <div><dt>${svg(i)}${t}</dt><dd>${v}</dd></div>`).join('\n')}
            </dl>
${indenter(blocAction(r), '            ')}
          </div>
        </aside>
      </div>
    </article>
${voisines.length ? `
    <!-- ==================== DANS LA MÊME CATÉGORIE ==================== -->
    <section class="cdp-band cdp-band--cream" aria-labelledby="mdt-voisines-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Dans la même catégorie</p>
          <h2 id="mdt-voisines-title">${texte(c.nom)}</h2>
        </div>
        <div class="mdt-cards mdt-cards--compact">
${indenter(voisines.map((x) => carte(x, { base: '', racine: '../../', chip: false })).join('\n'), '          ')}
        </div>
        <div class="cdp-article-nav">
          <a class="cdp-btn cdp-btn--ghost" href="../${c.slug}/index.html">Toute la catégorie « ${texte(c.nom)} »</a>
          <a class="cdp-link-hand" href="../index.html">Retour à la Médiathèque ${svg('cdp-arrow')}</a>
        </div>
      </div>
    </section>
` : ''}  </main>
${pied({ profondeur: 2 })}`;
  mkdirSync(join(DOSSIER, 'ressources'), { recursive: true });
  writeFileSync(join(DOSSIER, 'ressources', `${r.slug}.html`), page, 'utf8');
}

/* ---------- 4. Sitemaps (hors prévisualisation) ----------
   mediatheque-educative/sitemap.xml : rubrique seule. Le sitemap du site entier (sitemap.xml) l'intègre :
   ce script le met à jour, et _outils/generer-coin-des-parents.mjs le reprend à chaque génération. */
function genererSitemap() {
  const chemin = join(DOSSIER, 'sitemap.xml');
  const cheminSite = join(RACINE, 'sitemap.xml');
  const urls = [URL_RUBRIQUE, ...catalogue.categories.map(urlProdCategorie), ...ressources.filter((r) => r.statut === 'disponible').map(urlProdRessource)];
  let site = existsSync(cheminSite) ? readFileSync(cheminSite, 'utf8') : null;
  if (site) {
    // Retire toute URL de la Médiathèque, puis l'ajoute de nouveau hors prévisualisation.
    site = site.replace(new RegExp(`  <url><loc>${URL_RUBRIQUE.replace(/[.]/g, '\\.')}[^<]*</loc></url>\\n`, 'g'), '');
    if (!PREVISUALISATION) site = site.replace('</urlset>', urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>');
    writeFileSync(cheminSite, site, 'utf8');
  }
  if (PREVISUALISATION) { if (existsSync(chemin)) rmSync(chemin); return false; }
  writeFileSync(chemin, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`, 'utf8');
  return true;
}

/* ---------- Génération ---------- */
// Nettoyage des pages générées obsolètes (ressource renommée ou supprimée).
const dossierFiches = join(DOSSIER, 'ressources');
if (existsSync(dossierFiches)) for (const f of readdirSync(dossierFiches)) {
  if (f.endsWith('.html') && !vus.has(f.slice(0, -5))) rmSync(join(dossierFiches, f));
}
for (const f of existsSync(DOSSIER) ? readdirSync(DOSSIER) : []) {
  const p = join(DOSSIER, f);
  if (statSync(p).isDirectory() && !['ressources', 'fichiers', 'apercus'].includes(f) && !categories.has(f)) rmSync(p, { recursive: true });
}
genererAccueil();
for (const c of catalogue.categories) genererCategorie(c);
for (const r of ressources) genererFiche(r);
const sitemap = genererSitemap();

/* ---------- Bilan ---------- */
const nbLibres = ressources.filter((r) => r.acces === 'public').length;
console.log(`Mode : ${PREVISUALISATION ? 'prévisualisation (noindex, follow ; hors sitemap)' : 'production (index, follow ; sitemap généré)'}`);
console.log(`mediatheque-educative/index.html généré · ${ressources.length} ressources (${nbLibres} en accès libre, ${ressources.length - nbLibres} réservées aux familles)`);
for (const c of catalogue.categories) {
  const l = ressourcesDe(c.slug);
  console.log(`  ${c.nom_court.padEnd(24)} ${String(l.length).padStart(2)} ressource(s) → mediatheque-educative/${c.slug}/index.html`);
}
console.log(`${ressources.length} fiches générées dans mediatheque-educative/ressources/`);
const statuts = ressources.reduce((m, r) => ({ ...m, [r.statut]: (m[r.statut] || 0) + 1 }), {});
console.log(`Statuts : ${Object.entries(statuts).map(([s, n]) => `${n} ${s}`).join(', ')}`);
if (ressources.some((r) => r.a_valider)) console.log(`  ⚠ ${ressources.filter((r) => r.a_valider).length} ressource(s) avec des textes à valider (champ a_valider)`);
if (sitemap) console.log('mediatheque-educative/sitemap.xml généré et sitemap.xml mis à jour');
