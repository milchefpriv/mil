import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const buildRoot = `${projectRoot}/.build`;
const outputPath = `${projectRoot}/../../chez-auguste/index.html`;

const escapeClosingTag = (value, tag) => value.replaceAll(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
const assetPath = (reference) => `${buildRoot}/${reference.replace(/^\.\//, "").replace(/^\//, "")}`;
const replaceLiteralOnce = (document, target, replacement) => {
  if (!document.includes(target)) {
    throw new Error("La ressource à intégrer n’existe plus dans le document compilé.");
  }

  // A replacement callback is required here. The compiled JavaScript contains
  // sequences such as $&, $` and $' which String.replace would otherwise
  // interpret as substitution tokens and turn into duplicated HTML markup.
  return document.replace(target, () => replacement);
};
const replaceLiteralLast = (document, target, replacement) => {
  const index = document.lastIndexOf(target);
  if (index === -1) {
    throw new Error("La balise finale du document compilé est introuvable.");
  }

  return `${document.slice(0, index)}${replacement}${document.slice(index + target.length)}`;
};

let html = await readFile(`${buildRoot}/index.html`, "utf8");
const scriptTag = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i);
const styleTag = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/i);

if (!scriptTag || !styleTag) {
  throw new Error("Les ressources de l’application n’ont pas été trouvées dans la compilation.");
}

const [javascript, stylesheet] = await Promise.all([
  readFile(assetPath(scriptTag[1]), "utf8"),
  readFile(assetPath(styleTag[1]), "utf8"),
]);

if (/(?:@import\s+|url\(\s*["']?)(?:https?:|\/\/)/i.test(stylesheet)) {
  throw new Error("La feuille de style contient encore une ressource externe.");
}

html = replaceLiteralOnce(
  html,
  styleTag[0],
  `<style>${escapeClosingTag(stylesheet, "style")}</style>`,
);
html = replaceLiteralOnce(
  html,
  scriptTag[0],
  `<script type="module">${escapeClosingTag(javascript, "script")}</script>`,
);
html = replaceLiteralLast(
  html,
  "</body>",
  "<!-- Application autonome : styles, logique, données et génération PDF sont inclus dans ce fichier. -->\n  </body>",
);

const rawScriptClosings = html.match(/<\/script\s*>/gi) ?? [];
const expectedScriptClosings = 3;
if (rawScriptClosings.length !== expectedScriptClosings) {
  throw new Error(
    `Le fichier autonome contient ${rawScriptClosings.length} fermetures de script au lieu de ${expectedScriptClosings}.`,
  );
}

const markupOnly = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>");
const externalAsset = /<(?:script|link|img)\b[^>]*(?:src|href)=["'](?:https?:|\/\/|\.\/|\/)[^"']+["']/i;
const requiredMarkers = [
  "Ajouter un produit carte",
  "Fiche technique",
  "Sauvegarder la carte",
  "Revenir à la dernière carte",
  "Télécharger la carte PDF",
  "Imprimer la carte",
  "Sauvegarder l’outil (.html)",
  "Importer une sauvegarde",
  "Restaurer les données d’origine",
  "Plan de production",
  "Liste de courses & budget",
  "Menus archivés",
];

if (externalAsset.test(markupOnly)) {
  throw new Error("Le fichier final contient encore une ressource externe.");
}

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Fonction absente du fichier autonome : ${marker}`);
  }
}

await writeFile(outputPath, html, "utf8");

const sizeInMegabytes = Buffer.byteLength(html) / 1024 / 1024;
process.stdout.write(`Fichier autonome créé : ${outputPath} (${sizeInMegabytes.toFixed(2)} Mo)\n`);
