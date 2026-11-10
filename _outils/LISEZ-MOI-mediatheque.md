# Médiathèque éducative — mode d'emploi

Les pages de la Médiathèque (`mediatheque-educative/`) sont générées à partir d'un seul fichier :
`mediatheque-educative/catalogue.json`. Ne modifiez jamais les pages HTML à la main : elles seraient écrasées.

## Publier une ressource terminée (elle s'ajoute au site)

Une fois le document validé, depuis la racine du projet, sur la branche `main` :

1. Mettre à jour la fiche dans `mediatheque-educative/catalogue.json` pour qu'elle décrive exactement le document final
   (`description`, `type`, `contenu`, `objectifs`, `materiel`, `conseils`, et si utile `duree`, `securite`),
   puis supprimer le champ `a_valider`. Tant qu'il est présent, la publication est refusée.
2. Lancer :

```
node _outils/publier-ressource.mjs <slug> --en-ligne
```

- `<slug>` : identifiant de la ressource dans le catalogue (champ `slug`, c'est aussi le nom de sa fiche).
- Le PDF et les aperçus sont retrouvés automatiquement dans `_mediatheque/NN-<slug>/version-finale/`
  (`<slug>.pdf` et `apercus/page-1.png`, `page-2.png`…). Sinon, les indiquer :
  `node _outils/publier-ressource.mjs <slug> <fichier.pdf> <dossier-des-apercus>`.

La commande :

1. copie le PDF dans `mediatheque-educative/fichiers/` ;
2. convertit les aperçus en images légères (WebP, 800 px de large, environ 40 Ko) dans `mediatheque-educative/apercus/` ;
3. passe la ressource en « disponible » dans le catalogue, avec la date du jour ;
4. régénère toutes les pages de la Médiathèque et le sitemap ;
5. avec `--en-ligne` : commite uniquement les fichiers de la Médiathèque et le sitemap, puis pousse sur `main`.
   La ressource apparaît sur le site quelques minutes plus tard (délai de GitHub Pages).

Sans `--en-ligne`, rien n'est mis en ligne : pratique pour vérifier la fiche dans le navigateur avant.

Effets sur le site : la ressource passe en tête du catalogue et de sa catégorie avec une pastille « Nouveau »
(pendant 45 jours), sa fiche affiche les aperçus et le bouton « Télécharger le PDF », et elle devient visible
par les moteurs de recherche.

**Ressources réservées aux familles : la commande refuse de les publier.** Leurs PDF ne doivent jamais entrer
dans ce dépôt public (n'importe qui pourrait les télécharger). Elles attendront l'espace familles protégé
(Cloudflare, phase ultérieure).

## Modifier un texte

Modifiez le champ voulu dans `catalogue.json`, puis :

```
node _outils/generer-mediatheque.mjs
```

Le générateur vérifie le catalogue et s'arrête avec un message clair en cas d'erreur.

## Mode de la rubrique

La rubrique est en ligne (`PREVISUALISATION = false` dans `_outils/generer-mediatheque.mjs`). Seules les pages utiles
sont proposées aux moteurs de recherche : l'accueil, les catégories et les fiches des ressources disponibles.
Les fiches « bientôt disponibles » restent consultables mais non indexées. Le sitemap du site (`sitemap.xml`)
reprend ces pages, y compris quand le Coin des parents est régénéré.
