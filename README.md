# Calculateur de solde de vacances

Petite page web pour projeter son solde de vacances à une date future, en tenant compte de l'accumulation mensuelle et des congés déjà planifiés.

Aucune installation ni build: ouvre `index.html` dans ton navigateur.

## Fonctionnement

### Calculateur
- Entre ton **solde actuel** (en heures) et la **date des vacances**.
- Le résultat affiche le solde projeté en heures, en jours et en semaines (une semaine = 5 jours), avec le détail des heures accumulées et des congés déduits.
- Le solde saisi est sauvegardé avec sa date de saisie. Si tu rouvres l'app plus tard, un « solde actuel estimé » rattrape les fins de mois et les congés écoulés depuis. Pour repartir de ton vrai solde, retape-le dans le champ.
- Un avertissement apparaît si le solde projeté est négatif.

### Congés
- Calendrier mensuel (la semaine commence le dimanche).
- Clique sur une date de début, puis sur une date de fin (deux fois le même jour pour un seul jour).
- Clique sur un congé existant, ou utilise la liste, pour le modifier ou le supprimer.
- Seuls les jours de semaine (lundi au vendredi) comptent. Les jours fériés ne sont pas exclus: scinde le congé en deux pour en retirer un.
- Les congés qui se chevauchent sont refusés.

### Config (icône de clé à molette)
- Jours de vacances par année (défaut 30) et heures par jour (défaut 7.25).
- Accumulation mensuelle: `jours × heures par jour ÷ 12`. Avec les valeurs par défaut: 18.13 h.

## Règles de calcul
- L'accumulation se fait le **dernier jour de chaque mois** (28, 29, 30 ou 31).
- Le solde saisi est supposé inclure déjà l'accumulation du jour de saisie.
- La fin de mois tombant le jour de la date cible est comptée.
- Les congés sont déduits entre la date de saisie du solde et la date cible. Seul le solde final compte, pas l'ordre des événements.

## Données
Tout est stocké dans le `localStorage` du navigateur (config, solde, congés). Rien n'est envoyé ailleurs. Les données sont propres au navigateur et à l'emplacement du fichier: les vider ou changer de navigateur les efface.

## Fichiers
- `index.html`: structure des vues.
- `app.js`: calculs et interface. Les fonctions de calcul sont exportées pour être testées avec Node.
- `style.css`: styles.
