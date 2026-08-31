"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DRINK_CATEGORIES,
  INITIAL_DRINK_THRESHOLDS,
  INITIAL_DRINKS,
  type Drink,
  type DrinkCategory,
  type DrinkThresholds,
} from "./bar-data";
import {
  isNonEmptyPayload,
  loadSharedState,
  saveSharedState,
  subscribeToSharedState,
  type SharedPayload,
} from "./shared-state";

type BarView = "dashboard" | "drinks" | "settings";
type DrinkStatus = "Bon" | "À surveiller" | "À négocier" | "À compléter";

type CalculatedDrink = Drink & {
  costTotalHt: number;
  salePriceHt: number;
  coefficient: number;
  grossMarginHt: number;
  markRate: number;
  materialRatio: number;
  targetPurchasePriceHt: number;
  purchaseGap: number;
  status: DrinkStatus;
};

const DRINKS_STORAGE_KEY = "auguste-bar-drinks-v1";
const THRESHOLDS_STORAGE_KEY = "auguste-bar-thresholds-v1";
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 1 });

const EMPTY_DRINK: Omit<Drink, "id"> = {
  category: "Eaux minérales",
  name: "",
  format: "",
  supplier: "",
  purchasePriceHt: null,
  extrasHt: 0,
  salePriceTtc: 0,
  notes: "",
};

function calculateDrink(drink: Drink, thresholds: DrinkThresholds): CalculatedDrink {
  const rule = thresholds[drink.category];
  const purchaseKnown = typeof drink.purchasePriceHt === "number" && Number.isFinite(drink.purchasePriceHt);
  const purchasePriceHt = purchaseKnown ? Math.max(0, drink.purchasePriceHt || 0) : 0;
  const extrasHt = Math.max(0, drink.extrasHt || 0);
  const salePriceTtc = Math.max(0, drink.salePriceTtc || 0);
  const costTotalHt = purchasePriceHt + extrasHt;
  const salePriceHt = salePriceTtc > 0 ? salePriceTtc / (1 + rule.vat) : 0;
  const coefficient = costTotalHt > 0 ? salePriceHt / costTotalHt : 0;
  const grossMarginHt = salePriceHt - costTotalHt;
  const markRate = salePriceHt > 0 ? grossMarginHt / salePriceHt : 0;
  const materialRatio = salePriceHt > 0 ? costTotalHt / salePriceHt : 0;
  const targetPurchasePriceHt = Math.max(0, salePriceHt * rule.targetRatio - extrasHt);
  const purchaseGap = purchasePriceHt - targetPurchasePriceHt;
  let status: DrinkStatus = "À compléter";
  if (purchaseKnown && salePriceTtc > 0) {
    status = materialRatio <= rule.targetRatio ? "Bon" : materialRatio <= rule.maximumRatio ? "À surveiller" : "À négocier";
  }
  return { ...drink, costTotalHt, salePriceHt, coefficient, grossMarginHt, markRate, materialRatio, targetPurchasePriceHt, purchaseGap, status };
}

function statusClass(status: DrinkStatus) {
  if (status === "Bon") return "good";
  if (status === "À surveiller") return "watch";
  if (status === "À négocier") return "negotiate";
  return "missing";
}

function numericInputValue(value: number | null) {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

export default function BarPilotage({ userId }: { userId: string }) {
  const [view, setView] = useState<BarView>("dashboard");
  const [drinks, setDrinks] = useState<Drink[]>(INITIAL_DRINKS);
  const [thresholds, setThresholds] = useState<DrinkThresholds>(INITIAL_DRINK_THRESHOLDS);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DrinkCategory | "Toutes">("Toutes");
  const [addOpen, setAddOpen] = useState(false);
  const [newDrink, setNewDrink] = useState<Omit<Drink, "id">>(EMPTY_DRINK);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "offline">("loading");
  const applyingRemoteStateRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    function readLocalState(): SharedPayload {
      try {
        const localDrinks = JSON.parse(window.localStorage.getItem(DRINKS_STORAGE_KEY) || "null");
        const localThresholds = JSON.parse(window.localStorage.getItem(THRESHOLDS_STORAGE_KEY) || "null");
        return {
          version: 1,
          drinks: Array.isArray(localDrinks) ? localDrinks : INITIAL_DRINKS,
          thresholds: localThresholds && typeof localThresholds === "object" ? { ...INITIAL_DRINK_THRESHOLDS, ...localThresholds } : INITIAL_DRINK_THRESHOLDS,
        };
      } catch {
        return { version: 1, drinks: INITIAL_DRINKS, thresholds: INITIAL_DRINK_THRESHOLDS };
      }
    }

    function applyPayload(payload: SharedPayload) {
      if (Array.isArray(payload.drinks)) setDrinks(payload.drinks as Drink[]);
      if (payload.thresholds && typeof payload.thresholds === "object" && !Array.isArray(payload.thresholds)) {
        setThresholds({ ...INITIAL_DRINK_THRESHOLDS, ...(payload.thresholds as Partial<DrinkThresholds>) });
      }
    }

    async function initializeSharedState() {
      const localState = readLocalState();
      try {
        const remoteRow = await loadSharedState("bar");
        if (!active) return;
        if (remoteRow && isNonEmptyPayload(remoteRow.payload) && Array.isArray(remoteRow.payload.drinks)) {
          applyingRemoteStateRef.current = true;
          applyPayload(remoteRow.payload);
        } else {
          applyPayload(localState);
          await saveSharedState("bar", localState, userId);
        }
        if (!active) return;
        setReady(true);
        setSyncStatus("synced");
        window.requestAnimationFrame(() => { applyingRemoteStateRef.current = false; });
        unsubscribe = subscribeToSharedState("bar", (row) => {
          if (!active || row.updated_by === userId || !isNonEmptyPayload(row.payload)) return;
          applyingRemoteStateRef.current = true;
          applyPayload(row.payload);
          setSyncStatus("synced");
          window.requestAnimationFrame(() => { applyingRemoteStateRef.current = false; });
        }, (status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") setSyncStatus("synced");
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setSyncStatus("offline");
        });
      } catch (error) {
        console.warn("La synchronisation bar est momentanément indisponible.", error);
        if (!active) return;
        applyPayload(localState);
        setReady(true);
        setSyncStatus("offline");
      }
    }

    void initializeSharedState();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(DRINKS_STORAGE_KEY, JSON.stringify(drinks));
    window.localStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(thresholds));
    if (applyingRemoteStateRef.current) return;
    setSyncStatus("saving");
    const timeout = window.setTimeout(() => {
      void saveSharedState("bar", { version: 1, drinks, thresholds }, userId)
        .then(() => setSyncStatus("synced"))
        .catch((error) => {
          console.warn("Les données bar restent enregistrées sur cet appareil en attendant la connexion.", error);
          setSyncStatus("offline");
        });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [drinks, thresholds, ready, userId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const calculated = useMemo(() => drinks.map((drink) => calculateDrink(drink, thresholds)), [drinks, thresholds]);
  const completed = calculated.filter((drink) => drink.status !== "À compléter");
  const missing = calculated.filter((drink) => drink.status === "À compléter");
  const negotiate = calculated.filter((drink) => drink.status === "À négocier");
  const watch = calculated.filter((drink) => drink.status === "À surveiller");
  const averageRatio = completed.length ? completed.reduce((sum, drink) => sum + drink.materialRatio, 0) / completed.length : 0;

  const categorySummary = DRINK_CATEGORIES.map((category) => {
    const items = completed.filter((drink) => drink.category === category);
    const allItems = calculated.filter((drink) => drink.category === category);
    return {
      category,
      count: allItems.length,
      averageRatio: items.length ? items.reduce((sum, drink) => sum + drink.materialRatio, 0) / items.length : 0,
      averageCoefficient: items.length ? items.reduce((sum, drink) => sum + drink.coefficient, 0) / items.length : 0,
      negotiate: allItems.filter((drink) => drink.status === "À négocier").length,
    };
  });

  const filteredDrinks = calculated.filter((drink) => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    const haystack = `${drink.name} ${drink.format} ${drink.supplier} ${drink.category}`.toLocaleLowerCase("fr");
    return (!normalized || haystack.includes(normalized)) && (categoryFilter === "Toutes" || drink.category === categoryFilter);
  });

  function updateDrink(id: string, patch: Partial<Drink>) {
    setDrinks((current) => current.map((drink) => drink.id === id ? { ...drink, ...patch } : drink));
  }

  function updateNumber(id: string, field: "purchasePriceHt" | "extrasHt" | "salePriceTtc", rawValue: string) {
    const value = rawValue === "" && field === "purchasePriceHt" ? null : Math.max(0, Number(rawValue) || 0);
    updateDrink(id, { [field]: value });
  }

  function addDrink() {
    if (!newDrink.name.trim() || !newDrink.format.trim()) { setNotice("Ajoutez au minimum le nom et le format vendu."); return; }
    const drink: Drink = { ...newDrink, id: `bar-${Date.now()}` };
    setDrinks((current) => [drink, ...current]);
    setNewDrink(EMPTY_DRINK);
    setAddOpen(false);
    setCategoryFilter(drink.category);
    setView("drinks");
    setNotice("La nouvelle référence a été ajoutée.");
  }

  function deleteDrink(drink: Drink) {
    if (!window.confirm(`Supprimer « ${drink.name} — ${drink.format} » du pilotage bar ?`)) return;
    setDrinks((current) => current.filter((item) => item.id !== drink.id));
    setNotice("La référence a été supprimée.");
  }

  function restoreInitialBarData() {
    if (!window.confirm("Restaurer les boissons et seuils d’origine ? Toutes les modifications bar enregistrées sur cet appareil seront effacées.")) return;
    setDrinks(INITIAL_DRINKS);
    setThresholds(INITIAL_DRINK_THRESHOLDS);
    setNotice("Les données boissons d’origine ont été restaurées.");
  }

  return (
    <section className="bar-pilotage">
      <div className="bar-hero">
        <div><p className="eyebrow">Pilotage bar</p><h2>Rentabilité des boissons</h2><p>Prix d’achat, compléments, marge et alertes — calculés depuis les règles du fichier Chez Auguste.</p><small className={`bar-sync-status ${syncStatus}`}>{syncStatus === "loading" ? "Connexion…" : syncStatus === "saving" ? "Sauvegarde…" : syncStatus === "synced" ? "● Synchronisé en direct" : "Hors ligne — sauvegardé ici"}</small></div>
        <button className="bar-add-button" type="button" onClick={() => setAddOpen(true)}><span>+</span> Nouvelle référence</button>
      </div>

      <nav className="bar-view-tabs" aria-label="Sections du pilotage bar">
        <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><span>01</span><strong>Tableau de bord</strong><small>Ratios & alertes</small></button>
        <button type="button" className={view === "drinks" ? "active" : ""} onClick={() => setView("drinks")}><span>02</span><strong>Boissons</strong><small>{drinks.length} références</small></button>
        <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><span>03</span><strong>Paramètres</strong><small>TVA & objectifs</small></button>
      </nav>

      {view === "dashboard" && <div className="bar-dashboard">
        <div className="bar-kpis">
          <article><span>Références renseignées</span><strong>{drinks.length}</strong><small>{DRINK_CATEGORIES.filter((category) => drinks.some((drink) => drink.category === category)).length} familles actives</small></article>
          <article className={missing.length ? "warning" : ""}><span>PA HT à compléter</span><strong>{missing.length}</strong><small>{missing.length ? "Action nécessaire" : "Tout est renseigné"}</small></article>
          <article><span>Ratio coût moyen</span><strong>{percent.format(averageRatio)}</strong><small>Boisson + compléments</small></article>
          <article className={negotiate.length ? "danger" : ""}><span>Références à négocier</span><strong>{negotiate.length}</strong><small>{watch.length} à surveiller</small></article>
        </div>

        <div className="bar-dashboard-grid">
          <section className="bar-summary-panel">
            <div className="bar-section-heading"><div><p className="eyebrow">Vue par famille</p><h3>Où agir en priorité</h3></div><span>{completed.length} calculs complets</span></div>
            <div className="bar-category-table">
              <div className="bar-category-row head"><span>Famille</span><span>Réf.</span><span>Ratio</span><span>Coeff.</span><span>Alerte</span></div>
              {categorySummary.map((item) => <div className="bar-category-row" key={item.category}><strong>{item.category}</strong><span>{item.count}</span><span>{item.count ? percent.format(item.averageRatio) : "—"}</span><span>{item.count ? `${item.averageCoefficient.toFixed(2)} ×` : "—"}</span><span className={item.negotiate ? "category-alert" : ""}>{item.negotiate || "—"}</span></div>)}
            </div>
          </section>

          <section className="bar-alert-panel">
            <div className="bar-section-heading"><div><p className="eyebrow">Alertes automatiques</p><h3>À négocier</h3></div><span className={negotiate.length ? "alert-count active" : "alert-count"}>{negotiate.length}</span></div>
            {negotiate.length ? <div className="bar-alert-list">{negotiate.slice(0, 7).map((drink) => <button type="button" key={drink.id} onClick={() => { setQuery(drink.name); setCategoryFilter("Toutes"); setView("drinks"); }}><div><strong>{drink.name}</strong><small>{drink.format} · {drink.category}</small></div><span><b>{percent.format(drink.materialRatio)}</b><small>cible {percent.format(thresholds[drink.category].targetRatio)}</small></span></button>)}</div> : <div className="bar-empty-state"><span>✓</span><strong>Aucune négociation prioritaire</strong><p>Les références complètes respectent leurs seuils maximums.</p></div>}
            {missing.length > 0 && <button className="bar-missing-link" type="button" onClick={() => { setQuery(""); setCategoryFilter("Toutes"); setView("drinks"); }}>Compléter {missing.length} prix d’achat manquant{missing.length > 1 ? "s" : ""} →</button>}
          </section>
        </div>
      </div>}

      {view === "drinks" && <div className="bar-drinks-view">
        <div className="bar-drinks-toolbar">
          <label className="bar-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une boisson, un format…" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">×</button>}</label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as DrinkCategory | "Toutes")} aria-label="Filtrer par famille"><option>Toutes</option>{DRINK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
          <button type="button" className="bar-add-button compact" onClick={() => setAddOpen(true)}>+ Ajouter</button>
        </div>
        <div className="bar-results-line"><span>{filteredDrinks.length} référence{filteredDrinks.length > 1 ? "s" : ""}</span><small>Les valeurs saisies sont enregistrées automatiquement sur cet appareil.</small></div>
        <div className="drink-card-list">
          {filteredDrinks.map((drink) => <article className={`drink-card status-${statusClass(drink.status)}`} key={drink.id}>
            <div className="drink-card-heading"><div><span>{drink.category}</span><h3>{drink.name}</h3><p>{drink.format}{drink.supplier ? ` · ${drink.supplier}` : ""}</p></div><b className={`drink-status ${statusClass(drink.status)}`}>{drink.status}</b></div>
            <div className="drink-input-grid">
              <label><span>Fournisseur</span><input value={drink.supplier} onChange={(event) => updateDrink(drink.id, { supplier: event.target.value })} placeholder="À renseigner" /></label>
              <label><span>PA boisson HT</span><div><input type="number" min="0" step="0.0001" value={numericInputValue(drink.purchasePriceHt)} onChange={(event) => updateNumber(drink.id, "purchasePriceHt", event.target.value)} placeholder="—" /><b>€</b></div></label>
              <label><span>Compléments HT</span><div><input type="number" min="0" step="0.0001" value={numericInputValue(drink.extrasHt)} onChange={(event) => updateNumber(drink.id, "extrasHt", event.target.value)} /><b>€</b></div></label>
              <label><span>Prix vendu TTC</span><div><input type="number" min="0" step="0.1" value={numericInputValue(drink.salePriceTtc)} onChange={(event) => updateNumber(drink.id, "salePriceTtc", event.target.value)} /><b>€</b></div></label>
            </div>
            <div className="drink-calculations"><div><span>Coût total HT</span><strong>{euro.format(drink.costTotalHt)}</strong></div><div><span>Marge brute HT</span><strong>{euro.format(drink.grossMarginHt)}</strong></div><div><span>Coefficient</span><strong>{drink.coefficient ? `${drink.coefficient.toFixed(2)} ×` : "—"}</strong></div><div><span>Ratio matière</span><strong>{drink.salePriceHt ? percent.format(drink.materialRatio) : "—"}</strong></div></div>
            <details className="drink-detail"><summary>Voir le calcul et les notes</summary><div><p><span>Prix vendu HT</span><strong>{euro.format(drink.salePriceHt)}</strong></p><p><span>Taux de marque</span><strong>{drink.salePriceHt ? percent.format(drink.markRate) : "—"}</strong></p><p><span>PA cible fournisseur</span><strong>{drink.salePriceHt ? euro.format(drink.targetPurchasePriceHt) : "—"}</strong></p><p><span>Écart PA / cible</span><strong className={drink.purchaseGap > 0 ? "negative" : "positive"}>{drink.purchasePriceHt === null ? "—" : euro.format(drink.purchaseGap)}</strong></p><label><span>Notes</span><textarea value={drink.notes} onChange={(event) => updateDrink(drink.id, { notes: event.target.value })} placeholder="Conditionnement, pertes, accompagnement…" /></label><button type="button" onClick={() => deleteDrink(drink)}>Supprimer cette référence</button></div></details>
          </article>)}
          {!filteredDrinks.length && <div className="bar-empty-results"><strong>Aucune boisson ne correspond.</strong><button type="button" onClick={() => { setQuery(""); setCategoryFilter("Toutes"); }}>Effacer les filtres</button></div>}
        </div>
      </div>}

      {view === "settings" && <div className="bar-settings-view">
        <div className="bar-settings-intro"><div><p className="eyebrow">Seuils de rentabilité</p><h3>Paramètres par famille</h3><p>Bon jusqu’au ratio cible, à surveiller jusqu’au maximum, puis à négocier.</p></div><button type="button" onClick={restoreInitialBarData}>Restaurer les valeurs d’origine</button></div>
        <div className="threshold-list">{DRINK_CATEGORIES.map((category) => <article key={category}><h4>{category}</h4><div><label><span>TVA vente</span><div><input type="number" min="0" max="100" step="1" value={thresholds[category].vat * 100} onChange={(event) => setThresholds((current) => ({ ...current, [category]: { ...current[category], vat: Math.max(0, Number(event.target.value) || 0) / 100 } }))} /><b>%</b></div><small>{percent.format(thresholds[category].vat)}</small></label><label><span>Ratio cible</span><div><input type="number" min="0" max="100" step="1" value={thresholds[category].targetRatio * 100} onChange={(event) => setThresholds((current) => ({ ...current, [category]: { ...current[category], targetRatio: Math.max(0, Number(event.target.value) || 0) / 100 } }))} /><b>%</b></div><small>{percent.format(thresholds[category].targetRatio)}</small></label><label><span>Ratio maximum</span><div><input type="number" min="0" max="100" step="1" value={thresholds[category].maximumRatio * 100} onChange={(event) => setThresholds((current) => ({ ...current, [category]: { ...current[category], maximumRatio: Math.max(0, Number(event.target.value) || 0) / 100 } }))} /><b>%</b></div><small>{percent.format(thresholds[category].maximumRatio)}</small></label></div></article>)}</div>
        <div className="bar-formula-note"><strong>Calcul utilisé</strong><span>Ratio matière = (PA boisson HT + compléments HT) ÷ prix vendu HT. Le prix vendu HT est calculé depuis le prix TTC et la TVA de la famille.</span></div>
      </div>}

      {addOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAddOpen(false)}><section className="tool-modal bar-add-modal" role="dialog" aria-modal="true" aria-labelledby="bar-add-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setAddOpen(false)} aria-label="Fermer">×</button><p className="eyebrow">Pilotage bar</p><h2 id="bar-add-title">Nouvelle référence</h2><p className="tool-modal-intro">Renseignez les données du format réellement vendu. Les indicateurs se calculeront automatiquement.</p><div className="bar-add-form"><label><span>Famille</span><select value={newDrink.category} onChange={(event) => setNewDrink((current) => ({ ...current, category: event.target.value as DrinkCategory }))}>{DRINK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>Référence / produit *</span><input autoFocus value={newDrink.name} onChange={(event) => setNewDrink((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Bière blonde locale" /></label><label><span>Format vendu *</span><input value={newDrink.format} onChange={(event) => setNewDrink((current) => ({ ...current, format: event.target.value }))} placeholder="Ex. 33 cl" /></label><label><span>Fournisseur</span><input value={newDrink.supplier} onChange={(event) => setNewDrink((current) => ({ ...current, supplier: event.target.value }))} placeholder="Nom du fournisseur" /></label><label><span>PA boisson HT</span><input type="number" min="0" step="0.0001" value={numericInputValue(newDrink.purchasePriceHt)} onChange={(event) => setNewDrink((current) => ({ ...current, purchasePriceHt: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) }))} placeholder="0,00" /></label><label><span>Compléments HT</span><input type="number" min="0" step="0.0001" value={newDrink.extrasHt} onChange={(event) => setNewDrink((current) => ({ ...current, extrasHt: Math.max(0, Number(event.target.value) || 0) }))} /></label><label><span>Prix vendu TTC</span><input type="number" min="0" step="0.1" value={newDrink.salePriceTtc || ""} onChange={(event) => setNewDrink((current) => ({ ...current, salePriceTtc: Math.max(0, Number(event.target.value) || 0) }))} placeholder="0,00" /></label><label className="wide"><span>Notes</span><textarea value={newDrink.notes} onChange={(event) => setNewDrink((current) => ({ ...current, notes: event.target.value }))} placeholder="Pertes, citron, paille, sucre, conditionnement…" /></label><button className="primary-button wide" type="button" onClick={addDrink}>Ajouter au pilotage bar</button></div></section></div>}
      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
