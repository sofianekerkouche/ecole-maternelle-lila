# Brief d'intégration pour Claude — Le Coin des parents

## Mission
Intégrer les 17 contenus Markdown de ce dossier au projet statique du site École Maternelle Lila, sans réécrire leur contenu sans validation humaine.

## Avant toute modification
1. Inspecter la structure réelle du projet et identifier le système de navigation, les styles et les composants existants.
2. Repérer les pages et ressources déjà créées pour le Coin des parents.
3. Vérifier le fonctionnement du site en prévisualisation GitHub Pages sous un chemin de projet, ainsi que sur le domaine final.
4. Présenter un bref plan d'intégration avant les modifications structurelles importantes.

## Structure cible indicative
Ne pas imposer cette structure si le projet possède déjà une architecture équivalente :
- `/coin-des-parents/index.html`
- `/coin-des-parents/<categorie>/index.html`
- `/coin-des-parents/articles/<slug>.html`
- `css/coin-des-parents.css`
- `js/coin-des-parents.js` (uniquement si nécessaire)

Les 17 pages article doivent être du HTML statique rendu côté serveur / présent dans les fichiers HTML, et non générées uniquement par JavaScript. Le contenu doit rester indexable sans JavaScript.

## Source de vérité
`manifest.json` est le catalogue central des 17 articles. Il contient également les liens contextuels recommandés entre articles dans `related_articles`. Utiliser ce fichier pour alimenter les cartes, les catégories, les filtres et les compteurs. Éviter de maintenir manuellement plusieurs compteurs ou catalogues divergents.

Les articles eux-mêmes doivent être intégrés dans des pages HTML statiques à partir des fichiers Markdown. Si aucun convertisseur Markdown n'existe dans le projet, ne pas ajouter une dépendance lourde sans accord : produire du HTML statique propre.

## Exigences fonctionnelles
- Afficher les 6 catégories et leurs articles.
- Afficher un filtre « Tout afficher » et un filtre par catégorie.
- Mettre à jour le nombre de résultats après filtrage à partir du catalogue.
- Prévoir un état vide compréhensible.
- Les filtres doivent être utilisables au clavier et annoncer correctement leur état aux technologies d'assistance.
- Les cartes doivent pointer vers des URLs réelles et stables.
- Prévoir des liens « article précédent / suivant » ou des recommandations contextuelles si cela s'intègre naturellement, sans inventer de relations éditoriales.
- Prévoir un fil d'Ariane sur les pages articles.
- Ajouter title, meta description, canonical et Open Graph pour chaque article, en utilisant les valeurs du manifeste.
- Ajouter un lien retour vers la catégorie et vers l'accueil du Coin des parents.
- Utiliser des URLs relatives robustes : le site doit fonctionner à la fois sous `/ecole-maternelle-lila/` en prévisualisation GitHub Pages et sur le domaine personnalisé. Ne pas coder en dur un chemin racine qui casse la prévisualisation.
- Respecter la navigation existante et le sous-menu « Ressources ». La Médiathèque éducative reste marquée « Bientôt » et ne doit pas pointer vers une page inexistante.

## Design
Respecter la direction artistique validée pour le Coin des parents :
- Titres : Fraunces.
- Texte et navigation : Nunito.
- Pacifico uniquement en petite touche décorative, jamais pour les paragraphes.
- Boutons et accents fonctionnels : vert sauge `#4F6B4C`.
- Univers chaleureux, éditorial, contemporain et lisible.
- Conserver une mise en page mobile-first, des paragraphes confortables et une hiérarchie typographique nette.
- Ne pas appliquer le style aquarelle ancien ni le style vectoriel cartoon aux illustrations.
- Les illustrations éditoriales seront fournies séparément après validation des sujets et de la direction artistique.

## Contraintes techniques
- Projet existant en HTML, CSS et JavaScript natifs.
- Éviter de modifier la feuille CSS principale, qui comporte de nombreuses règles historiques et `!important`. Privilégier une feuille indépendante `css/coin-des-parents.css` et limiter les conflits.
- Ne pas introduire de framework, build tool ou dépendance externe sans nécessité et validation.
- Ne pas supprimer ni remplacer des fonctionnalités existantes.
- Ne pas inventer les informations propres à l'établissement.
- Conserver la signature « Article rédigé par l'équipe de l'École Maternelle Lila. »

## Contrôles attendus avant livraison
- Vérifier que les 17 articles sont présents, sans doublon ni article 18.
- Vérifier les liens de chaque carte, les liens internes et les chemins d'images.
- Vérifier les compteurs par catégorie : 3, 3, 3, 3, 3 et 2.
- Vérifier les filtres avec et sans JavaScript si possible.
- Tester les pages en desktop et mobile.
- Tester les URLs en prévisualisation GitHub Pages avec le sous-chemin et sur le domaine final.
- Contrôler title, description, canonical, Open Graph et balisage sémantique.
- Fournir un résumé des fichiers créés/modifiés et des tests réalisés.

## Règle éditoriale
Claude peut corriger la mise en forme HTML et les détails typographiques, mais ne doit pas réécrire les conseils, ajouter des recommandations médicales ou inventer des pratiques de l'école sans validation du commanditaire. Les articles sont des brouillons à relire avant publication.


## Maillage interne obligatoire
Lire `plan-maillage-interne.md` et intégrer les liens contextuels proposés dans les articles, ainsi que les liens catégorie ↔ articles et les fils d'Ariane. Le plan donne trois liens recommandés par article. Ne pas créer de liens vers des pages inexistantes. Vérifier que chaque article reçoit des liens entrants depuis sa catégorie et depuis d'autres articles lorsque pertinent.

## SEO technique complémentaire
Lire et appliquer `checklist-seo.md` pour les métadonnées, canonical, Open Graph, images, données structurées Article/BreadcrumbList, sitemap, robots, accessibilité et performance. Signaler explicitement tout élément impossible à compléter faute d'information réelle (par exemple dates de publication ou auteur nominatif).
