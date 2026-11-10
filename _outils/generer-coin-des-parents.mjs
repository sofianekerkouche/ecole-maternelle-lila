#!/usr/bin/env node
/**
 * ==========================================================================
 * ÉCOLE MATERNELLE LILA — GÉNÉRATEUR DU COIN DES PARENTS
 * Usage (depuis la racine du projet) :  node _outils/generer-coin-des-parents.mjs
 *
 * Lit coin-des-parents/manifest.json et les sources Markdown de
 * _editorial/coin-des-parents/, puis écrit des pages HTML statiques :
 *   - coin-des-parents/index.html                 (accueil, modèle _outils/modeles/accueil.html)
 *   - coin-des-parents/<categorie>/index.html     (6 pages catégories)
 *   - coin-des-parents/articles/<slug>.html       (17 pages articles)
 *   - coin-des-parents/sitemap.xml                (uniquement hors prévisualisation)
 * Aucune dépendance : Node.js 18 ou plus suffit. Le site publié reste
 * 100 % HTML statique ; ce script ne s'exécute jamais sur le serveur.
 *
 * En-tête, tiroir mobile, pied de page et définitions SVG
 * sont repris tels quels du modèle de l'accueil (chemins adaptés à la profondeur) :
 * une modification du modèle se répercute sur toutes les pages à la génération suivante.
 * ==========================================================================
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Prévisualisation : pages en « noindex, follow » et pas de sitemap.
   Passer à false uniquement lors de la mise en ligne validée. */
const PREVISUALISATION = true;

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_RUBRIQUE = join(RACINE, 'coin-des-parents');
const DOSSIER_EDITORIAL = join(RACINE, '_editorial', 'coin-des-parents');
const MODELES = join(RACINE, '_outils', 'modeles');
const URL_PRODUCTION = 'https://ecolematernellelila.com/';
const URL_RUBRIQUE = URL_PRODUCTION + 'coin-des-parents/';
const IMAGE_PARTAGE = URL_PRODUCTION + 'assets/images/og-ecole-maternelle-lila.jpg';
const ROBOTS = PREVISUALISATION ? 'noindex,follow' : 'index,follow';
const MOTS_PAR_MINUTE = 200;
const ECOLE = { '@type': 'Organization', name: 'École Maternelle Lila', url: URL_PRODUCTION };
/* Signature des articles (dernier paragraphe de chaque Markdown, en italique). Ce n'est pas une mention d'auteur. */
const SIGNATURE = 'L’équipe de l’École Maternelle Lila, Avec vous, pas à pas.';
/* Règle du site : liens externes en nofollow, sauf Impulzia ; aucun attribut sur les liens internes.
   Les liens générés ici ne s'ouvrent pas dans un nouvel onglet (noopener/noreferrer inutiles). */
const relExterne = (url) => {
  if (!/^https?:\/\//i.test(url) || /^https?:\/\/(www\.)?ecolematernellelila\.com(\/|$)/i.test(url)) return '';
  return /^https?:\/\/(www\.)?impulzia\.fr(\/|$)/i.test(url) ? '' : ' rel="nofollow"';
};

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
const jsonLd = (graphe, indent = '  ') =>
  `<script type="application/ld+json">\n${JSON.stringify(graphe, null, 2).replace(/<\//g, '<\\/')}\n${indent}</script>`;

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

/** Temps de lecture : mots du texte éditorial (sans en-tête, titre H1 ni sources). */
function tempsDeLecture(corps) {
  const sansSources = corps.split(/\n## Sources[^\n]*\n/i)[0];
  const texte = sansSources.replace(/^# .*$/m, '').replace(/[#*_>`\[\]()]/g, ' ').replace(/\b[a-z0-9-]+\.html\b/g, ' ');
  const mots = texte.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { mots, minutes: Math.max(1, Math.round(mots / MOTS_PAR_MINUTE)) };
}

const ancre = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- Lecture et contrôles du manifeste ---------- */
const manifeste = JSON.parse(readFileSync(join(DOSSIER_RUBRIQUE, 'manifest.json'), 'utf8'));
const categories = new Map(manifeste.categories.map((c) => [c.slug, c]));
const articles = new Map(manifeste.articles.map((a) => [a.slug, a]));

for (const c of manifeste.categories) {
  if (!c.slug || !c.name) echec(`Catégorie incomplète : ${JSON.stringify(c)}`);
  for (const champ of ['short_name', 'description', 'intro']) if (!c[champ]) echec(`Catégorie « ${c.name} » : champ ${champ} manquant`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)) echec(`Slug de catégorie non conforme : ${c.slug}`);
}
const slugs = new Set();
for (const a of manifeste.articles) {
  if (slugs.has(a.slug)) echec(`Slug en double : ${a.slug}`);
  slugs.add(a.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) echec(`Slug non conforme (minuscules, chiffres, tirets) : ${a.slug}`);
  if (!categories.has(a.category)) echec(`Catégorie inconnue pour ${a.slug} : ${a.category}`);
  if (!a.title) echec(`Titre manquant : ${a.slug}`);
  if (!a.meta_description) echec(`Meta description manquante : ${a.slug}`);
  const source = join(DOSSIER_EDITORIAL, a.file || '');
  if (!a.file || !existsSync(source)) { echec(`Source Markdown introuvable pour ${a.slug} : ${a.file}`); continue; }
  const { meta, corps } = lireMarkdown(source);
  if (meta.slug && meta.slug !== a.slug) echec(`Slug différent entre manifeste et Markdown : ${a.slug} / ${meta.slug}`);
  if (meta.categorie && meta.categorie !== a.category) echec(`Catégorie différente entre manifeste et Markdown : ${a.slug}`);
  const h1 = corps.match(/^# (.+)$/m);
  if (!h1 || h1[1].trim().replace(/['’]/g, "'") !== a.title.replace(/['’]/g, "'")) echec(`Titre H1 du Markdown différent du manifeste : ${a.slug}`);
  a._corps = corps;
  a._lecture = tempsDeLecture(corps);
}
for (const a of manifeste.articles) {
  for (const r of a.related_articles || []) {
    if (!articles.has(r.slug)) echec(`${a.slug} : article connexe inconnu ${r.slug}`);
    if (r.slug === a.slug) echec(`${a.slug} : un article ne peut pas être son propre article connexe`);
  }
  if ((a.related_articles || []).length < 1) echec(`${a.slug} : aucun article connexe pour « À lire aussi »`);
  // Visuel : nommé exactement d'après le slug, original et variante -800 présents, texte alternatif renseigné.
  if (a.image !== `assets/images/coin-des-parents/${a.slug}.webp`) echec(`${a.slug} : champ "image" absent ou ne correspondant pas au slug (${a.image})`);
  else for (const f of [a.image, a.image.replace(/\.webp$/, '-800.webp')]) if (!existsSync(join(RACINE, f))) echec(`${a.slug} : fichier image manquant ${f}`);
  if (!a.image_alt || !a.image_alt.trim()) echec(`${a.slug} : texte alternatif "image_alt" manquant`);
}
const aLaUne = manifeste.articles.filter((a) => a.featured === true);
if (aLaUne.length !== 1) echec(`Il faut exactement 1 article "featured" (trouvé : ${aLaUne.length})`);
if (typeof manifeste.total_articles === 'number' && manifeste.total_articles !== manifeste.articles.length) {
  echec(`total_articles (${manifeste.total_articles}) ≠ nombre d'articles (${manifeste.articles.length})`);
}
const articlesDe = (slug) => manifeste.articles.filter((a) => a.category === slug);
for (const c of manifeste.categories) {
  const reel = articlesDe(c.slug).length;
  if (typeof c.count === 'number' && c.count !== reel) echec(`Compte saisi pour « ${c.name} » (${c.count}) ≠ compte réel (${reel})`);
}
arreter();

/* ---------- Conversion Markdown → HTML (sous-ensemble utilisé par les articles) ---------- */
// Espaces insécables de la typographie française (fine avant ; ! ?, insécable avant : et dans « »).
const typo = (s) => s
  .replace(/ ([;!?])/g, ' $1')
  .replace(/ :/g, ' :')
  .replace(/« /g, '« ').replace(/ »/g, ' »');

/** Titres : les formes interrogatives à trait d'union (« est-elle », « pleure-t-il ») restent sur une ligne. */
const titreInsecable = (html) => html.replace(/([\p{L}]+(?:-t)?-(?:il|elle|ils|elles|on|je|tu|nous|vous))(?![\p{L}])/gu,
  '<span class="cdp-nowrap">$1</span>');

/** Texte en ligne : liens, gras, italique. `liens` collecte les liens rencontrés (contrôles). */
function enLigne(texte, liens, contexte) {
  const reserve = [];
  let s = texte.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, libelle, cible) => {
    reserve.push({ libelle, cible });
    return `\u0000${reserve.length - 1}\u0000`;
  });
  const formater = (t) => typo(echapper(t))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = formater(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => {
    const { libelle, cible } = reserve[Number(i)];
    liens.push({ libelle, cible, contexte });
    return `<a href="${echapper(cible)}"${relExterne(cible)}>${formater(libelle)}</a>`;
  });
}

/** Corps d'article → { html, sources, liens }. Le H1 est rendu dans l'en-tête de page. */
function convertirArticle(corps) {
  const [texte, blocSources = ''] = corps.split(/\n## Sources et ressources\n/);
  const liens = [];
  const html = [];
  let section = 'Introduction';
  let signatures = 0;
  const blocs = texte.replace(/^# .*\n/m, '').trim().split(/\n{2,}/);
  for (const bloc of blocs) {
    const lignes = bloc.split('\n');
    const titre = bloc.match(/^(#{2,3}) (.+)$/);
    if (titre && lignes.length === 1) {
      const niveau = titre[1].length;
      if (niveau === 2) section = titre[2];
      html.push(`<h${niveau} id="${ancre(titre[2])}">${titreInsecable(enLigne(titre[2], liens, section))}</h${niveau}>`);
    } else if (lignes.every((l) => /^- /.test(l))) {
      html.push('<ul>\n' + lignes.map((l) => `  <li>${enLigne(l.slice(2), liens, section)}</li>`).join('\n') + '\n</ul>');
    } else if (lignes.every((l) => /^\d+\. /.test(l))) {
      html.push('<ol>\n' + lignes.map((l) => `  <li>${enLigne(l.replace(/^\d+\. /, ''), liens, section)}</li>`).join('\n') + '\n</ol>');
    } else if (bloc === `*${SIGNATURE}*`) {
      // Signature institutionnelle sur deux lignes (ce n'est pas une mention d'auteur).
      html.push(`<p class="cdp-article-sign"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#cdp-heart"/></svg><span class="cdp-article-sign-team">L’équipe de l’École Maternelle Lila,</span> <span class="cdp-brand">Avec vous, pas à pas.</span></p>`);
      signatures++;
    } else if (/\b(rédigé|écrit|rédigés|écrits)\s+par\b/i.test(bloc)) {
      throw new Error(`Mention d'auteur à retirer (« rédigé par » / « écrit par ») :\n${bloc}`);
    } else if (/^\*\*[^*]+\*\*$/.test(bloc)) {
      html.push(`<p class="cdp-key">${enLigne(bloc.replace(/^\*\*|\*\*$/g, ''), liens, section)}</p>`);
    } else if (lignes.some((l) => /^(#|- |\d+\. )/.test(l))) {
      throw new Error(`Bloc Markdown mixte non pris en charge :\n${bloc}`);
    } else {
      html.push(`<p>${enLigne(lignes.join(' '), liens, section)}</p>`);
    }
  }
  const sources = blocSources.trim().split('\n').filter(Boolean).map((l) => {
    const m = l.match(/^- (.+?) : (https?:\/\/\S+)$/);
    if (!m) throw new Error(`Ligne de source non conforme (attendu « - Libellé : URL ») : ${l}`);
    return { libelle: m[1], url: m[2] };
  });
  if (signatures !== 1) throw new Error(`Signature attendue une fois (« ${SIGNATURE} »), trouvée ${signatures} fois`);
  return { html: html.join('\n'), sources, liens };
}

/* ---------- Composants partagés, repris du modèle de l'accueil ---------- */
let modeleAccueil = readFileSync(join(MODELES, 'accueil.html'), 'utf8').replace(/\r\n/g, '\n');
const extraire = (motif, nom) => {
  const m = modeleAccueil.match(motif);
  if (!m) { console.error(`Génération interrompue : composant « ${nom} » introuvable dans le modèle de l'accueil.`); process.exit(1); }
  return m[0];
};
const COMPOSANTS = {
  defs: extraire(/  <!-- Définitions SVG[\s\S]*?<\/svg>\n/, 'définitions SVG'),
  entete: extraire(/  <!-- =+\n\s+EN-TÊTE[\s\S]*?<\/aside>\n/, 'en-tête et tiroir mobile'),
  pied: extraire(/  <!-- =+\n\s+PIED DE PAGE[\s\S]*?<\/html>\n?/, 'pied de page'),
};
/* Rubrique « Ressources » (Coin des parents, et à l'avenir Médiathèque éducative) : pas de bouton d'appel flottant.
   Le modèle n'en contient pas ; ce contrôle empêche qu'il soit réintroduit par erreur. */
if (/floating-call/.test(modeleAccueil)) {
  console.error('Génération interrompue : le bouton d’appel flottant (floating-call) ne doit pas figurer dans les pages de la rubrique Ressources.');
  process.exit(1);
}

/** Adapte un composant de l'accueil (profondeur 1) à une page de profondeur 2. */
function profondeur2(html) {
  return html
    .replace(/(href|src)="\.\.\//g, '$1="../../')
    .replace(/href="index\.html"/g, 'href="../index.html"')
    .replace(/ aria-current="page"/g, '')
    .replace(/<span class="nav-ressources-here">Vous êtes ici<\/span>/g, '')
    .replace(/ <\/a><\/li>/g, '</a></li>');
}

function tete({ titre, description, canonique, typeOg, ld }) {
  return `<!DOCTYPE html>
<!-- Fichier généré par _outils/generer-coin-des-parents.mjs à partir de manifest.json et des sources éditoriales. Ne pas modifier directement. -->
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="${ROBOTS}">
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
  <meta property="og:image" content="${IMAGE_PARTAGE}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="675">
  <meta property="og:image:alt" content="École Maternelle Lila : enfants, établissement et identité visuelle de l’école">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${IMAGE_PARTAGE}">

  <link rel="icon" type="image/svg+xml" href="../../assets/images/Logo-principal-Ecole-Maternelle-Lila.svg">

  <!-- Fraunces (titres de la rubrique) ; Nunito et Pacifico sont déjà chargées par style.css -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400&display=swap">

  <link rel="stylesheet" href="../../css/style.css">
  <link rel="stylesheet" href="../../css/menu-ressources.css">
  <link rel="stylesheet" href="../../css/coin-des-parents.css">

  ${jsonLd(ld)}
</head>
<body class="cdp">

${COMPOSANTS.defs}
${profondeur2(COMPOSANTS.entete)}`;
}

const pied = () => '\n' + profondeur2(COMPOSANTS.pied);

/* ---------- Fragments ---------- */
const extrait = (a) => a.excerpt || a.meta_description;       // champ "excerpt" prioritaire s'il existe
/* Visuels des articles (manifeste : champs "image" et "image_alt", fichier nommé d'après le slug).
   Deux tailles 16:9 : l'original 1600 × 900 et une variante 800 × 450 (suffixe -800) pour les cartes.
   `racine` : chemin de la racine du site depuis la page courante ('../' ou '../../').
   `chargement` : 'lazy' sous la ligne de flottaison, 'prioritaire' pour l'image principale d'une page. */
const variante800 = (src) => src.replace(/\.webp$/, '-800.webp');
function imageArticle(a, racine, { sizes, chargement = 'lazy', petite = true }) {
  const src = racine + a.image;
  const attributs = chargement === 'prioritaire' ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
  return `<img src="${petite ? variante800(src) : src}" srcset="${variante800(src)} 800w, ${src} 1600w" sizes="${sizes}" width="${petite ? 800 : 1600}" height="${petite ? 450 : 900}" alt="${echapper(a.image_alt)}" ${attributs}>`;
}
const TAILLES_CARTE = '(max-width: 600px) 128px, (max-width: 1024px) 50vw, 380px';
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const urlProdArticle = (a) => `${URL_RUBRIQUE}articles/${a.slug}.html`;
const urlProdCategorie = (c) => `${URL_RUBRIQUE}${c.slug}/`;

/** Carte d'article. `base` : chemin du dossier des articles depuis la page courante ;
    `racine` : chemin de la racine du site depuis la page courante. */
function carteArticle(a, indent, base = 'articles/', titreNiveau = 'h3', racine = '../') {
  const c = categories.get(a.category);
  const url = `${base}${a.slug}.html`;
  return [
    `<article class="cdp-post" data-cdp-slug="${a.slug}" data-categorie="${a.category}">`,
    `  <a class="cdp-post-media" href="${url}" tabindex="-1" aria-hidden="true">${imageArticle(a, racine, { sizes: TAILLES_CARTE })}</a>`,
    `  <span class="cdp-chip">${echapper(c.name)}</span>`,
    `  <${titreNiveau}><a href="${url}">${titreInsecable(echapper(a.title))}</a></${titreNiveau}>`,
    `  <p class="cdp-excerpt">${echapper(extrait(a))}</p>`,
    `</article>`,
  ].map((l) => indent + l).join('\n');
}

/** Carte thématique (même balisage que l'accueil). `base` : chemin vers le dossier de la rubrique. */
function carteCategorie(c, indent, base) {
  const n = articlesDe(c.slug).length;
  return [
    `<a class="cdp-cat" data-categorie="${c.slug}" href="${base}${c.slug}/index.html">`,
    `  <svg class="cdp-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>`,
    `  <span class="cdp-cat-ico"><svg aria-hidden="true"><use href="#cdp-ico-${c.slug}"/></svg></span>`,
    `  <h3>${echapper(c.name)}</h3>`,
    `  <p>${echapper(c.description)}</p>`,
    `  <span class="cdp-cat-foot"><span class="cdp-count" data-cdp-compteur="${c.slug}">${n === 0 ? 'Bientôt' : pluriel(n, 'article', 'articles')}</span><span class="cdp-cat-arrow"><svg aria-hidden="true"><use href="#cdp-arrow"/></svg></span></span>`,
    `</a>`,
  ].map((l) => indent + l).join('\n');
}

/** Carte « À la une » : volontairement compacte (thématique, titre, extrait, temps de lecture, lien),
    sans liste de questions ni de sous-parties de l'article, quel que soit l'article mis à la une. */
function blocALaUne(a, indent) {
  const c = categories.get(a.category);
  const url = `articles/${a.slug}.html`;
  return [
    `<article class="cdp-featured" data-cdp-slug="${a.slug}" data-categorie="${a.category}">`,
    `  <a class="cdp-featured-media" href="${url}" tabindex="-1" aria-hidden="true">`,
    `    ${imageArticle(a, '../', { sizes: '(max-width: 820px) 100vw, 600px' })}`,
    `    <span class="cdp-featured-tag cdp-brand">À la une</span>`,
    `  </a>`,
    `  <div class="cdp-featured-body">`,
    `    <span class="cdp-chip">${echapper(c.name)}</span>`,
    `    <h3><a href="${url}">${titreInsecable(echapper(a.title))}</a></h3>`,
    `    <p>${echapper(extrait(a))}</p>`,
    `    <div class="cdp-meta"><span>${a._lecture.minutes} min de lecture</span></div>`,
    `    <a class="cdp-link-hand" href="${url}">Lire l'article<span class="cdp-sr-only"> : ${echapper(a.title)}</span> <svg aria-hidden="true"><use href="#cdp-arrow"/></svg></a>`,
    `  </div>`,
    `</article>`,
  ].map((l) => indent + l).join('\n');
}

/** Ordre de « Tous les articles » (accueil de la rubrique uniquement) : thématiques alternées et articles mélangés
    à l'intérieur de chaque thématique. Tirage pseudo-aléatoire à graine fixe : l'ordre est figé dans le HTML généré,
    identique à chaque visite et à chaque génération tant que le manifeste ne change pas. Les autres classements
    (pages thématiques, « À lire aussi », données structurées) suivent toujours l'ordre du manifeste. */
const GRAINE_COLLECTION = 'coin-des-parents';
function ordreCollection(liste) {
  let h = 2166136261;
  for (const ch of GRAINE_COLLECTION) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const alea = () => { h = (h + 0x6D2B79F5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const melanger = (t) => { const r = [...t]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(alea() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const piles = new Map(manifeste.categories.map((c) => [c.slug, melanger(liste.filter((a) => a.category === c.slug))]));
  const resultat = [];
  // Tours successifs : chaque tour prend un article de chaque thématique restante, dans un ordre tiré au sort ;
  // le premier article d'un tour n'est jamais de la même thématique que le dernier du tour précédent.
  while ([...piles.values()].some((p) => p.length)) {
    const tour = melanger([...piles.keys()].filter((s) => piles.get(s).length));
    const precedente = resultat.at(-1)?.category;
    if (tour.length > 1 && tour[0] === precedente) tour.push(tour.shift());
    for (const s of tour) resultat.push(piles.get(s).shift());
  }
  if (resultat.length !== liste.length) echec('ordre de la collection : articles perdus');
  return resultat;
}

const filAriane = (elements) => ({
  '@type': 'BreadcrumbList',
  itemListElement: elements.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(item ? { item } : {}) })),
});

/* ---------- 1. Page d'accueil de la rubrique ---------- */
function genererAccueil() {
  let page = modeleAccueil;

  // Les cartes thématiques du modèle doivent correspondre exactement aux catégories du manifeste.
  const norm = (s) => s.replace(/&#39;|’/g, "'");
  const cartesModele = [...page.matchAll(/<a class="cdp-cat" data-categorie="([^"]+)"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>\s*<p>([^<]+)<\/p>/g)]
    .map((m) => ({ slug: m[1], nom: norm(m[2]), description: norm(m[3]) }));
  const attendues = manifeste.categories.map((c) => ({ slug: c.slug, nom: norm(c.name), description: norm(c.description) }));
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

  const url = URL_RUBRIQUE;
  remplacer('cdp:jsonld', (i) => i + jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url + '#page',
        url,
        name: 'Le Coin des parents',
        description: 'Des conseils simples et bienveillants pour accompagner les enfants de 15 mois à 6 ans et leurs parents.',
        inLanguage: 'fr',
        isPartOf: { '@type': 'WebSite', name: 'École Maternelle Lila', url: URL_PRODUCTION },
        publisher: ECOLE,
        breadcrumb: { '@id': url + '#fil-ariane' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: manifeste.articles.length,
          itemListElement: manifeste.articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: urlProdArticle(a), name: a.title })),
        },
      },
      { '@id': url + '#fil-ariane', ...filAriane([['Accueil', URL_PRODUCTION], ['Le Coin des parents', url]]) },
    ],
  }));
  remplacer('cdp:a-la-une', (i) => blocALaUne(aLaUne[0], i));
  remplacer('cdp:articles', () => ordreCollection(manifeste.articles).map((a) => carteArticle(a, '          ')).join('\n'));

  page = page.replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${ROBOTS}">`);
  const entete = '<!-- Fichier généré par _outils/generer-coin-des-parents.mjs à partir de _outils/modeles/accueil.html et de manifest.json. Ne pas modifier directement. -->\n';
  page = page.replace(/^<!DOCTYPE html>\n/, (d) => d + entete);
  writeFileSync(join(DOSSIER_RUBRIQUE, 'index.html'), page, 'utf8');
}

/* ---------- 2. Pages articles ---------- */
const tousLesLiens = new Map(); // slug → liens contextuels (contrôles)

function genererArticle(a) {
  const c = categories.get(a.category);
  const { html, sources, liens } = convertirArticle(a._corps);
  tousLesLiens.set(a.slug, liens);
  const url = urlProdArticle(a);

  // Contrôle des liens internes : articles existants, ou fichiers existants du site.
  for (const l of liens) {
    if (/^https?:\/\//.test(l.cible)) continue;
    const art = l.cible.match(/^([a-z0-9-]+)\.html$/);
    if (art) { if (!articles.has(art[1])) echec(`${a.slug} : lien vers un article inexistant (${l.cible})`); continue; }
    const fichier = join(DOSSIER_RUBRIQUE, 'articles', l.cible.split('#')[0]);
    if (!existsSync(fichier)) echec(`${a.slug} : lien interne cassé (${l.cible})`);
  }
  if (!sources.length) echec(`${a.slug} : aucune source`);

  const connexes = (a.related_articles || []).map((r) => articles.get(r.slug)).filter(Boolean);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': url + '#article',
        headline: a.title,
        description: a.meta_description,
        inLanguage: 'fr',
        url,
        mainEntityOfPage: url,
        image: IMAGE_PARTAGE,
        articleSection: c.name,
        keywords: a.keyword,
        wordCount: a._lecture.mots,
        timeRequired: `PT${a._lecture.minutes}M`,
        publisher: ECOLE, // éditeur du site ; aucune mention d'auteur (choix éditorial)
        isPartOf: { '@type': 'CollectionPage', '@id': URL_RUBRIQUE + '#page', name: 'Le Coin des parents', url: URL_RUBRIQUE },
        citation: sources.map((s) => ({ '@type': 'CreativeWork', name: s.libelle, url: s.url })),
        breadcrumb: { '@id': url + '#fil-ariane' },
      },
      { '@id': url + '#fil-ariane', ...filAriane([
        ['Accueil', URL_PRODUCTION], ['Le Coin des parents', URL_RUBRIQUE], [c.name, urlProdCategorie(c)], [a.title, url],
      ]) },
    ],
  };

  const page = `${tete({
    titre: `${a.title} | École Maternelle Lila`,
    description: a.meta_description,
    canonique: url,
    typeOg: 'article',
    ld,
  })}
  <main class="cdp-main cdp-article-page" id="contenu" data-cdp-manifeste="../manifest.json" data-cdp-rubrique="../">

    <article class="cdp-article" data-categorie="${a.category}" aria-labelledby="cdp-article-title">
      <!-- ==================== EN-TÊTE DE L'ARTICLE ==================== -->
      <header class="cdp-article-head">
        <svg class="cdp-wash cdp-article-wash" aria-hidden="true"><use href="#cdp-wash"/></svg>
        <div class="cdp-wrap">
          <div class="cdp-article-col">
            <nav class="cdp-crumbs" aria-label="Fil d'Ariane">
              <ol><li><a href="../../index.html">Accueil</a></li><li><a href="../index.html">Le Coin des parents</a></li><li><a href="../${c.slug}/index.html">${echapper(c.name)}</a></li><li aria-current="page" class="cdp-crumbs-current">${echapper(a.title)}</li></ol>
            </nav>
            <a class="cdp-chip cdp-chip--link" href="../${c.slug}/index.html">${echapper(c.name)}</a>
            <h1 id="cdp-article-title">${titreInsecable(typo(echapper(a.title)))}</h1>
            <div class="cdp-meta"><span>${a._lecture.minutes} min de lecture</span></div>
          </div>
        </div>
      </header>

      <!-- ==================== TEXTE ==================== -->
      <div class="cdp-wrap cdp-article-body">
        <!-- Image principale : chargée en priorité (au-dessus de la ligne de flottaison sur ordinateur) -->
        <figure class="cdp-article-col cdp-article-figure">
          ${imageArticle(a, '../../', { sizes: '(max-width: 820px) calc(100vw - 48px), 760px', chargement: 'prioritaire', petite: false })}
        </figure>
        <div class="cdp-article-col cdp-prose">
${html.split('\n').map((l) => '          ' + l).join('\n')}
        </div>

        <!-- Accordéon natif : fermé par défaut, utilisable au clavier et sans JavaScript -->
        <details class="cdp-article-col cdp-sources">
          <summary><h2 id="cdp-sources-title">Sources et ressources</h2><svg class="cdp-sources-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
          <ul>
${sources.map((s) => `            <li><a href="${echapper(s.url)}"${relExterne(s.url)}>${typo(echapper(s.libelle))}</a></li>`).join('\n')}
          </ul>
        </details>
      </div>
    </article>

    <!-- ==================== À LIRE AUSSI ==================== -->
    <section class="cdp-band cdp-band--cream cdp-related" aria-labelledby="cdp-related-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Pour aller plus loin</p>
          <h2 id="cdp-related-title">À lire aussi</h2>
        </div>
        <div class="cdp-posts">
${connexes.map((r) => carteArticle(r, '          ', '', 'h3', '../../')).join('\n')}
        </div>
        <div class="cdp-article-nav">
          <a class="cdp-btn cdp-btn--ghost" href="../${c.slug}/index.html">Tous les articles « ${echapper(c.name)} »</a>
          <a class="cdp-link-hand" href="../index.html">Retour au Coin des parents <svg aria-hidden="true"><use href="#cdp-arrow"/></svg></a>
        </div>
      </div>
    </section>
  </main>
${pied()}`;

  mkdirSync(join(DOSSIER_RUBRIQUE, 'articles'), { recursive: true });
  writeFileSync(join(DOSSIER_RUBRIQUE, 'articles', `${a.slug}.html`), page, 'utf8');
}

/* ---------- 3. Pages catégories ---------- */
function genererCategorie(c) {
  const liste = articlesDe(c.slug);
  const url = urlProdCategorie(c);
  const autres = manifeste.categories.filter((x) => x.slug !== c.slug);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url + '#page',
        url,
        name: `${c.name} — Le Coin des parents`,
        description: c.intro,
        inLanguage: 'fr',
        isPartOf: { '@type': 'CollectionPage', '@id': URL_RUBRIQUE + '#page', name: 'Le Coin des parents', url: URL_RUBRIQUE },
        publisher: ECOLE,
        breadcrumb: { '@id': url + '#fil-ariane' },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: liste.length,
          itemListElement: liste.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: urlProdArticle(a), name: a.title })),
        },
      },
      { '@id': url + '#fil-ariane', ...filAriane([['Accueil', URL_PRODUCTION], ['Le Coin des parents', URL_RUBRIQUE], [c.name, url]]) },
    ],
  };
  const description = `${c.description} Les articles du Coin des parents de l’École Maternelle Lila.`;
  const page = `${tete({
    titre: `${c.name} — Le Coin des parents | École Maternelle Lila`,
    description,
    canonique: url,
    typeOg: 'website',
    ld,
  })}
  <main class="cdp-main cdp-cat-page" id="contenu" data-cdp-manifeste="../manifest.json" data-cdp-rubrique="../">

    <!-- ==================== EN-TÊTE DE LA THÉMATIQUE ==================== -->
    <section class="cdp-hero cdp-cat-hero" data-categorie="${c.slug}" aria-labelledby="cdp-cat-title">
      <div class="cdp-wrap">
        <nav class="cdp-crumbs" aria-label="Fil d'Ariane">
          <ol><li><a href="../../index.html">Accueil</a></li><li><a href="../index.html">Le Coin des parents</a></li><li aria-current="page">${echapper(c.name)}</li></ol>
        </nav>
        <div class="cdp-hero-grid">
          <div class="cdp-hero-copy">
            <p class="cdp-kicker">Thématique</p>
            <h1 id="cdp-cat-title">${echapper(c.name)}</h1>
            <p class="cdp-hero-lead">${typo(echapper(c.intro))}</p>
            <p class="cdp-cat-total"><span class="cdp-chip"><span class="cdp-count" data-cdp-compteur="${c.slug}">${liste.length === 0 ? 'Bientôt' : pluriel(liste.length, 'article', 'articles')}</span></span></p>
          </div>
          <div class="cdp-cat-visual" aria-hidden="true">
            <svg class="cdp-wash"><use href="#cdp-wash"/></svg>
            <span class="cdp-cat-visual-ico"><svg viewBox="0 0 24 24"><use href="#cdp-ico-${c.slug}"/></svg></span>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== ARTICLES DE LA THÉMATIQUE ==================== -->
    <section class="cdp-band cdp-cat-articles" aria-labelledby="cdp-cat-articles-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">La collection</p>
          <h2 id="cdp-cat-articles-title">Les articles de cette thématique</h2>
        </div>
        ${liste.length ? `<div class="cdp-posts">
${liste.map((a) => carteArticle(a, '          ', '../articles/', 'h3', '../../')).join('\n')}
        </div>` : `<p class="cdp-empty">Aucun article n'est encore publié dans cette thématique. Les prochains arriveront bientôt.</p>`}
        <div class="cdp-article-nav">
          <a class="cdp-link-hand" href="../index.html#cdp-articles">Voir tous les articles du Coin des parents <svg aria-hidden="true"><use href="#cdp-arrow"/></svg></a>
        </div>
      </div>
    </section>

    <!-- ==================== AUTRES THÉMATIQUES ==================== -->
    <section class="cdp-band cdp-band--cream" aria-labelledby="cdp-autres-title">
      <div class="cdp-wrap">
        <div class="cdp-section-head">
          <p class="cdp-kicker">Continuer la lecture</p>
          <h2 id="cdp-autres-title">Les autres thématiques</h2>
        </div>
        <div class="cdp-cats">
${autres.map((x) => carteCategorie(x, '          ', '../')).join('\n')}
        </div>
      </div>
    </section>
  </main>
${pied()}`;

  mkdirSync(join(DOSSIER_RUBRIQUE, c.slug), { recursive: true });
  writeFileSync(join(DOSSIER_RUBRIQUE, c.slug, 'index.html'), page, 'utf8');
}

/* ---------- 4. Sitemap de la rubrique (hors prévisualisation) ---------- */
function genererSitemap() {
  const chemin = join(DOSSIER_RUBRIQUE, 'sitemap.xml');
  if (PREVISUALISATION) { if (existsSync(chemin)) rmSync(chemin); return false; }
  const urls = [URL_RUBRIQUE, ...manifeste.categories.map(urlProdCategorie), ...manifeste.articles.map(urlProdArticle)];
  writeFileSync(chemin, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`, 'utf8');
  return true;
}

/* ---------- Génération ---------- */
genererAccueil();
for (const a of manifeste.articles) genererArticle(a);
for (const c of manifeste.categories) genererCategorie(c);
arreter();
const sitemap = genererSitemap();

/* ---------- Contrôles du maillage ---------- */
const entrants = new Map(manifeste.articles.map((a) => [a.slug, new Set()]));
for (const [source, liens] of tousLesLiens) {
  for (const l of liens) { const m = l.cible.match(/^([a-z0-9-]+)\.html$/); if (m) entrants.get(m[1]).add(source); }
}
const avertissements = [];
for (const [slug, src] of entrants) if (src.size < 2) avertissements.push(`${slug} : ${src.size} lien(s) contextuel(s) entrant(s)`);

/* ---------- Bilan ---------- */
console.log(`Mode : ${PREVISUALISATION ? 'prévisualisation (noindex, follow ; pas de sitemap)' : 'production (index, follow ; sitemap généré)'}`);
console.log('coin-des-parents/index.html généré');
console.log(`  ${manifeste.articles.length} articles · à la une : ${aLaUne[0].slug} (${aLaUne[0]._lecture.minutes} min, ${aLaUne[0]._lecture.mots} mots)`);
console.log(`${manifeste.articles.length} pages articles générées dans coin-des-parents/articles/`);
for (const c of manifeste.categories) {
  console.log(`  ${c.short_name.padEnd(24)} ${String(articlesDe(c.slug).length).padStart(2)} article(s) → coin-des-parents/${c.slug}/index.html`);
}
const nbLiens = [...tousLesLiens.values()].reduce((n, l) => n + l.filter((x) => !/^https?:/.test(x.cible)).length, 0);
console.log(`Maillage : ${nbLiens} liens internes dans les textes ; liens entrants par article : min ${Math.min(...[...entrants.values()].map((s) => s.size))}, max ${Math.max(...[...entrants.values()].map((s) => s.size))}`);
avertissements.forEach((w) => console.warn('  ⚠ ' + w));
if (sitemap) console.log('coin-des-parents/sitemap.xml généré');
