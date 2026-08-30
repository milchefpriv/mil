import { CATEGORIES, TAGS } from "./model.js";

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export const money = (value) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 2,
}).format(Number(value) || 0);

const categoryMeta = (id, state) => (state.categories || CATEGORIES).find((item) => item.id === id) || { label: id, short: id, color: "#777" };
const productImage = (product) => product.photo
  ? `<img class="product-thumb-image" src="${escapeHtml(product.photo.replace(/^\/media\//, "./media/").replace(/^\.\/media\//, "./media/"))}" alt="" loading="lazy" style="object-position:${product.photoPositionX ?? 50}% ${product.photoPositionY ?? 50}%;transform:scale(${product.photoZoom || 1})">`
  : `<div class="product-visual-fallback theme-${escapeHtml(product.visualTheme || "category")}"><small>${escapeHtml(product.country || "RECETTE")}</small><b>${escapeHtml(categoryMeta(product.category, { categories: CATEGORIES }).short)}</b></div>`;

function technicalMissing(product) {
  const missing = [];
  if (!product.ingredients?.trim()) missing.push("ingrédients");
  if (!product.steps?.trim()) missing.push("méthode");
  if (!product.equipment?.trim()) missing.push("matériel");
  if (!product.storage?.trim()) missing.push("conservation");
  if (!product.service?.trim()) missing.push("service");
  if (!product.allergens?.trim()) missing.push("allergènes");
  return missing;
}

export function shell(state, view, readOnly, syncStatus, pageHtml) {
  const nav = [
    ["dashboard", "⌂", "Aujourd’hui", "Vue d’ensemble"],
    ["catalogue", "▦", "Répertoire", "Recettes & produits"],
    ["formulas", "◫", "Formules", "Composer l’offre"],
    ["addons", "＋", "Ajouts rapides", "À la carte"],
    ["orders", "✓", "Prestations", "Demandes clients"],
    ["documents", "↓", "Documents", "Cartes & exports"],
  ];
  if (!readOnly) nav.push(["settings", "⚙", "Réglages", "Données & sécurité"]);
  const active = nav.find(([id]) => id === view) || nav[0];
  return `<div class="atelier-shell ${readOnly ? "read-only" : ""}">
    <button class="nav-scrim" aria-label="Fermer"></button>
    <aside id="atelier-navigation" class="sidebar">
      <div class="brand-block"><img class="mil-logo" src="./mil-logo.webp" alt="MiL"><div><b>Atelier</b><span>Gestion chef</span></div></div>
      <nav>${nav.map(([id, icon, label, sub]) => `<button data-view="${id}" class="${id === view ? "active" : ""}" ${id === view ? 'aria-current="page"' : ""}><i>${icon}</i><span><b>${label}</b><small>${sub}</small></span></button>`).join("")}</nav>
      <div class="sidebar-note"><span class="pulse"></span><div><b>${readOnly ? "Mode public" : "Atelier connecté"}</b><small>${readOnly ? "Lecture seule" : "Synchronisé"}</small></div></div>
    </aside>
    <main class="workspace">
      ${readOnly ? `<section class="readonly-banner" role="status"><div><b>Consultation publique</b><span>Les modifications et les demandes clients restent réservées au propriétaire.</span></div><button class="button light" data-login>Accès propriétaire</button></section>` : ""}
      <header class="topbar"><button class="menu-button" aria-label="Menu">☰</button><div class="topbar-title"><h1>${active[2]}</h1></div><div class="sync-state ${readOnly ? "readonly" : syncStatus}"><i></i>${readOnly ? "Lecture seule" : syncStatus === "saving" ? "Sauvegarde…" : syncStatus === "error" ? "Hors ligne" : "Synchronisé"}</div></header>
      ${pageHtml}
    </main><div class="toast" role="status"></div>
  </div>`;
}

export function dashboard(state, readOnly) {
  const ready = state.products.filter((product) => technicalMissing(product).length <= 1).length;
  const additions = state.products.filter((product) => product.quickAdd?.enabled).length;
  const recent = [...state.products].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5);
  return `<div class="page dashboard-page">
    <section class="welcome-card"><div><span class="eyebrow">ATELIER MiL</span><h2>Pilotage</h2></div><div class="welcome-actions"><button class="button light" data-view="orders">Composer un devis</button><button class="button light" data-view="formulas">Matrice</button><a class="button gold" href="./questionnaire/">Questionnaire ↗</a></div></section>
    <section class="metric-grid">
      <article class="metric ink"><span>Recettes</span><strong>${state.products.length}</strong><small>${state.products.filter((p) => p.published).length} publiques</small></article>
      <article class="metric green"><span>Fiches prêtes</span><strong>${ready}/${state.products.length}</strong><small>Technique + coût</small></article>
      <article class="metric gold"><span>Formules</span><strong>${state.formulas.filter((f) => f.active).length}</strong><small>Actives</small></article>
      <article class="metric blue"><span>Ajouts</span><strong>${additions}</strong><small>À la carte</small></article>
    </section>
    <div class="dashboard-grid"><section class="panel-card"><div class="section-title"><div><span>OFFRE</span><h2>Contrôles</h2></div><button class="text-button" data-view="formulas">Matrice →</button></div><div class="success-box"><i>✓</i><div><b>Formules cohérentes</b><span>Aucun quota bloquant.</span></div></div></section>
    <section class="panel-card"><div class="section-title"><div><span>RÉCENT</span><h2>Dernières recettes</h2></div><button class="text-button" data-view="catalogue">Répertoire →</button></div><div class="recent-list">${recent.map((product) => `<button data-edit-product="${product.id}">${productImage(product)}<span><b>${escapeHtml(product.name)}</b><small>${escapeHtml(categoryMeta(product.category, state).label)}</small></span><em>${readOnly ? "Consulter" : "Modifier"}</em></button>`).join("")}</div></section></div>
  </div>`;
}

export function catalogue(state, readOnly, filters = {}) {
  const categories = state.categories || CATEGORIES;
  let products = state.products.filter((product) => !filters.category || product.category === filters.category);
  if (filters.search) products = products.filter((product) => `${product.name} ${product.description} ${product.country}`.toLowerCase().includes(filters.search.toLowerCase()));
  if (filters.visibility === "published") products = products.filter((product) => product.published);
  if (filters.visibility === "internal") products = products.filter((product) => !product.published);
  if (filters.visibility === "quick") products = products.filter((product) => product.quickAdd?.enabled);
  if (filters.tag) products = products.filter((product) => product.tags?.includes(filters.tag));
  const groups = categories.map((category) => ({ ...category, products: products.filter((product) => product.category === category.id) })).filter((group) => group.products.length);
  return `<div class="page catalogue-page"><section class="catalogue-hero"><div><span class="eyebrow">CATALOGUE MAÎTRE</span><h2>Répertoire</h2></div>${readOnly ? "" : '<button class="button gold" data-new-product>＋ Nouvelle recette</button>'}</section>
    <div class="category-strip"><button data-category="" class="${!filters.category ? "active" : ""}"><b>${state.products.length}</b><span>Tout</span></button>${categories.map((category) => `<button data-category="${category.id}" class="${filters.category === category.id ? "active" : ""}"><b>${state.products.filter((p) => p.category === category.id).length}</b><span>${escapeHtml(category.short)}</span></button>`).join("")}</div>
    <section class="filter-bar"><label class="search-field"><span>⌕</span><input data-filter-search value="${escapeHtml(filters.search || "")}" placeholder="Recette, ingrédient…" aria-label="Rechercher une recette"></label>
      <select data-filter-visibility aria-label="Filtrer par visibilité"><option value="">Toute visibilité</option><option value="published" ${filters.visibility === "published" ? "selected" : ""}>Publiées</option><option value="internal" ${filters.visibility === "internal" ? "selected" : ""}>Internes</option><option value="quick" ${filters.visibility === "quick" ? "selected" : ""}>Ajouts rapides</option></select>
      <select data-filter-tag aria-label="Filtrer par tag"><option value="">Tous les tags</option>${TAGS.map((tag) => `<option value="${tag.id}" ${filters.tag === tag.id ? "selected" : ""}>${tag.label}</option>`).join("")}</select><button class="button light" data-clear-filters>Effacer</button></section>
    <div class="catalogue-count">${products.length} recette${products.length > 1 ? "s" : ""}</div>
    ${groups.map((group) => `<section class="catalogue-section"><div class="catalogue-section-title"><h3>${escapeHtml(group.label)}</h3><span>${group.products.length}</span></div><div class="catalogue-grid">${group.products.map((product) => productCard(product, state, readOnly)).join("")}</div></section>`).join("") || '<div class="empty-state">Aucune recette avec ces filtres.</div>'}
  </div>`;
}

function productCard(product, state, readOnly) {
  const missing = technicalMissing(product);
  return `<article class="catalogue-card"><button class="catalogue-card-media" data-edit-product="${product.id}" aria-label="${readOnly ? "Consulter" : "Modifier"} ${escapeHtml(product.name)}">${productImage(product)}</button><div class="catalogue-card-body"><span class="catalogue-category">${escapeHtml(categoryMeta(product.category, state).label)}</span><h3>${escapeHtml(product.name)}</h3><div class="catalogue-meta"><span>${escapeHtml(product.range === "live" ? "Live cooking" : product.range === "premium" ? "Premium" : "Découverte")} · ${escapeHtml(product.country || "—")}</span><span>${product.published ? "Public" : "Interne"}</span></div><div class="catalogue-stats"><div><small>Coût matière</small><b>${money(product.costUnit)}</b></div><div><small>Production</small><b>${Math.round((product.prepMinutesUnit || 0) + (product.fixedMinutes || 0))} min</b></div></div><div class="completion ${missing.length ? "warning" : "complete"}">${missing.length ? `${missing.length} élément(s) à compléter` : "✓ Fiche prête"}</div></div></article>`;
}

export function formulas(state, readOnly, selectedId, mode = "ready") {
  const selected = state.formulas.find((formula) => formula.id === selectedId) || state.formulas[0];
  if (!selected) return '<div class="page"><div class="empty-state">Aucune formule.</div></div>';
  return `<div class="page formulas-page"><section class="formula-hero"><div><span class="eyebrow">OFFRE CLIENT</span><h2>Formules</h2><p>Les réglages ci-dessous alimentent directement le questionnaire public.</p></div></section>
    <div class="formula-switcher">${state.formulas.map((formula) => `<button data-formula="${formula.id}" class="${formula.id === selected.id ? "active" : ""}"><span>${formula.recommended ? "Recommandée" : "Formule"}</span><b>${escapeHtml(formula.name)}</b><small>dès ${money(formula.presentations?.ready?.pricePerGuest ?? formula.pricePerGuest)} / pers.</small></button>`).join("")}</div>
    <div class="formula-mode-tabs"><button data-mode="ready" class="${mode === "ready" ? "active" : ""}"><b>Déjà composée</b><small>Menu fixé dans l’atelier</small></button><button data-mode="custom" class="${mode === "custom" ? "active" : ""}"><b>À composer</b><small>Le client choisit ses recettes</small></button></div>
    <section class="formula-editor"><div class="formula-summary-card"><div><span class="eyebrow">PRÉSENTATION CLIENT</span><h2>${escapeHtml(selected.presentations?.[mode]?.name || selected.name)}</h2><p>${escapeHtml(selected.presentations?.[mode]?.description || selected.description)}</p></div><strong>${money(selected.presentations?.[mode]?.pricePerGuest ?? selected.pricePerGuest)}<small> / pers.</small></strong></div>
      ${readOnly ? "" : `<div class="editor-fields"><label>Nom<input data-formula-field="name" value="${escapeHtml(selected.presentations?.[mode]?.name || selected.name)}"></label><label>Prix / personne<input type="number" step="0.5" data-formula-field="pricePerGuest" value="${selected.presentations?.[mode]?.pricePerGuest ?? selected.pricePerGuest}"></label><label class="wide">Description<textarea data-formula-field="description">${escapeHtml(selected.presentations?.[mode]?.description || selected.description)}</textarea></label></div>`}
      <div class="rule-list">${selected.rules.map((rule) => ruleEditor(rule, state, readOnly, mode)).join("")}</div>
    </section></div>`;
}

function ruleEditor(rule, state, readOnly, mode) {
  const meta = categoryMeta(rule.category, state);
  const candidates = Object.entries(rule.products || {}).map(([id, config]) => ({ product: state.products.find((p) => p.id === id), config })).filter((row) => row.product);
  return `<section class="rule-card ${rule.enabled === false ? "disabled" : ""}" style="--rule-color:${meta.color}"><header><div><i></i><span>${escapeHtml(meta.label)}</span></div><b>${mode === "ready" ? rule.readyChoices : rule.choices} choix</b></header>
    ${readOnly ? "" : `<div class="rule-controls"><label><input type="checkbox" data-rule-enabled="${rule.category}" ${rule.enabled !== false ? "checked" : ""}> Catégorie active</label><label>Quota <input type="number" min="1" data-rule-choices="${rule.category}" value="${mode === "ready" ? rule.readyChoices : rule.choices}"></label></div>`}
    <div class="rule-products">${candidates.map(({ product, config }) => `<label class="rule-product ${config.enabled === false ? "off" : ""}">${productImage(product)}<span><b>${escapeHtml(product.name)}</b><small>${config.surcharge ? `+ ${money(config.surcharge)}` : "Inclus"}</small></span>${readOnly ? "" : `<input type="checkbox" data-rule-product="${rule.category}:${product.id}" ${mode === "ready" ? (config.preset ? "checked" : "") : (config.enabled !== false ? "checked" : "")}>`}</label>`).join("")}</div>
  </section>`;
}

export function addons(state, readOnly) {
  const additions = state.products.filter((product) => product.quickAdd?.enabled);
  return `<div class="page quick-adds-page"><section class="catalogue-hero"><div><span class="eyebrow">À LA CARTE</span><h2>Ajouts rapides</h2><p>Ces options apparaissent après le choix d’une formule.</p></div></section><div class="catalogue-grid">${additions.map((product) => productCard(product, state, readOnly)).join("") || '<div class="empty-state">Aucun ajout activé.</div>'}</div></div>`;
}

export function orders(state, readOnly) {
  const orders = state.orders || [];
  return `<div class="page prestations-page"><section class="catalogue-hero"><div><span class="eyebrow">DEMANDES CLIENTS</span><h2>Prestations</h2><p>Les demandes envoyées depuis le questionnaire apparaissent ici.</p></div></section>${orders.length ? `<div class="orders-list">${orders.map((order) => { const payload = order.payload || order; const client = payload.client || {}; const snapshot = payload.snapshot || {}; return `<article class="order-card"><div><span class="eyebrow">${escapeHtml(new Date(order.created_at || payload.createdAt).toLocaleDateString("fr-FR"))}</span><h3>${escapeHtml(client.name || "Client")}</h3><p>${escapeHtml(snapshot.formulaName || "Demande de devis")} · ${snapshot.guests || "—"} convives · ${money(snapshot.totalTTC)} TTC</p></div>${readOnly ? "" : `<select data-order-status="${escapeHtml(order.id || payload.id)}"><option value="new" ${(order.status || payload.status) === "new" ? "selected" : ""}>Nouvelle</option><option value="contacted" ${(order.status || payload.status) === "contacted" ? "selected" : ""}>Contactée</option><option value="quoted" ${(order.status || payload.status) === "quoted" ? "selected" : ""}>Devis envoyé</option><option value="confirmed" ${(order.status || payload.status) === "confirmed" ? "selected" : ""}>Confirmée</option><option value="done" ${(order.status || payload.status) === "done" ? "selected" : ""}>Terminée</option><option value="cancelled" ${(order.status || payload.status) === "cancelled" ? "selected" : ""}>Annulée</option></select>`}</article>`; }).join("")}</div>` : '<div class="empty-state"><b>Aucune demande pour le moment.</b><span>Les prochaines demandes du questionnaire seront synchronisées ici.</span></div>'}</div>`;
}

export function documents(state) {
  return `<div class="page documents-page"><section class="catalogue-hero"><div><span class="eyebrow">EXPORTS</span><h2>Documents</h2><p>Cartes client, sauvegarde de l’atelier et données de production.</p></div></section><div class="document-grid"><article><span>QUESTIONNAIRE</span><h3>Page client</h3><p>Ouvrir la version publique alimentée par l’atelier.</p><a class="button gold" href="./questionnaire/">Ouvrir ↗</a></article><article><span>SAUVEGARDE</span><h3>Données JSON</h3><p>Une copie portable des recettes, formules et réglages.</p><button class="button light" data-export-state>Télécharger</button></article><article><span>CARTE</span><h3>Offre actuelle</h3><p>Une version imprimable des formules actives.</p><button class="button light" data-print-formulas>Imprimer</button></article></div></div>`;
}

export function settings(state) {
  const settings = state.settings;
  return `<div class="page settings-page"><section class="catalogue-hero"><div><span class="eyebrow">ATELIER</span><h2>Réglages</h2><p>Conditions commerciales et synchronisation.</p></div><button class="button light" data-logout>Se déconnecter</button></section><section class="settings-card"><div class="editor-fields"><label>Coût horaire (€)<input type="number" step="0.5" data-setting="hourlyCost" value="${settings.hourlyCost}"></label><label>TVA (%)<input type="number" step="0.1" data-setting="vat" value="${settings.vat}"></label><label>Acompte (%)<input type="number" data-setting="deposit" value="${settings.deposit}"></label><label>Minimum de convives<input type="number" data-setting="defaultMinimum" value="${settings.defaultMinimum}"></label><label>Solde à J-<input type="number" data-setting="balanceDueDays" value="${settings.balanceDueDays}"></label><label class="wide">Modes de paiement<input data-setting="paymentMethods" value="${escapeHtml(settings.paymentMethods)}"></label><label class="wide">URL Formspree<input data-setting="formspreeEndpoint" value="${escapeHtml(settings.formspreeEndpoint)}"></label><label class="wide">Conditions<textarea data-setting="terms">${escapeHtml(settings.terms)}</textarea></label></div></section></div>`;
}

export function productEditor(product, state, readOnly) {
  const categoryOptions = (state.categories || CATEGORIES).map((category) => `<option value="${category.id}" ${product.category === category.id ? "selected" : ""}>${category.label}</option>`).join("");
  const tagChecks = (state.tags || TAGS).map((tag) => `<label><input type="checkbox" name="tags" value="${tag.id}" ${product.tags?.includes(tag.id) ? "checked" : ""}>${tag.label}</label>`).join("");
  return `<div class="editor-backdrop show"><section class="product-editor" role="dialog" aria-modal="true"><header><div><span class="eyebrow">FICHE RECETTE</span><h2>${escapeHtml(product.name)}</h2></div><button class="icon-button" data-close-editor>×</button></header><form data-product-form><input type="hidden" name="id" value="${escapeHtml(product.id)}"><div class="product-editor-grid"><div class="editor-photo">${productImage(product)}</div><div class="editor-fields"><label>Nom<input name="name" value="${escapeHtml(product.name)}" ${readOnly ? "disabled" : ""}></label><label>Catégorie<select name="category" ${readOnly ? "disabled" : ""}>${categoryOptions}</select></label><label class="wide">Description client<textarea name="description" ${readOnly ? "disabled" : ""}>${escapeHtml(product.description)}</textarea></label><label>Pays<input name="country" value="${escapeHtml(product.country)}" ${readOnly ? "disabled" : ""}></label><label>Gamme<select name="range" ${readOnly ? "disabled" : ""}><option value="decouverte" ${product.range === "decouverte" ? "selected" : ""}>Découverte</option><option value="premium" ${product.range === "premium" ? "selected" : ""}>Premium</option><option value="live" ${product.range === "live" ? "selected" : ""}>Live cooking</option></select></label><label><input type="checkbox" name="published" ${product.published ? "checked" : ""} ${readOnly ? "disabled" : ""}> Visible au public</label><label><input type="checkbox" name="quickAdd" ${product.quickAdd?.enabled ? "checked" : ""} ${readOnly ? "disabled" : ""}> Ajout rapide</label></div></div>
      <section class="editor-section"><h3>Coûts & rendement</h3><div class="editor-fields"><label>Coût matière / unité<input type="number" step="0.01" name="costUnit" value="${product.costUnit}" ${readOnly ? "disabled" : ""}></label><label>Préparation / unité (min)<input type="number" step="0.1" name="prepMinutesUnit" value="${product.prepMinutesUnit}" ${readOnly ? "disabled" : ""}></label><label>Temps fixe (min)<input type="number" step="1" name="fixedMinutes" value="${product.fixedMinutes}" ${readOnly ? "disabled" : ""}></label><label>Emballage / unité<input type="number" step="0.01" name="packCostUnit" value="${product.packCostUnit}" ${readOnly ? "disabled" : ""}></label></div></section>
      <section class="editor-section"><h3>Fiche technique</h3><div class="editor-fields"><label class="wide">Ingrédients<textarea name="ingredients" ${readOnly ? "disabled" : ""}>${escapeHtml(product.ingredients)}</textarea></label><label class="wide">Méthode<textarea name="steps" ${readOnly ? "disabled" : ""}>${escapeHtml(product.steps)}</textarea></label><label>Matériel<textarea name="equipment" ${readOnly ? "disabled" : ""}>${escapeHtml(product.equipment)}</textarea></label><label>Conservation<textarea name="storage" ${readOnly ? "disabled" : ""}>${escapeHtml(product.storage)}</textarea></label><label class="wide">Dressage & service<textarea name="service" ${readOnly ? "disabled" : ""}>${escapeHtml(product.service)}</textarea></label><label class="wide">Allergènes<input name="allergens" value="${escapeHtml(product.allergens)}" ${readOnly ? "disabled" : ""}></label><div class="wide tag-checkboxes">${tagChecks}</div></div></section>
      ${readOnly ? "" : '<footer><button type="button" class="button danger" data-delete-product>Supprimer</button><div><button type="button" class="button light" data-close-editor>Annuler</button><button type="submit" class="button gold">Enregistrer</button></div></footer>'}
    </form></section></div>`;
}

export function loginDialog(message = "") {
  return `<div class="editor-backdrop show"><section class="login-card" role="dialog" aria-modal="true"><button class="icon-button" data-close-login>×</button><img src="./mil-logo.webp" alt="MiL"><span class="eyebrow">ACCÈS PROPRIÉTAIRE</span><h2>Connexion à l’atelier</h2><p>Utilisez votre compte Supabase. Les modifications seront enregistrées et visibles sur tous vos appareils.</p><form data-login-form><label>E-mail<input required type="email" name="email" autocomplete="email"></label><label>Mot de passe<input required minlength="8" type="password" name="password" autocomplete="current-password"></label>${message ? `<div class="form-error">${escapeHtml(message)}</div>` : ""}<button class="button gold" type="submit">Se connecter</button><button class="text-button" type="button" data-signup>Créer mon accès</button></form></section></div>`;
}
