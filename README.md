# Jeux de société de Saint-Vallier

Registre des parties et tableau de bord statistique. Site entièrement statique :
HTML, CSS et JavaScript natif (modules ES), sans build, sans framework, sans
dépendance externe. Il se dépose tel quel sur GitHub Pages.

## Mettre le site en ligne

1. Créez un dépôt GitHub public, par exemple `jeux-saint-vallier`.
2. Déposez-y le contenu de ce dossier (`index.html`, `assets/`, `data/`) à la racine.
3. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
4. Une minute plus tard, le site répond sur `https://<votre-compte>.github.io/jeux-saint-vallier/`.

Aucune configuration supplémentaire n'est nécessaire : pas de serveur, pas de base
de données, pas de clé d'API.

## Où vivent les données

`data/db.json` est le fichier publié : c'est ce que voient tous les visiteurs.

Quand l'admin ajoute ou modifie quelque chose, les changements sont d'abord
enregistrés dans **son propre navigateur**. Un bouton « Modifications à publier »
apparaît alors dans le bandeau. Il ouvre une fenêtre qui permet de copier ou de
télécharger le nouveau `db.json`. Il suffit de remplacer le fichier dans le dépôt
et de valider : les invités voient la mise à jour au rechargement suivant.

Le site compare les dates : si votre copie locale est plus récente que le fichier
publié, c'est elle qui s'affiche. Sinon, le fichier du dépôt reprend la main.

Raccourci : connecté en Admin, **Maj + I** permet de recharger un `db.json`
depuis l'ordinateur (utile pour repartir d'une sauvegarde).

## Accès

- **Invité** : consultation des statistiques.
- **Admin** : `Admin` / `JeuxDeSociete`, plus la gestion des parties et des données.

Ce mot de passe est écrit dans `assets/app.js` et donc visible par quiconque
ouvre le code source du site. Il empêche un visiteur de passer par mégarde en
mode gestion ; il ne protège pas contre quelqu'un de déterminé. Comme le dépôt
ne contient que des scores de jeux de société, c'est un compromis raisonnable —
mais ne réutilisez pas ce mot de passe ailleurs.

## Organisation des fichiers

```
index.html              page unique, routage par ancre (#/stats, #/parties, #/data)
data/db.json            joueurs, jeux et parties publiés
assets/app.css          palette, typographie, composants
assets/app.js           routeur, authentification, bandeau
assets/store.js         chargement, validation et persistance des données
assets/compute.js       moteur de statistiques (aucune dépendance au DOM)
assets/charts.js        graphiques SVG générés à la main
assets/ui.js            modales, confirmations, notifications
assets/vue-stats.js     tableau de bord
assets/vue-parties.js   liste et édition des parties
assets/vue-data.js      joueurs et jeux, publication
```

## Les statistiques, en deux mots

- **Taux de victoire** : victoires / parties jouées.
- **Victoires attendues** : somme, sur chaque partie, de (nombre de gagnants ÷ nombre de joueurs).
  C'est le score d'un joueur parfaitement moyen face aux mêmes adversaires.
- **Indice de performance** : victoires ÷ victoires attendues. 1,00 = la moyenne ;
  1,50 = moitié plus de victoires qu'attendu. C'est le critère de tri du classement,
  parce qu'il corrige la taille des tables : gagner 30 % de ses parties à cinq vaut
  mieux que 30 % à deux.
- **Seuil** : nombre minimum de parties pour entrer dans les classements de taux.
  Réglable en haut de la page (3 par défaut), pour éviter qu'un joueur à une seule
  partie trône à 100 %.

Une partie peut avoir plusieurs gagnants : équipe, égalité, ou coopératif gagné
par toute la table. Chaque gagnant reçoit une victoire pleine, et les victoires
attendues en tiennent compte.

## Modifier le code

Tout se lit et s'édite directement, sans outil. Pour travailler en local, il faut
quand même un petit serveur (les modules ES et `fetch` ne fonctionnent pas depuis
`file://`) :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```
