import { CATEGORIES, TAGS } from "./model.js";

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export const money = (value) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 2,
}).format(Number(value) || 0);

const categoryMeta = (id, state) => (state.categories || CATEGORIES).find((item) => item.id === id) || { label: id, short: id, color: "#777" };
const ANIMALS = { "": "Sans animal", beef: "Bœuf", veal: "Veau", lamb: "Agneau", pork: "Porc", poultry: "Volaille", duck: "Canard", fish: "Poisson", shellfish: "Crustacés / mollusques", other: "Autre animal" };
const GENRES = { "": "À classer", starter: "Entrée", cocktail: "Pièce cocktail", buffet: "Pièce buffet", plate: "Plat", sweet: "Sucré", sharing: "À partager", live: "Live cooking" };
const RANGE_LABELS = { decouverte: "Découverte", premium: "Premium", live: "Live cooking" };
const productImage = (product) => product.photo
  ? `<img class="product-thumb-image" src="${escapeHtml(product.photo.replace(/^\/media\//, "./media/").replace(/^\.\/media\//, "./media/"))}" alt="" loading="lazy" style="object-position:${product.photoPositionX ?? 50}% ${product.photoPositionY ?? 50}%;transform:scale(${product.photoZoom || 1})">`
  : `<div class="product-visual-fallback theme-${escapeHtml(product.visualTheme || "category")}"><small>${escapeHtml(product.country || "RECETTE")}</small><b>${escapeHtml(categoryMeta(product.category, { categories: CATEGORIES }).short)}</b></div>`;

export function technicalMissing(product) {
  const missing = [];
  if (!product.ingredients?.trim()) missing.push("ingrédients");
  if (!product.steps?.trim()) missing.push("méthode");
  if (!product.equipment?.trim()) missing.push("matériel");
  if (!product.storage?.trim()) missing.push("conservation");
  if (!product.service?.trim()) missing.push("service");
  if (!product.allergens?.trim()) missing.push("allergènes");
  return missing;
}

export function productFullCost(product, hourlyCost = 0) {
  const yieldQty = Math.max(1, Number(product.yield) || 1);
  const work = ((Number(product.prepMinutesUnit) || 0) + (Number(product.fixedMinutes) || 0) / yieldQty) * (Number(hourlyCost) || 0) / 60;
  return Math.max(0, Number(product.costUnit) || 0) + Math.max(0, Number(product.packCostUnit) || 0) + work;
}

export function suggestedSale(product, hourlyCost = 0) {
  if (product.quickAdd?.enabled && Number(product.quickAdd.price) > 0) return Number(product.quickAdd.price);
  const margin = Math.min(90, Math.max(20, Number(product.targetMargin) || 65)) / 100;
  return Math.ceil((productFullCost(product, hourlyCost) / Math.max(.1, 1 - margin)) * 2) / 2;
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
  if (filters.search) products = products.filter((product) => `${product.name} ${product.description} ${product.country} ${product.ingredients}`.toLowerCase().includes(filters.search.toLowerCase()));
  if (filters.visibility === "published") products = products.filter((product) => product.published);
  if (filters.visibility === "internal") products = products.filter((product) => !product.published);
  if (filters.visibility === "quick") products = products.filter((product) => product.quickAdd?.enabled);
  if (filters.tag) products = products.filter((product) => product.tags?.includes(filters.tag));
  if (filters.animal) products = products.filter((product) => product.animal === filters.animal);
  if (filters.range) products = products.filter((product) => product.range === filters.range);
  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  products.sort((a, b) => filters.sort === "country" ? collator.compare(a.country, b.country) : filters.sort === "genre" ? collator.compare(a.genre, b.genre) : filters.sort === "range" ? collator.compare(a.range, b.range) : collator.compare(a.name, b.name));
  const groups = categories.map((category) => ({ ...category, products: products.filter((product) => product.category === category.id) })).filter((group) => group.products.length);
  return `<div class="page catalogue-page"><section class="catalogue-hero"><div><span class="eyebrow">CATALOGUE MAÎTRE</span><h2>Répertoire</h2></div>${readOnly ? "" : '<button class="button gold" data-new-product>＋ Nouvelle recette</button>'}</section>
    <div class="category-strip"><button data-category="" class="${!filters.category ? "active" : ""}"><b>${state.products.length}</b><span>Tout</span></button>${categories.map((category) => `<button data-category="${category.id}" class="${filters.category === category.id ? "active" : ""}"><b>${state.products.filter((p) => p.category === category.id).length}</b><span>${escapeHtml(category.short)}</span></button>`).join("")}</div>
    <section class="filter-bar"><label class="search-field"><span>⌕</span><input data-filter-search value="${escapeHtml(filters.search || "")}" placeholder="Recette, ingrédient…" aria-label="Rechercher une recette"></label>
      <select data-filter-visibility aria-label="Filtrer par visibilité"><option value="">Toute visibilité</option><option value="published" ${filters.visibility === "published" ? "selected" : ""}>Publiées</option><option value="internal" ${filters.visibility === "internal" ? "selected" : ""}>Internes</option><option value="quick" ${filters.visibility === "quick" ? "selected" : ""}>Ajouts rapides</option></select>
      <select data-filter-tag><option value="">Tous les tags</option>${TAGS.map((tag) => `<option value="${tag.id}" ${filters.tag === tag.id ? "selected" : ""}>${tag.label}</option>`).join("")}</select>
      <select data-filter-animal><option value="">Tous les animaux</option>${Object.entries(ANIMALS).filter(([id]) => id).map(([id,label]) => `<option value="${id}" ${filters.animal === id ? "selected" : ""}>${label}</option>`).join("")}</select>
      <select data-filter-range><option value="">Toutes les gammes</option>${Object.entries(RANGE_LABELS).map(([id,label]) => `<option value="${id}" ${filters.range === id ? "selected" : ""}>${label}</option>`).join("")}</select>
      <select data-filter-sort><option value="name">Trier : nom</option><option value="country" ${filters.sort === "country" ? "selected" : ""}>Pays</option><option value="genre" ${filters.sort === "genre" ? "selected" : ""}>Genre</option><option value="range" ${filters.sort === "range" ? "selected" : ""}>Gamme</option></select><button class="button light" data-clear-filters>Effacer</button></section>
    <div class="catalogue-count">${products.length} recette${products.length > 1 ? "s" : ""}</div>
    ${groups.map((group) => `<section class="catalogue-section"><div class="catalogue-section-title"><h3>${escapeHtml(group.label)}</h3><span>${group.products.length}</span></div><div class="catalogue-grid">${group.products.map((product) => productCard(product, state, readOnly)).join("")}</div></section>`).join("") || '<div class="empty-state">Aucune recette avec ces filtres.</div>'}
  </div>`;
}

function productCard(product, state, readOnly) {
  const missing = technicalMissing(product);
  const minutes = Math.round((Number(product.prepMinutesUnit) || 0) + (Number(product.fixedMinutes) || 0) / Math.max(1, Number(product.yield) || 1));
  return `<article class="catalogue-card compact"><button class="catalogue-card-media" data-edit-product="${product.id}">${productImage(product)}</button><button class="catalogue-card-body" data-edit-product="${product.id}"><span class="catalogue-category">${escapeHtml(categoryMeta(product.category, state).label)}</span><h3>${escapeHtml(product.name)}</h3><div class="catalogue-meta"><span>${escapeHtml(RANGE_LABELS[product.range] || product.range || "—")} · ${escapeHtml(product.country || "—")}</span><span>${escapeHtml(ANIMALS[product.animal] || GENRES[product.genre] || "À classer")}</span></div><div class="catalogue-stats"><div><small>Coût complet</small><b>${money(productFullCost(product, state.settings.hourlyCost))}</b></div><div><small>Production</small><b>${minutes} min</b></div></div><div class="completion ${missing.length ? "warning" : "complete"}">${missing.length ? `Fiche à compléter · ${missing.length}` : "✓ Fiche technique prête"}</div></button></article>`;
}

export function formulas(state, readOnly, selectedId, mode = "ready") {
  const selected = state.formulas.find((formula) => formula.id === selectedId) || state.formulas[0];
  if (!selected) return '<div class="page"><div class="empty-state">Aucune formule.</div></div>';
  const selectedRules = selected.rules.filter((rule) => rule.enabled !== false);
  const chosen = selectedRules.reduce((sum, rule) => sum + Object.values(rule.products || {}).filter((item) => mode === "ready" ? item.preset : item.enabled !== false).length, 0);
  return `<div class="page formulas-page"><section class="formula-context-bar"><div><span>FORMULE ACTIVE</span><b>${escapeHtml(selected.name)}</b><small>${selectedRules.length} catégories · ${chosen} recettes disponibles</small></div><div><button data-mode="ready" class="${mode === "ready" ? "active" : ""}">Déjà composée</button><button data-mode="custom" class="${mode === "custom" ? "active" : ""}">À composer</button></div></section>
    <section class="formula-hero"><div><span class="eyebrow">OFFRE CLIENT</span><h2>Construire les formules</h2><p>Prix, promesse et composition publiés instantanément dans le questionnaire.</p></div></section>
    <div class="formula-switcher visual">${state.formulas.map((formula) => { const images = state.products.filter((p) => formula.rules.some((r) => r.products?.[p.id]?.preset)).slice(0,4); return `<button data-formula="${formula.id}" class="${formula.id === selected.id ? "active" : ""}"><div class="formula-mosaic">${images.map(productImage).join("")}</div><span>${formula.recommended ? "★ RECOMMANDÉE" : "FORMULE"}</span><b>${escapeHtml(formula.name)}</b><small>${money(formula.presentations?.ready?.pricePerGuest ?? formula.pricePerGuest)} / pers.</small><em>${formula.rules.filter(r => r.enabled !== false).map(r => `${r.readyChoices || r.choices} ${categoryMeta(r.category,state).short}`).join(" · ")}</em></button>`; }).join("")}</div>
    <div class="formula-mode-tabs"><button data-mode="ready" class="${mode === "ready" ? "active" : ""}"><b>Déjà composée</b><small>Menu fixé dans l’atelier</small></button><button data-mode="custom" class="${mode === "custom" ? "active" : ""}"><b>À composer</b><small>Le client choisit ses recettes</small></button></div>
    <section class="formula-editor"><div class="formula-summary-card"><div><span class="eyebrow">PRÉSENTATION CLIENT</span><h2>${escapeHtml(selected.presentations?.[mode]?.name || selected.name)}</h2><p>${escapeHtml(selected.presentations?.[mode]?.description || selected.description)}</p></div><strong>${money(selected.presentations?.[mode]?.pricePerGuest ?? selected.pricePerGuest)}<small> / pers.</small></strong></div>
      ${readOnly ? "" : `<div class="editor-fields formula-details"><label>Nom public<input data-formula-field="name" value="${escapeHtml(selected.presentations?.[mode]?.name || selected.name)}"></label><label>Prix / personne<input type="number" step="0.5" data-formula-field="pricePerGuest" value="${selected.presentations?.[mode]?.pricePerGuest ?? selected.pricePerGuest}"></label><label>Minimum convives<input type="number" data-formula-root="minimumGuests" value="${selected.minimumGuests}"></label><label>Service<select data-formula-root="serviceLevel"><option value="none" ${selected.serviceLevel === "none" ? "selected":""}>Livraison seule</option><option value="delivery" ${selected.serviceLevel === "delivery" ? "selected":""}>Livraison & mise en place</option><option value="staff" ${selected.serviceLevel === "staff" ? "selected":""}>Service inclus</option></select></label><label class="wide">Promesse<textarea data-formula-field="description">${escapeHtml(selected.presentations?.[mode]?.description || selected.description)}</textarea></label></div>`}
      <div class="composition-heading"><div><span class="eyebrow">COMPOSITION</span><h3>${mode === "ready" ? "Menu déjà composé" : "Choix proposés au client"}</h3></div><b>${selectedRules.length} catégories</b></div>
      <div class="rule-list">${selected.rules.map((rule) => ruleEditor(rule, state, readOnly, mode)).join("")}</div>
    </section></div>`;
}

function ruleEditor(rule, state, readOnly, mode) {
  const meta = categoryMeta(rule.category, state);
  const candidates = Object.entries(rule.products || {}).map(([id, config]) => ({ product: state.products.find((p) => p.id === id), config })).filter((row) => row.product);
  const count = candidates.filter(({config}) => mode === "ready" ? config.preset : config.enabled !== false).length;
  return `<section class="rule-card ${rule.enabled === false ? "disabled" : ""}" style="--rule-color:${meta.color}"><header><div><i></i><span>${escapeHtml(meta.label)}</span></div><b>${count}/${mode === "ready" ? rule.readyChoices : rule.choices} sélectionné(s)</b></header>
    ${readOnly ? "" : `<div class="rule-controls"><label class="switch"><input type="checkbox" data-rule-enabled="${rule.category}" ${rule.enabled !== false ? "checked" : ""}> Catégorie active</label><label>Quota <button type="button" data-rule-step="${rule.category}:-1">−</button><input type="number" min="1" data-rule-choices="${rule.category}" value="${mode === "ready" ? rule.readyChoices : rule.choices}"><button type="button" data-rule-step="${rule.category}:1">＋</button></label></div>`}
    <div class="rule-products">${candidates.map(({ product, config }) => `<label class="rule-product ${mode === "ready" ? (config.preset ? "picked":"off") : (config.enabled === false ? "off":"picked")}">${productImage(product)}<span><b>${escapeHtml(product.name)}</b><small>${config.surcharge ? `+ ${money(config.surcharge)}` : "Inclus"} · ${money(productFullCost(product,state.settings.hourlyCost))}</small></span>${readOnly ? "" : `<input type="checkbox" data-rule-product="${rule.category}:${product.id}" ${mode === "ready" ? (config.preset ? "checked" : "") : (config.enabled !== false ? "checked" : "")}>`}</label>`).join("")}</div>
  </section>`;
}

export function addons(state, readOnly) {
  const additions = state.products.filter((product) => product.quickAdd?.enabled);
  return `<div class="page quick-adds-page"><section class="catalogue-hero"><div><span class="eyebrow">À LA CARTE</span><h2>Ajouts rapides</h2><p>Ces options apparaissent après le choix d’une formule.</p></div></section><div class="catalogue-grid">${additions.map((product) => productCard(product, state, readOnly)).join("") || '<div class="empty-state">Aucun ajout activé.</div>'}</div></div>`;
}

export function orders(state, readOnly) {
  const orders = state.orders || [];
  const draft = state.quoteDraft || { client:{}, guests:20, mode:"ready", formulaId:state.formulas[0]?.id, addons:{}, custom:{}, manual:[], notes:"" };
  const formula = state.formulas.find((f) => f.id === draft.formulaId) || state.formulas[0];
  const totals = quoteTotals(state, draft);
  return `<div class="page prestations-page"><section class="catalogue-hero"><div><span class="eyebrow">DEVIS & PRODUCTION</span><h2>Prestations</h2><p>Composez un devis au téléphone, une offre spéciale ou reprenez une demande du questionnaire.</p></div><button class="button light" data-scroll-requests>${orders.length} demande(s) reçue(s)</button></section>
  ${readOnly ? '<div class="readonly-banner"><b>Le constructeur de devis est réservé au propriétaire.</b></div>' : `<div class="quote-layout"><div class="quote-builder">
    <section class="quote-section"><div class="section-title"><div><span>CLIENT</span><h2>Informations de prestation</h2></div></div><div class="editor-fields"><label>Nom / société<input data-quote-client="name" value="${escapeHtml(draft.client?.name || "")}"></label><label>E-mail<input type="email" data-quote-client="email" value="${escapeHtml(draft.client?.email || "")}"></label><label>Date<input type="date" data-quote-client="date" value="${escapeHtml(draft.client?.date || "")}"></label><label>Lieu<input data-quote-client="location" value="${escapeHtml(draft.client?.location || "")}"></label></div></section>
    <section class="quote-section"><div class="quote-guests"><div><span>CONVIVES</span><button data-quote-guests="-5">−</button><strong>${draft.guests || 20}</strong><button data-quote-guests="5">＋</button></div><div class="formula-mode-tabs"><button data-quote-mode="ready" class="${draft.mode !== "custom" ? "active":""}">Déjà composée</button><button data-quote-mode="custom" class="${draft.mode === "custom" ? "active":""}">À composer</button></div></div><div class="quote-formulas">${state.formulas.filter(f => f.active !== false).map(f => `<button data-quote-formula="${f.id}" class="${f.id === formula?.id ? "active":""}"><b>${escapeHtml(f.name)}</b><span>${money(f.presentations?.[draft.mode]?.pricePerGuest ?? f.pricePerGuest)} / pers.</span></button>`).join("")}</div></section>
    ${formula ? `<section class="quote-section"><div class="section-title"><div><span>COMPOSITION</span><h2>${draft.mode === "custom" ? "Choix du menu":"Menu prévu"}</h2></div></div>${formula.rules.filter(r => r.enabled !== false).map(r => { const candidates = Object.entries(r.products || {}).filter(([,c]) => draft.mode === "custom" ? c.enabled !== false : c.preset).map(([id,c]) => ({p:state.products.find(x=>x.id===id),c})).filter(x=>x.p); return `<div class="quote-category"><header><b>${escapeHtml(categoryMeta(r.category,state).label)}</b><span>${r[draft.mode === "custom" ? "choices":"readyChoices"] || 1} choix</span></header><div>${candidates.map(({p,c}) => `<label class="quote-product">${productImage(p)}<span><b>${escapeHtml(p.name)}</b><small>${c.qty || 1} ${escapeHtml(c.unit || "pièce")} / pers.</small></span>${draft.mode === "custom" ? `<input type="checkbox" data-quote-custom="${r.category}:${p.id}" ${draft.custom?.[p.id] ? "checked":""}>`:"✓"}</label>`).join("")}</div></div>`; }).join("")}</section>`:""}
    <section class="quote-section"><div class="section-title"><div><span>EN SUPPLÉMENT</span><h2>Carte complète</h2></div><label class="search-field"><input data-quote-search placeholder="Rechercher parmi les ${state.products.length} recettes"></label></div><div class="addon-catalog">${state.products.map(p => `<div class="addon-line" data-addon-name="${escapeHtml(p.name.toLowerCase())}">${productImage(p)}<span><b>${escapeHtml(p.name)}</b><small>${money(suggestedSale(p,state.settings.hourlyCost))} / unité</small></span><button data-quote-addon="${p.id}:-1">−</button><strong>${draft.addons?.[p.id] || 0}</strong><button data-quote-addon="${p.id}:1">＋</button></div>`).join("")}</div></section>
    <section class="quote-section"><div class="section-title"><div><span>SUR MESURE</span><h2>Lignes libres</h2></div><button class="button light" data-add-manual>＋ Ajouter</button></div><div class="manual-lines">${(draft.manual || []).map((line,i) => `<div><input data-manual-field="${i}:label" value="${escapeHtml(line.label)}" placeholder="Prestation spéciale"><input type="number" min="1" data-manual-field="${i}:qty" value="${line.qty || 1}"><input type="number" step=".01" data-manual-field="${i}:price" value="${line.price || 0}"><button data-remove-manual="${i}">×</button></div>`).join("") || "<p>Aucune ligne libre.</p>"}</div></section>
  </div><aside class="quote-summary"><span class="eyebrow">DEVIS EN DIRECT</span><h2>${escapeHtml(draft.client?.name || "Nouveau devis")}</h2><div class="quote-total-lines"><div><span>Formule</span><b>${money(totals.formula)}</b></div><div><span>Suppléments</span><b>${money(totals.addons)}</b></div><div><span>Sur mesure</span><b>${money(totals.manual)}</b></div><div><span>Total HT</span><b>${money(totals.ht)}</b></div><div><span>TVA ${state.settings.vat}%</span><b>${money(totals.vat)}</b></div><div class="grand"><span>Total TTC</span><b>${money(totals.ttc)}</b></div><div><span>Acompte ${state.settings.deposit}%</span><b>${money(totals.deposit)}</b></div></div><label>Notes<textarea data-quote-notes>${escapeHtml(draft.notes || "")}</textarea></label><button class="button gold" data-save-quote>Enregistrer le devis</button><button class="button light" data-print-quote>Télécharger le devis</button><button class="button light" data-print-production>Dossier de production</button></aside></div>`}
  <section id="client-requests" class="requests-section"><div class="section-title"><div><span>QUESTIONNAIRE</span><h2>Demandes reçues</h2></div></div>${orders.length ? `<div class="orders-list">${orders.map((order) => { const payload=order.payload||order, client=payload.client||{}, snapshot=payload.snapshot||{}; return `<article class="order-card"><div><span class="eyebrow">${escapeHtml(new Date(order.created_at||payload.createdAt).toLocaleDateString("fr-FR"))}</span><h3>${escapeHtml(client.name||"Client")}</h3><p>${escapeHtml(snapshot.formulaName||"Demande")} · ${snapshot.guests||"—"} convives · ${money(snapshot.totalTTC)} TTC</p></div><div><button class="button light" data-use-order="${escapeHtml(order.id||payload.id)}">Créer un devis</button><select data-order-status="${escapeHtml(order.id||payload.id)}"><option value="new">Nouvelle</option><option value="contacted" ${(order.status||payload.status)==="contacted"?"selected":""}>Contactée</option><option value="quoted" ${(order.status||payload.status)==="quoted"?"selected":""}>Devis envoyé</option><option value="confirmed" ${(order.status||payload.status)==="confirmed"?"selected":""}>Confirmée</option><option value="done" ${(order.status||payload.status)==="done"?"selected":""}>Terminée</option></select></div></article>`; }).join("")}</div>`:'<div class="empty-state">Aucune demande reçue.</div>'}</section></div>`;
}

export function quoteTotals(state, draft) {
  const formula = state.formulas.find((f) => f.id === draft.formulaId);
  const guests = Math.max(1, Number(draft.guests) || 1);
  const formulaTotal = (Number(formula?.presentations?.[draft.mode]?.pricePerGuest ?? formula?.pricePerGuest) || 0) * guests;
  const addons = Object.entries(draft.addons || {}).reduce((sum,[id,qty]) => sum + (Number(qty)||0) * suggestedSale(state.products.find(p=>p.id===id)||{},state.settings.hourlyCost),0);
  const manual = (draft.manual || []).reduce((sum,line) => sum + (Number(line.qty)||0)*(Number(line.price)||0),0);
  const ht = formulaTotal + addons + manual;
  const vat = ht * (Number(state.settings.vat)||0) / 100;
  return { formula:formulaTotal, addons, manual, ht, vat, ttc:ht+vat, deposit:(ht+vat)*(Number(state.settings.deposit)||0)/100 };
}

export function documents(state) {
  return `<div class="page documents-page"><section class="catalogue-hero"><div><span class="eyebrow">EXPORTS</span><h2>Documents</h2><p>Cartes client, fiches techniques et données de production.</p></div></section><div class="document-grid"><article><span>QUESTIONNAIRE</span><h3>Page client</h3><p>Ouvrir la version publique alimentée par l’atelier.</p><a class="button gold" href="./questionnaire/">Ouvrir ↗</a></article><article><span>FICHES TECHNIQUES</span><h3>Classeur de production</h3><p>Imprimer les ${state.products.length} fiches avec ingrédients, méthode et allergènes.</p><button class="button gold" data-print-all-sheets>Imprimer les fiches</button></article><article><span>SAUVEGARDE</span><h3>Données JSON</h3><p>Une copie portable des recettes, formules et réglages.</p><button class="button light" data-export-state>Télécharger</button></article><article><span>CARTE</span><h3>Offre actuelle</h3><p>Une version imprimable des formules actives.</p><button class="button light" data-print-formulas>Imprimer</button></article></div></div>`;
}

export function settings(state) {
  const settings = state.settings;
  return `<div class="page settings-page"><section class="catalogue-hero"><div><span class="eyebrow">ATELIER</span><h2>Réglages</h2><p>Conditions commerciales et synchronisation.</p></div><button class="button light" data-logout>Se déconnecter</button></section><section class="settings-card"><div class="editor-fields"><label>Coût horaire (€)<input type="number" step="0.5" data-setting="hourlyCost" value="${settings.hourlyCost}"></label><label>TVA (%)<input type="number" step="0.1" data-setting="vat" value="${settings.vat}"></label><label>Acompte (%)<input type="number" data-setting="deposit" value="${settings.deposit}"></label><label>Minimum de convives<input type="number" data-setting="defaultMinimum" value="${settings.defaultMinimum}"></label><label>Solde à J-<input type="number" data-setting="balanceDueDays" value="${settings.balanceDueDays}"></label><label class="wide">Modes de paiement<input data-setting="paymentMethods" value="${escapeHtml(settings.paymentMethods)}"></label><label class="wide">URL Formspree<input data-setting="formspreeEndpoint" value="${escapeHtml(settings.formspreeEndpoint)}"></label><label class="wide">Conditions<textarea data-setting="terms">${escapeHtml(settings.terms)}</textarea></label></div></section></div>`;
}

export function productEditor(product, state, readOnly) {
  const categoryOptions = (state.categories || CATEGORIES).map((category) => `<option value="${category.id}" ${product.category === category.id ? "selected" : ""}>${category.label}</option>`).join("");
  const tagChecks = (state.tags || TAGS).map((tag) => `<label><input type="checkbox" name="tags" value="${tag.id}" ${product.tags?.includes(tag.id) ? "checked" : ""}>${tag.label}</label>`).join("");
  const disabled = readOnly ? "disabled" : "";
  return `<div class="editor-backdrop show"><section class="product-editor" role="dialog" aria-modal="true"><header><div><span class="eyebrow">FICHE RECETTE</span><h2>${escapeHtml(product.name)}</h2></div><div><button class="button light" data-print-product="${product.id}">Télécharger la fiche</button><button class="icon-button" data-close-editor>×</button></div></header><div class="editor-tabs"><button data-editor-tab="identity" class="active">Identité</button><button data-editor-tab="technical">Fiche technique</button><button data-editor-tab="costs">Coûts & vente</button></div><form data-product-form><input type="hidden" name="id" value="${escapeHtml(product.id)}">
    <section data-editor-panel="identity"><div class="product-editor-grid"><div class="editor-photo">${productImage(product)}</div><div class="editor-fields"><label>Nom<input name="name" value="${escapeHtml(product.name)}" ${disabled}></label><label>Catégorie<select name="category" ${disabled}>${categoryOptions}</select></label><label class="wide">Description client<textarea name="description" ${disabled}>${escapeHtml(product.description)}</textarea></label><label>Pays<input name="country" value="${escapeHtml(product.country)}" ${disabled}></label><label>Gamme<select name="range" ${disabled}>${Object.entries(RANGE_LABELS).map(([id,label])=>`<option value="${id}" ${product.range===id?"selected":""}>${label}</option>`).join("")}</select></label><label>Animal<select name="animal" ${disabled}>${Object.entries(ANIMALS).map(([id,label])=>`<option value="${id}" ${product.animal===id?"selected":""}>${label}</option>`).join("")}</select></label><label>Genre<select name="genre" ${disabled}>${Object.entries(GENRES).map(([id,label])=>`<option value="${id}" ${product.genre===id?"selected":""}>${label}</option>`).join("")}</select></label><label><input type="checkbox" name="published" ${product.published ? "checked" : ""} ${disabled}> Visible au public</label><label><input type="checkbox" name="quickAdd" ${product.quickAdd?.enabled ? "checked" : ""} ${disabled}> Ajout rapide</label><div class="wide tag-checkboxes">${tagChecks}</div></div></div></section>
    <section data-editor-panel="technical" hidden><div class="technical-summary"><div><span>Rendement</span><b>${product.yield || 1} ${escapeHtml(product.yieldUnit)}</b></div><div><span>Coût estimé</span><b>${money(productFullCost(product,state.settings.hourlyCost))}</b></div><div><span>Mise en place</span><b>${product.fixedMinutes || 0} min</b></div></div><div class="editor-fields"><label>Rendement<input type="number" step=".1" name="yield" value="${product.yield}" ${disabled}></label><label>Unité<input name="yieldUnit" value="${escapeHtml(product.yieldUnit)}" ${disabled}></label><label class="wide">Ingrédients <small>Une ligne : produit | quantité | unité</small><textarea class="technical-large" name="ingredients" ${disabled}>${escapeHtml(product.ingredients)}</textarea></label><label class="wide">Étapes <small>Une étape par ligne</small><textarea class="technical-large" name="steps" ${disabled}>${escapeHtml(product.steps)}</textarea></label><label>Matériel<textarea name="equipment" ${disabled}>${escapeHtml(product.equipment)}</textarea></label><label>Allergènes<textarea name="allergens" ${disabled}>${escapeHtml(product.allergens)}</textarea></label><label>Conservation<textarea name="storage" ${disabled}>${escapeHtml(product.storage)}</textarea></label><label>Dressage & service<textarea name="service" ${disabled}>${escapeHtml(product.service)}</textarea></label><label class="wide">Notes techniques<textarea name="technicalNotes" ${disabled}>${escapeHtml(Array.isArray(product.technicalNotes)?product.technicalNotes.join("\n"):product.technicalNotes)}</textarea></label></div></section>
    <section data-editor-panel="costs" hidden><div class="cost-dashboard"><div><span>Matière</span><b>${money(product.costUnit)}</b></div><div><span>Coût complet</span><b>${money(productFullCost(product,state.settings.hourlyCost))}</b></div><div><span>Prix conseillé</span><b>${money(suggestedSale(product,state.settings.hourlyCost))}</b></div></div><div class="editor-fields"><label>Coût matière<input type="number" step=".01" name="costUnit" value="${product.costUnit}" ${disabled}></label><label>Base quantité<input type="number" step=".1" name="costBasisQty" value="${product.costBasisQty}" ${disabled}></label><label>Base unité<input name="costBasisUnit" value="${escapeHtml(product.costBasisUnit)}" ${disabled}></label><label>Emballage / unité<input type="number" step=".01" name="packCostUnit" value="${product.packCostUnit}" ${disabled}></label><label>Temps fixe (min)<input type="number" name="fixedMinutes" value="${product.fixedMinutes}" ${disabled}></label><label>Temps variable / unité<input type="number" step=".1" name="prepMinutesUnit" value="${product.prepMinutesUnit}" ${disabled}></label><label>Marge cible (%)<input type="number" name="targetMargin" value="${product.targetMargin}" ${disabled}></label><label>Prix ajout rapide<input type="number" step=".5" name="quickPrice" value="${product.quickAdd?.price || 0}" ${disabled}></label></div></section>
      ${readOnly ? "" : '<footer><button type="button" class="button danger" data-delete-product>Supprimer</button><div><button type="button" class="button light" data-close-editor>Annuler</button><button type="submit" class="button gold">Enregistrer</button></div></footer>'}
    </form></section></div>`;
}

export function loginDialog(message = "") {
  return `<div class="editor-backdrop show"><section class="login-card" role="dialog" aria-modal="true"><button class="icon-button" data-close-login>×</button><img src="./mil-logo.webp" alt="MiL"><span class="eyebrow">ACCÈS PROPRIÉTAIRE</span><h2>Connexion à l’atelier</h2><p>Utilisez votre compte Supabase. Les modifications seront enregistrées et visibles sur tous vos appareils.</p><form data-login-form><label>E-mail<input required type="email" name="email" autocomplete="email"></label><label>Mot de passe<input required minlength="8" type="password" name="password" autocomplete="current-password"></label>${message ? `<div class="form-error">${escapeHtml(message)}</div>` : ""}<button class="button gold" type="submit">Se connecter</button><button class="text-button" type="button" data-signup>Créer mon accès</button></form></section></div>`;
}
