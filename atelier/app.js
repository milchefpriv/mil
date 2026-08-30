import { auth, loadPrivateState, loadPublicCatalog, loadOrders, saveState, updateOrderStatus } from "./api.js?v=20260830-2";
import { createProduct, normalizeState, stateFromPublicInput, toPublicInput } from "./model.js?v=20260830-2";
import * as ui from "./ui.js?v=20260830-2";

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
    product.country = data.get("country"); product.range = data.get("range"); product.published = data.has("published");
    product.quickAdd.enabled = data.has("quickAdd"); product.costUnit = Number(data.get("costUnit"));
    product.prepMinutesUnit = Number(data.get("prepMinutesUnit")); product.fixedMinutes = Number(data.get("fixedMinutes"));
    product.packCostUnit = Number(data.get("packCostUnit")); product.ingredients = data.get("ingredients"); product.steps = data.get("steps");
    product.equipment = data.get("equipment"); product.storage = data.get("storage"); product.service = data.get("service");
    product.allergens = data.get("allergens"); product.tags = data.getAll("tags"); product.updatedAt = new Date().toISOString();
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
  if (event.target.dataset.setting) { const key = event.target.dataset.setting; state.settings[key] = event.target.type === "number" ? Number(event.target.value) : event.target.value; changed(); }
});

root.addEventListener("change", async (event) => {
  if (event.target.matches("[data-filter-visibility]")) { catalogueFilters.visibility = event.target.value; render(); return; }
  if (event.target.matches("[data-filter-tag]")) { catalogueFilters.tag = event.target.value; render(); return; }
  const formula = state.formulas.find((item) => item.id === selectedFormulaId);
  if (formula && event.target.dataset.ruleEnabled) { formula.rules.find((rule) => rule.category === event.target.dataset.ruleEnabled).enabled = event.target.checked; changed(); return; }
  if (formula && event.target.dataset.ruleChoices) { const rule = formula.rules.find((item) => item.category === event.target.dataset.ruleChoices); rule[formulaMode === "ready" ? "readyChoices" : "choices"] = Math.max(1, Number(event.target.value)); changed(); return; }
  if (formula && event.target.dataset.ruleProduct) {
    const [category, id] = event.target.dataset.ruleProduct.split(":"); const config = formula.rules.find((rule) => rule.category === category).products[id];
    if (formulaMode === "ready") config.preset = event.target.checked; else config.enabled = event.target.checked; changed(); return;
  }
  if (event.target.dataset.orderStatus) {
    try { await updateOrderStatus(event.target.dataset.orderStatus, event.target.value); const order = state.orders.find((item) => item.id === event.target.dataset.orderStatus); if (order) order.status = event.target.value; }
    catch { /* Le statut reste inchangé au prochain chargement. */ }
  }
});

boot();
