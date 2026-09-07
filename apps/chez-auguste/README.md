# Chez Auguste

Application statique publiée sur GitHub Pages et synchronisée avec Supabase.

- accès par un mot de passe unique, sans identifiant ni lien reçu par e-mail ;
- menus, recettes, fiches techniques et données du bar partagés ;
- mises à jour diffusées en temps réel ;
- copie locale conservée en cas de coupure réseau.

## Construction

```sh
npm ci
npm run typecheck
npm run build
```

La compilation génère le site statique dans `../../chez-auguste/`, utilisé par GitHub Pages.
