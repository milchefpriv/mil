# Générateur de compte rendu de chantier

Application web autonome, hébergée par GitHub Pages et synchronisée avec Supabase.

## Fonctionnement

- connexion sans mot de passe par lien reçu par e-mail ;
- projets et comptes rendus enregistrés dans Supabase ;
- synchronisation entre téléphone et ordinateur avec le même compte ;
- copie locale conservée dans le navigateur en cas de coupure réseau ;
- export des comptes rendus en PDF et Excel.

## Développement

```bash
npm install
npm run dev
```

La version de production est générée avec :

```bash
npm run typecheck
npm run build
```

Le schéma de base de données et les règles de sécurité se trouvent dans `supabase/migrations/`.
