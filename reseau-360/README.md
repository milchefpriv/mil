# Réseau 360° — version GitHub Pages

Ce dossier contient le site complet, sans installation ni dépendance.

## Contenu

- `index.html` : contenu de la page
- `styles.css` : mise en page et version mobile
- `script.js` : curseur de montant et calcul des commissions
- `.nojekyll` : publication directe des fichiers statiques

## Mise en ligne sur GitHub Pages

1. Sur GitHub, créez un nouveau dépôt **public** nommé `reseau-360`.
2. Ouvrez le dépôt puis choisissez **Add file → Upload files**.
3. Déposez **le contenu de ce dossier à la racine du dépôt**.
4. Validez avec **Commit changes**.
5. Ouvrez **Settings → Pages**.
6. Dans **Build and deployment**, choisissez **Deploy from a branch**.
7. Sélectionnez la branche **main**, le dossier **/(root)**, puis **Save**.
8. Patientez quelques minutes. L’adresse sera de la forme :
   `https://VOTRE-COMPTE.github.io/reseau-360/`

Le site MIL peut rester dans son propre dépôt : ce projet fonctionne séparément.

## Important pour un usage commercial

Le dossier est un site statique portable : il fonctionne sur GitHub Pages, Cloudflare
Pages, Netlify ou tout hébergement web classique. GitHub précise toutefois que Pages
n’est pas destiné à servir d’hébergement gratuit principal pour un commerce en ligne.
Pour un usage commercial durable, conservez le dépôt sur GitHub mais envisagez de le
publier ensuite avec un hébergeur statique prévu pour ce type de site.

## Nom de domaine sans pseudonyme

L’adresse GitHub par défaut contient le nom du compte. Pour le masquer, ajoutez ensuite
un sous-domaine personnalisé dans **Settings → Pages → Custom domain**, par exemple
`reseau360.votre-domaine.fr`. Il faudra également créer l’entrée DNS correspondante
chez votre hébergeur de domaine.

## Modification

Modifiez les trois fichiers, puis remplacez-les dans le dépôt. GitHub Pages republiera
automatiquement la nouvelle version.
