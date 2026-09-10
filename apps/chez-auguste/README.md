# Chez Auguste

Application statique publiée sur GitHub Pages et synchronisée avec Supabase.

- accès par un mot de passe unique, sans identifiant ni lien reçu par e-mail ;
- accueil centré sur `Pilotage vente`, avec un accès rapide à `Hygiène & traçabilité` ;
- carte validée affichée dans le pilotage vente, avec un mode édition séparé ;
- menus, recettes, fiches techniques et données du bar partagés ;
- scan photo des étiquettes, classement par jour et historique partagé ;
- mises à jour diffusées en temps réel ;
- copie locale conservée en cas de coupure réseau.

## Construction

```sh
npm ci
npm run typecheck
npm run build
```

La compilation génère le site statique dans `../../chez-auguste/`, utilisé par GitHub Pages.
