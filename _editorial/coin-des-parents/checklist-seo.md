# Checklist SEO et qualité — Le Coin des parents

Cette checklist complète le manifeste et le brief d'intégration.

## Pour chaque page article
- Un seul H1 correspondant au titre éditorial.
- Un `<title>` unique, concis et descriptif.
- Une meta description unique, rédigée pour donner envie de consulter la page sans promesse exagérée.
- Une URL stable, courte, en minuscules, sans accents.
- Une balise canonical absolue vers la version de production.
- Des métadonnées Open Graph cohérentes (og:title, og:description, og:type=article, og:url, og:image).
- Une image principale pertinente, compressée, avec dimensions explicites et alt descriptif.
- Une hiérarchie H2/H3 logique ; pas de H2 utilisé uniquement pour agrandir le texte.
- Un fil d'Ariane visible et un balisage `BreadcrumbList`.
- Un balisage `Article` ou `BlogPosting` valide, avec headline, description, image, author, publisher, datePublished et dateModified uniquement lorsque les valeurs sont réelles.
- Des liens internes contextuels vers 3 contenus connexes et un lien vers la catégorie.
- Un bloc de sources documentaires vérifiées, avec liens sortants descriptifs.
- Une date de publication / mise à jour uniquement si elle correspond à une vraie date éditoriale.
- Une signature auteur conforme à la charte.
- Pas de répétition artificielle du mot-clé.

## Pour chaque page catégorie
- Un H1 clair et un court texte d'introduction réellement utile.
- Un listing HTML de tous les articles de la catégorie (ne pas dépendre uniquement du JavaScript).
- Un lien vers chaque article, avec titre et résumé distinctif.
- Title et meta description propres à la catégorie.
- Canonical et Open Graph.
- Pas de page catégorie vide ou avec contenu dupliqué.

## Pour l'accueil du Coin des parents
- Présenter clairement la vocation éditoriale.
- Afficher les six catégories et les 17 articles, avec filtres accessibles.
- Les filtres peuvent masquer/afficher les cartes côté client, mais le contenu et les liens doivent être présents dans le HTML.
- Le nombre d'articles doit provenir du manifeste, jamais d'un compteur saisi à la main.
- Afficher un état vide clair si une recherche ne renvoie aucun résultat.

## SEO technique du site
- Mettre à jour `sitemap.xml` avec toutes les nouvelles pages publiées.
- Vérifier `robots.txt` et les directives `noindex`.
- Vérifier les canonical pour éviter les doublons entre domaine personnalisé et URL GitHub Pages.
- Vérifier les URLs absolues et les chemins d'assets sous le sous-chemin GitHub Pages.
- Contrôler les liens internes et les erreurs 404.
- Vérifier les aperçus de partage Open Graph.
- Tester la performance mobile, le poids des images et le chargement des polices.
- Ajouter les données structurées uniquement si elles reflètent le contenu visible et réel.
- Ne pas afficher de note, avis, date, auteur individuel ou expertise médicale non vérifiés.

## Mesure
Si un outil d'analytics est déjà configuré et autorisé, prévoir le suivi des clics de catégories, des filtres et des liens d'articles. Ne pas ajouter de traceur ou de cookie non nécessaire sans vérifier les obligations de consentement applicables.
