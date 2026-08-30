import { auth, loadPrivateState, loadPublicCatalog, loadOrders, saveState, updateOrderStatus } from "./api.js?v=20260830-3";
import { createProduct, normalizeState, stateFromPublicInput, toPublicInput } from "./model.js?v=20260830-3";
import * as ui from "./ui.js?v=20260830-3";

const root = document.querySelector("#app");
let fallbackInput;
let state;
let view = "dashboard";
let readOnly = true;
let syncStatus = "saved";
let selectedFormulaId = "";
let formulaMode = "ready";
let editorProductId = null;
let catalogueFilters = {};
let loginOpen = false;
let loginMessage = "";
let saveTimer;

async function boot() {
  fallbackInput = await fetch("./questionnaire/default-input.json").then((response) => response.json());
  state = stateFromPublicInput(fallbackInput);
  try {
    const publicRow = await loadPublicCatalog();
    if (publicRow?.payload) state = normalizeState(publicRow.payload, fallbackInput);
  } catch { /* La base intégrée reste disponible hors ligne. */ }
  selectedFormulaId = state.formulas[0]?.id || "";
  render();
  if (auth.session()?.access_token) await enterPrivateMode();
}

async function enterPrivateMode() {
  try {
    const [privateRow, orders] = await Promise.all([loadPrivateState(), loadOrders()]);
    state = normalizeState(privateRow?.payload, fallbackInput);
    state.orders = orders || [];
    ensureQuoteDraft();
    readOnly = false;
    loginOpen = false;
    syncStatus = "saved";
    selectedFormulaId ||= state.formulas[0]?.id || "";
    render();
  } catch (error) {
    auth.signOut();
    readOnly = true;
    loginOpen = true;
    loginMessage = error.message;
    render();
  }
}

function ensureQuoteDraft() {
  if (!state.quoteDraft) state.quoteDraft = { client:{ name:"",email:"",date:"",location:"" }, guests:20, mode:"ready", formulaId:state.formulas[0]?.id || "", addons:{}, custom:{}, manual:[], notes:"" };
  state.quoteDraft.client ||= {};
  state.quoteDraft.addons ||= {};
  state.quoteDraft.custom ||= {};
  state.quoteDraft.manual ||= [];
  return state.quoteDraft;
}

function printDocument(title, body) {
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${ui.escapeHtml(title)}</title><style>body{font:14px Arial;color:#171915;margin:36px}h1{font-size:28px}h2{margin-top:26px;border-bottom:1px solid #bbb;padding-bottom:6px}table{width:100%;border-collapse:collapse}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:22px;font-weight:bold}.muted{color:#666}@media print{button{display:none}}</style></head><body>${body}<script>print()<\/script></body></html>`);
  popup.document.close();
}

function technicalSheet(product) {
  const ingredients = String(product.ingredients || "").split("\n").filter(Boolean).map(line => `<tr><td>${ui.escapeHtml(line.split("|")[0])}</td><td>${ui.escapeHtml(line.split("|").slice(1).join(" · "))}</td></tr>`).join("");
  const steps = String(product.steps || "").split("\n").filter(Boolean).map((line,i)=>`<li>${ui.escapeHtml(line.replace(/^\d+[.)-]?\s*/, ""))}</li>`).join("");
  return `<article><h1>${ui.escapeHtml(product.name)}</h1><p class="muted">Rendement : ${product.yield || 1} ${ui.escapeHtml(product.yieldUnit || "")}</p><h2>Ingrédients</h2><table>${ingredients || "<tr><td>À compléter</td></tr>"}</table><h2>Méthode</h2><ol>${steps || "<li>À compléter</li>"}</ol><h2>Matériel</h2><p>${ui.escapeHtml(product.equipment || "À compléter")}</p><h2>Conservation</h2><p>${ui.escapeHtml(product.storage || "À compléter")}</p><h2>Dressage & service</h2><p>${ui.escapeHtml(product.service || "À compléter")}</p><h2>Allergènes</h2><p>${ui.escapeHtml(product.allergens || "Aucun renseigné")}</p></article>`;
}

function quoteDocument(production = false) {
  const draft = ensureQuoteDraft(), totals = ui.quoteTotals(state,draft);
  const formula = state.formulas.find(f=>f.id===draft.formulaId);
  const addonRows = Object.entries(draft.addons).filter(([,q])=>q>0).map(([id,q])=>{const p=state.products.find(x=>x.id===id);return `<tr><td>${ui.escapeHtml(p?.name||id)}</td><td>${q}</td><td>${ui.money(ui.suggestedSale(p||{},state.settings.hourlyCost))}</td></tr>`;}).join("");
  if (production) {
    const ids = new Set(Object.entries(draft.addons).filter(([,q])=>q>0).map(([id])=>id));
    formula?.rules.forEach(r=>Object.entries(r.products||{}).forEach(([id,c])=>{if(draft.mode==="ready"?c.preset:draft.custom[id])ids.add(id);}));
    printDocument("Dossier de production", `<h1>Dossier de production</h1><p>${ui.escapeHtml(draft.client.name||"Client")} · ${draft.guests} convives · ${ui.escapeHtml(draft.client.date||"date à confirmer")}</p>${[...ids].map(id=>technicalSheet(state.products.find(p=>p.id===id)||{})).join('<div style="page-break-before:always"></div>')}`); return;
  }
  printDocument("Devis MiL", `<h1>DEVIS — MiL Chef privé</h1><p>${ui.escapeHtml(draft.client.name||"Client")}<br>${ui.escapeHtml(draft.client.email||"")}<br>${ui.escapeHtml(draft.client.date||"")} · ${ui.escapeHtml(draft.client.location||"")}</p><h2>Prestation</h2><table><tr><th>Désignation</th><th>Quantité</th><th>Prix</th></tr><tr><td>${ui.escapeHtml(formula?.name||"Formule")}</td><td>${draft.guests} pers.</td><td>${ui.money(totals.formula)}</td></tr>${addonRows}${draft.manual.map(l=>`<tr><td>${ui.escapeHtml(l.label)}</td><td>${l.qty}</td><td>${ui.money((l.qty||0)*(l.price||0))}</td></tr>`).join("")}</table><p>Total HT : ${ui.money(totals.ht)}<br>TVA : ${ui.money(totals.vat)}</p><p class="total">Total TTC : ${ui.money(totals.ttc)}</p><p>Acompte : ${ui.money(totals.deposit)}</p><p>${ui.escapeHtml(draft.notes||"")}</p>`);
}

function page() {
  if (view === "catalogue") return ui.catalogue(state, readOnly, catalogueFilters);
  if (view === "formulas") return ui.formulas(state, readOnly, selectedFormulaId, formulaMode);
  if (view === "addons") return ui.addons(state, readOnly);
  if (view === "orders") return ui.orders(state, readOnly);
  if (view === "documents") return ui.documents(state);
  if (view === "settings" && !readOnly) return ui.settings(state);
  return ui.dashboard(state, readOnly);
}

function render() {
  root.innerHTML = ui.shell(state, view, readOnly, syncStatus, page());
  if (editorProductId) {
    const product = state.products.find((item) => item.id === editorProductId);
    if (product) root.insertAdjacentHTML("beforeend", ui.productEditor(product, state, readOnly));
  }
  if (loginOpen) root.insertAdjacentHTML("beforeend", ui.loginDialog(loginMessage));
}

function setSyncStatus(status) {
  syncStatus = status;
  const node = root.querySelector(".sync-state");
  if (node && !readOnly) {
    node.className = `sync-state ${status}`;
    node.innerHTML = `<i></i>${status === "saving" ? "Sauvegarde…" : status === "error" ? "Hors ligne" : "Synchronisé"}`;
  }
}

function changed(rerender = false) {
  if (readOnly) return;
  state.updatedAt = new Date().toISOString();
  setSyncStatus("saving");
  if (rerender) render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveState(state, toPublicInput(state));
      setSyncStatus("saved");
    } catch {
      setSyncStatus("error");
    }
  }, 700);
}

root.addEventListener("click", async (event) => {
  const target = event.target.closest("button,a");
  if (!target) return;
  if (target.dataset.view) { event.preventDefault(); view = target.dataset.view; window.scrollTo({ top: 0, behavior: "smooth" }); render(); return; }
  if (target.dataset.login !== undefined) { loginOpen = true; loginMessage = ""; render(); return; }
  if (target.dataset.closeLogin !== undefined) { loginOpen = false; render(); return; }
  if (target.dataset.signup !== undefined) {
    const form = root.querySelector("[data-login-form]");
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    try { await auth.signUp(data.email, data.password); loginMessage = "Compte créé. Confirmez l’e-mail reçu, puis reconnectez-vous."; }
    catch (error) { loginMessage = error.message; }
    render(); return;
  }
  if (target.dataset.editProduct) { editorProductId = target.dataset.editProduct; render(); return; }
  if (target.dataset.newProduct !== undefined) { const product = createProduct(); state.products.push(product); editorProductId = product.id; render(); return; }
  if (target.dataset.closeEditor !== undefined) { editorProductId = null; render(); return; }
  if (target.dataset.deleteProduct !== undefined && editorProductId && confirm("Supprimer définitivement cette recette ?")) {
    state.products = state.products.filter((product) => product.id !== editorProductId);
    state.formulas.forEach((formula) => formula.rules.forEach((rule) => { delete rule.products[editorProductId]; }));
    editorProductId = null; changed(true); return;
  }
  if (target.dataset.category !== undefined) { catalogueFilters.category = target.dataset.category; render(); return; }
  if (target.dataset.clearFilters !== undefined) { catalogueFilters = {}; render(); return; }
  if (target.dataset.formula) { selectedFormulaId = target.dataset.formula; render(); return; }
  if (target.dataset.mode) { formulaMode = target.dataset.mode; render(); return; }
  if (target.dataset.ruleStep) {
    const [category,delta] = target.dataset.ruleStep.split(":"); const formula=state.formulas.find(f=>f.id===selectedFormulaId); const rule=formula?.rules.find(r=>r.category===category);
    if (rule) { const key=formulaMode==="ready"?"readyChoices":"choices"; rule[key]=Math.max(1,(Number(rule[key])||1)+Number(delta)); changed(true); } return;
  }
  if (target.dataset.editorTab) {
    root.querySelectorAll("[data-editor-tab]").forEach(b=>b.classList.toggle("active",b===target));
    root.querySelectorAll("[data-editor-panel]").forEach(p=>p.hidden=p.dataset.editorPanel!==target.dataset.editorTab); return;
  }
  if (target.dataset.printProduct) { const p=state.products.find(x=>x.id===target.dataset.printProduct); if(p) printDocument(`Fiche technique — ${p.name}`,technicalSheet(p)); return; }
  if (target.dataset.printAllSheets !== undefined) { printDocument("Fiches techniques MiL",state.products.map((p,i)=>`${i?'<div style="page-break-before:always"></div>':""}${technicalSheet(p)}`).join("")); return; }
  if (target.dataset.quoteGuests) { const d=ensureQuoteDraft(); d.guests=Math.max(1,(Number(d.guests)||20)+Number(target.dataset.quoteGuests)); changed(true); return; }
  if (target.dataset.quoteMode) { ensureQuoteDraft().mode=target.dataset.quoteMode; changed(true); return; }
  if (target.dataset.quoteFormula) { ensureQuoteDraft().formulaId=target.dataset.quoteFormula; changed(true); return; }
  if (target.dataset.quoteAddon) { const [id,delta]=target.dataset.quoteAddon.split(":"); const d=ensureQuoteDraft(); d.addons[id]=Math.max(0,(Number(d.addons[id])||0)+Number(delta)); changed(true); return; }
  if (target.dataset.addManual !== undefined) { ensureQuoteDraft().manual.push({label:"",qty:1,price:0}); changed(true); return; }
  if (target.dataset.removeManual !== undefined) { ensureQuoteDraft().manual.splice(Number(target.dataset.removeManual),1); changed(true); return; }
  if (target.dataset.saveQuote !== undefined) { const d=structuredClone(ensureQuoteDraft()); d.id=`devis-${crypto.randomUUID()}`; d.createdAt=new Date().toISOString(); d.totals=ui.quoteTotals(state,d); state.quotes.unshift(d); changed(); root.querySelector(".toast").textContent="Devis enregistré"; root.querySelector(".toast").classList.add("show"); return; }
  if (target.dataset.printQuote !== undefined) { quoteDocument(false); return; }
  if (target.dataset.printProduction !== undefined) { quoteDocument(true); return; }
  if (target.dataset.scrollRequests !== undefined) { document.querySelector("#client-requests")?.scrollIntoView({behavior:"smooth"}); return; }
  if (target.dataset.useOrder) { const order=state.orders.find(o=>(o.id||o.payload?.id)===target.dataset.useOrder), payload=order?.payload||order; const d=ensureQuoteDraft(); d.client={...(payload?.client||{})}; d.guests=payload?.snapshot?.guests||20; d.formulaId=payload?.snapshot?.formulaId||d.formulaId; d.mode=payload?.snapshot?.mode||"ready"; changed(true); return; }
  if (target.dataset.logout !== undefined) { auth.signOut(); location.reload(); return; }
  if (target.dataset.exportState !== undefined) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "Sauvegarde_Atelier_MiL.json"; link.click(); URL.revokeObjectURL(link.href); return;
  }
  if (target.dataset.printFormulas !== undefined) { window.print(); }
});

root.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (event.target.matches("[data-login-form]")) {
    const data = Object.fromEntries(new FormData(event.target));
    try { await auth.signIn(data.email, data.password); await enterPrivateMode(); }
    catch (error) { loginMessage = error.message; render(); }
    return;
  }
  if (event.target.matches("[data-product-form]") && editorProductId) {
    const product = state.products.find((item) => item.id === editorProductId);
    const data = new FormData(event.target);
    product.name = data.get("name"); product.category = data.get("category"); product.description = data.get("description");
    product.country = data.get("country"); product.range = data.get("range"); product.animal=data.get("animal"); product.genre=data.get("genre"); product.published = data.has("published");
    product.quickAdd.enabled = data.has("quickAdd"); product.costUnit = Number(data.get("costUnit"));
    product.prepMinutesUnit = Number(data.get("prepMinutesUnit")); product.fixedMinutes = Number(data.get("fixedMinutes"));
    product.packCostUnit = Number(data.get("packCostUnit")); product.costBasisQty=Number(data.get("costBasisQty")); product.costBasisUnit=data.get("costBasisUnit"); product.targetMargin=Number(data.get("targetMargin")); product.quickAdd.price=Number(data.get("quickPrice")); product.yield=Number(data.get("yield")); product.yieldUnit=data.get("yieldUnit"); product.ingredients = data.get("ingredients"); product.steps = data.get("steps");
    product.equipment = data.get("equipment"); product.storage = data.get("storage"); product.service = data.get("service");
    product.allergens = data.get("allergens"); product.technicalNotes=String(data.get("technicalNotes")||"").split("\n").filter(Boolean); product.tags = data.getAll("tags"); product.updatedAt = new Date().toISOString();
    editorProductId = null; changed(true);
  }
});

root.addEventListener("input", (event) => {
  if (event.target.matches("[data-filter-search]")) {
    catalogueFilters.search = event.target.value;
    render();
    const search = root.querySelector("[data-filter-search]");
    search?.focus();
    search?.setSelectionRange(search.value.length, search.value.length);
    return;
  }
  if (event.target.dataset.formulaField) {
    const formula = state.formulas.find((item) => item.id === selectedFormulaId); if (!formula) return;
    const presentation = formula.presentations[formulaMode]; const field = event.target.dataset.formulaField;
    presentation[field] = field === "pricePerGuest" ? Number(event.target.value) : event.target.value; changed(); return;
  }
  if (event.target.dataset.formulaRoot) { const formula=state.formulas.find(f=>f.id===selectedFormulaId); if(formula){const key=event.target.dataset.formulaRoot;formula[key]=event.target.type==="number"?Number(event.target.value):event.target.value;changed();} return; }
  if (event.target.dataset.quoteClient) { ensureQuoteDraft().client[event.target.dataset.quoteClient]=event.target.value; changed(); return; }
  if (event.target.dataset.quoteNotes !== undefined) { ensureQuoteDraft().notes=event.target.value; changed(); return; }
  if (event.target.dataset.manualField) { const [index,key]=event.target.dataset.manualField.split(":"); ensureQuoteDraft().manual[Number(index)][key]=event.target.type==="number"?Number(event.target.value):event.target.value; changed(); return; }
  if (event.target.dataset.quoteSearch !== undefined) { const value=event.target.value.toLowerCase(); root.querySelectorAll("[data-addon-name]").forEach(line=>line.hidden=!line.dataset.addonName.includes(value)); return; }
  if (event.target.dataset.setting) { const key = event.target.dataset.setting; state.settings[key] = event.target.type === "number" ? Number(event.target.value) : event.target.value; changed(); }
});

root.addEventListener("change", async (event) => {
  if (event.target.matches("[data-filter-visibility]")) { catalogueFilters.visibility = event.target.value; render(); return; }
  if (event.target.matches("[data-filter-tag]")) { catalogueFilters.tag = event.target.value; render(); return; }
  if (event.target.matches("[data-filter-animal]")) { catalogueFilters.animal = event.target.value; render(); return; }
  if (event.target.matches("[data-filter-range]")) { catalogueFilters.range = event.target.value; render(); return; }
  if (event.target.matches("[data-filter-sort]")) { catalogueFilters.sort = event.target.value; render(); return; }
  const formula = state.formulas.find((item) => item.id === selectedFormulaId);
  if (formula && event.target.dataset.ruleEnabled) { formula.rules.find((rule) => rule.category === event.target.dataset.ruleEnabled).enabled = event.target.checked; changed(); return; }
  if (formula && event.target.dataset.ruleChoices) { const rule = formula.rules.find((item) => item.category === event.target.dataset.ruleChoices); rule[formulaMode === "ready" ? "readyChoices" : "choices"] = Math.max(1, Number(event.target.value)); changed(); return; }
  if (formula && event.target.dataset.ruleProduct) {
    const [category, id] = event.target.dataset.ruleProduct.split(":"); const config = formula.rules.find((rule) => rule.category === category).products[id];
    if (formulaMode === "ready") config.preset = event.target.checked; else config.enabled = event.target.checked; changed(); return;
  }
  if (event.target.dataset.quoteCustom) { const [,id]=event.target.dataset.quoteCustom.split(":"); ensureQuoteDraft().custom[id]=event.target.checked; changed(); return; }
  if (event.target.dataset.orderStatus) {
    try { await updateOrderStatus(event.target.dataset.orderStatus, event.target.value); const order = state.orders.find((item) => item.id === event.target.dataset.orderStatus); if (order) order.status = event.target.value; }
    catch { /* Le statut reste inchangé au prochain chargement. */ }
  }
});

boot();
