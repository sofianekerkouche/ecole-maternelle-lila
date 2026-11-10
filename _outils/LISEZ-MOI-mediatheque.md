# Médiathèque éducative — mode d'emploi

Les pages de la Médiathèque (`mediatheque-educative/`) sont générées à partir d'un seul fichier :
`mediatheque-educative/catalogue.json`. Ne modifiez jamais les pages HTML à la main : elles seraient écrasées.

## Publier une ressource terminée

Une seule commande, depuis la racine du projet :

```
node _outils/publier-ressource.mjs <slug> <fichier.pdf> <dossier-des-apercus>
```

Exemple pour l'imagier :

```
node _outils/publier-ressource.mjs les-animaux-en-francais-et-en-arabe ../_mediatheque/01-animaux-francais-arabe/version-finale/les-animaux-en-francais-et-en-arabe.pdf ../_mediatheque/01-animaux-francais-arabe/version-finale/apercus
```

- `<slug>` : identifiant de la ressource dans le catalogue (champ `slug`, c'est aussi le nom de sa fiche).
- Le dossier des aperçus contient une image par page, numérotée : `page-1.png`, `page-2.png`…

La commande :

1. copie le PDF dans `mediatheque-educative/fichiers/` ;
2. convertit les aperçus en images légères (WebP, 800 px de large, environ 40 Ko) dans `mediatheque-educative/apercus/` ;
3. passe la ressource en « disponible » dans le catalogue, avec la date du jour ;
4. régénère toutes les pages de la Médiathèque.

Effets sur le site : la ressource passe en tête du catalogue et de sa catégorie avec une pastille « Nouveau »
(pendant 45 jours), sa fiche affiche les aperçus et le bouton « Télécharger le PDF », et elle devient visible
par les moteurs de recherche.

Rien n'est mis en ligne par cette commande : vérifiez la fiche dans le navigateur, puis commitez et poussez
après validation.

**Ressources réservées aux familles : la commande refuse de les publier.** Leurs PDF ne doivent jamais entrer
dans ce dépôt public (n'importe qui pourrait les télécharger). Elles attendront l'espace familles protégé
(Cloudflare, phase ultérieure).

## Modifier un texte

Modifiez le champ voulu dans `catalogue.json` (description, objectifs, matériel, conseils…), puis :

```
node _outils/generer-mediatheque.mjs
```

Le générateur vérifie le catalogue et s'arrête avec un message clair en cas d'erreur.

## Mise en ligne de la rubrique

1. Dans `_outils/generer-mediatheque.mjs`, passer `PREVISUALISATION` à `false`.
2. Lancer `node _outils/generer-mediatheque.mjs`, puis `node _outils/generer-coin-des-parents.mjs`
   (le sitemap du site reprend les pages de la Médiathèque).
3. Seules les pages utiles sont proposées aux moteurs de recherche : l'accueil, les catégories et les fiches
   des ressources disponibles. Les fiches « bientôt disponibles » restent consultables mais non indexées.
4. Fusionner la branche dans `main` et pousser, après validation.
