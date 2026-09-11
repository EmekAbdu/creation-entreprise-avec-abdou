# Dossier de Création — Comptarapide

Formulaire client + espace administrateur, en HTML/CSS/JS pur.
Aucun build, aucun `npm install`. Hébergement GitHub Pages, base Supabase.

| Fichier | Rôle |
|---|---|
| `index.html` | Le formulaire client (9 étapes, FR/TR) |
| `admin.html` | Votre espace : dossiers reçus, badge non lus, photos, suivi |
| `config.js` | **Le seul fichier à modifier** : URL et clé Supabase |
| `supabase.sql` | Script à coller une fois dans Supabase |
| `style.css`, `form.js`, `admin.js`, `supabase.js` | Le code |
| `logo-light.png`, `logo-dark.png` | Votre logo, clair et sombre |

---

## 1. Créer le projet Supabase (10 minutes)

1. Sur [supabase.com](https://supabase.com) → **New project**.
   Nom : `comptarapide-creation`. Région : **Frankfurt (eu-central-1)** — les données restent en Europe, ce qui compte pour le RGPD puisque vous stockez des pièces d'identité.
   Notez le mot de passe de la base, même si vous ne vous en servirez pas ici.
2. Menu **SQL Editor** → **New query** → collez tout le contenu de `supabase.sql` → **Run**.
   Le script crée la table, le stockage privé et les règles de sécurité.
3. Menu **Authentication → Users** → **Add user** :
   votre e-mail, un mot de passe solide, cochez **Auto Confirm User**.
   C'est ce compte qui ouvrira `admin.html`.
4. Menu **Authentication → Sign In / Providers → Email** : désactivez **Enable Sign Up**.
   Sans cela, n'importe qui pourrait se créer un compte et lire vos dossiers.
5. Menu **Project Settings → API** : copiez **Project URL** et la clé **anon public**.

## 2. Renseigner `config.js`

Ouvrez `config.js` et remplacez les deux valeurs :

```js
SUPABASE_URL:      "https://abcdefgh.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

La clé `anon` est publique par conception : elle ne permet que de **déposer** un dossier. Lire, modifier ou supprimer exige votre connexion administrateur. C'est le script SQL qui garantit cela.

## 3. Publier sur GitHub Pages

1. Sur GitHub → **New repository**, nom `comptarapide-creation`, **Public**.
2. Glissez-déposez tous les fichiers de ce dossier à la racine du dépôt → **Commit**.
3. Onglet **Settings → Pages** → *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)` → **Save**.
4. Deux minutes plus tard, vos adresses sont :
   - formulaire : `https://VOTRECOMPTE.github.io/comptarapide-creation/`
   - espace admin : `https://VOTRECOMPTE.github.io/comptarapide-creation/admin.html`

Pour un domaine à vous (`creation.kbis-pascher.fr` par exemple) : **Settings → Pages → Custom domain**, puis chez Hostinger un enregistrement `CNAME` pointant vers `VOTRECOMPTE.github.io`.

## 4. Vérifier avant d'envoyer le lien à un client

- Remplissez un dossier de test de bout en bout, avec au moins une photo.
- Vérifiez qu'il apparaît dans `admin.html`, que la photo s'affiche et que le `.zip` se télécharge.
- Ouvrez le formulaire dans une fenêtre de navigation privée : vous ne devez **pas** pouvoir lire les dossiers.
- Supprimez le dossier de test depuis la fiche.

---

## Comment ça marche

Le client remplit les 9 étapes. À la dernière, « Envoyer mon dossier » :

1. chaque photo part vers le bucket privé `dossiers`, sous `<uuid>/01_nom.jpg` ;
2. une ligne est insérée dans la table `dossiers` avec les réponses, la liste des photos et une **référence** au format `CR-260911-A4F2` affichée au client ;
3. vous voyez le dossier apparaître dans `admin.html` avec la pastille rouge « non lu ».

Le brouillon du client reste sur son appareil (réponses en `localStorage`, photos en `IndexedDB`) : il peut fermer la page et reprendre plus tard. Le bouton « copie .zip » lui permet de garder une trace de son côté ; il n'est pas nécessaire à l'envoi.

Dans l'espace admin, ouvrir une fiche la marque lue automatiquement. Vous disposez du statut (Nouveau / En cours / Traité), de notes internes enregistrées au fil de la frappe, de l'export `.zip` complet et de la suppression définitive (ligne + photos).

## Sécurité et données personnelles

- Le bucket est **privé** : les photos ne sont accessibles que par des liens signés valables une heure, générés pour votre session.
- Un déclencheur SQL empêche un déposant de se déclarer « lu », de fixer un statut ou d'écrire des notes.
- Vous collectez des pièces d'identité et des données de filiation. Supprimez les dossiers traités depuis la fiche une fois la formalité déposée et l'extrait Kbis obtenu : c'est ce que la minimisation des données impose, et c'est un bouton.

## Modifier le formulaire plus tard

Les questions sont décrites dans `form.js`, dans le tableau `STEPS` et la fonction `personFields`. Chaque champ suit la même forme :

```js
{k:"identifiant", type:"text", req:true, l:{fr:"Libellé français", tr:"Türkçe etiket"}, h:{fr:"Aide", tr:"Yardım"}}
```

`type` accepte `text`, `email`, `tel`, `date`, `number`, `select`, `radio`, `textarea`.
`req:true` rend le champ obligatoire, `full:true` l'étale sur toute la largeur, `show:function(){...}` l'affiche sous condition.
Les pièces à photographier sont dans `docSlots()`, les mentions manuscrites dans `mentionSlots()`.
