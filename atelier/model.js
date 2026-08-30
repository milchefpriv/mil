export const CATEGORIES = [
  { id: "salades", label: "Salades", short: "Salades", color: "#6f8f3d" },
  { id: "sandwichs", label: "Sandwichs", short: "Sandwichs", color: "#876654" },
  { id: "verrines", label: "Verrines", short: "Verrines", color: "#4f8791" },
  { id: "bouchees", label: "Pièces cocktail", short: "Pièces", color: "#a66145" },
  { id: "plateaux", label: "Plateaux", short: "Plateaux", color: "#2f765c" },
  { id: "desserts", label: "Desserts", short: "Desserts", color: "#84558c" },
  { id: "plats-chauds", label: "Plats chauds", short: "Plats chauds", color: "#b45138" },
  { id: "live-cooking", label: "Live cooking", short: "Live", color: "#3d6796" },
];

export const TAGS = [
  ["vegetarian", "Végétarien"], ["vegan", "Vegan"], ["glutenfree", "Sans gluten"],
  ["lactosefree", "Sans lactose"], ["nutfree", "Sans fruits à coque"], ["hot", "Chaud"],
  ["cold", "Froid"], ["ambient", "Ambiant"], ["sharing", "À partager"],
  ["meat", "Viande"], ["fish", "Poisson"], ["shellfish", "Crustacés / mollusques"],
  ["luxury", "Signature"], ["live", "Live cooking"],
].map(([id, label]) => ({ id, label }));

const clone = (value) => structuredClone(value);
const now = () => new Date().toISOString();

function enrichProduct(product, index, addonIds = []) {
  const quick = addonIds.includes(product.id);
  return {
    description: "", tags: [], animal: "", country: "", genre: "cocktail", range: "decouverte",
    visualMode: product.photo ? "photo" : "category", visualTheme: "category", published: true,
    formulaEligible: true, costUnit: 0, costBasisQty: 1, costBasisUnit: "pièce",
    prepMinutesUnit: 0, fixedMinutes: 0, packCostUnit: 0, targetMargin: 0, yield: 1,
    yieldUnit: "pièce", ingredients: "", steps: "", equipment: "", storage: "",
    service: "", allergens: "", photo: "", photoPositionX: 50, photoPositionY: 50,
    photoZoom: 1, order: index, createdAt: now(), updatedAt: now(),
    quickAdd: { enabled: quick, mode: product.priceMode || "piece", price: product.price || 0, trayServes: product.trayServes || 6 },
    ...product,
  };
}

function enrichFormula(formula, index) {
  const rules = (formula.rules || []).map((rule) => ({
    category: rule.category,
    enabled: rule.enabled !== false,
    choices: Number(rule.choices) || 1,
    readyChoices: (rule.products || []).filter((item) => item.preset).length,
    optional: Boolean(rule.optional),
    products: Object.fromEntries((rule.products || []).map((item) => [item.id, {
      enabled: item.enabled !== false, preset: Boolean(item.preset), qty: Number(item.qty) || 0,
      unit: item.unit || "pièce", surcharge: Number(item.surcharge) || 0,
    }])),
  }));
  const presentations = formula.presentations || {
    ready: { name: formula.name, description: formula.description, price: formula.price },
    custom: { name: formula.name, description: formula.description, price: formula.price },
  };
  return {
    id: formula.id, name: formula.name, description: formula.description || "",
    pricePerGuest: Number(formula.pricePerGuest ?? formula.price) || 0,
    minimumGuests: Number(formula.minimumGuests ?? formula.minimum) || 20,
    serviceLevel: formula.serviceLevel || "none", readyEnabled: formula.readyEnabled !== false,
    customEnabled: formula.customEnabled !== false, recommended: Boolean(formula.recommended),
    active: formula.active !== false, order: formula.order ?? index,
    presentations: {
      ready: { ...presentations.ready, pricePerGuest: Number(presentations.ready?.pricePerGuest ?? presentations.ready?.price ?? formula.price) || 0 },
      custom: { ...presentations.custom, pricePerGuest: Number(presentations.custom?.pricePerGuest ?? presentations.custom?.price ?? formula.price) || 0 },
    },
    rules,
  };
}

export function stateFromPublicInput(input) {
  const publicProducts = (input.products || []).map((product, index) => enrichProduct(product, index, input.addonIds));
  return {
    version: 1,
    categories: input.categories || CATEGORIES,
    tags: input.tags || TAGS,
    products: publicProducts,
    formulas: (input.formulas || []).map(enrichFormula),
    orders: [],
    settings: {
      hourlyCost: 0, vat: Number(input.vat) || 10, deposit: Number(input.deposit) || 40,
      defaultMinimum: 20, balanceDueDays: 25,
      paymentMethods: input.paymentMethods || "Carte bancaire ou virement",
      formspreeEndpoint: input.endpoint || "", terms: input.terms || "",
    },
    updatedAt: now(),
  };
}

export function normalizeState(state, fallbackInput) {
  if (!state?.products || !state?.formulas) return stateFromPublicInput(fallbackInput);
  const base = stateFromPublicInput(fallbackInput);
  const products = state.products.map((product, index) => enrichProduct(product, index, fallbackInput.addonIds));
  const known = new Set(products.map((product) => product.id));
  base.products.forEach((product) => { if (!known.has(product.id)) products.push(product); });
  return {
    ...base, ...clone(state), products,
    formulas: state.formulas.map(enrichFormula),
    orders: Array.isArray(state.orders) ? state.orders : [],
    settings: { ...base.settings, ...(state.settings || {}) },
  };
}

export function toPublicInput(state) {
  const categories = state.categories || CATEGORIES;
  const tags = state.tags || TAGS;
  const products = state.products.filter((product) => product.published !== false).map((product) => ({
    id: product.id, name: product.name, description: product.description || "", category: product.category,
    country: product.country || "", tags: product.tags || [], visualMode: product.visualMode || "photo",
    visualTheme: product.visualTheme || "category", photo: product.photo || "",
    photoPositionX: product.photoPositionX ?? 50, photoPositionY: product.photoPositionY ?? 50,
    photoZoom: product.photoZoom ?? 1,
    ...(product.quickAdd?.enabled ? { price: product.quickAdd.price, priceMode: product.quickAdd.mode, trayServes: product.quickAdd.trayServes } : {}),
  }));
  const visibleIds = new Set(products.map((product) => product.id));
  const formulas = state.formulas.filter((formula) => formula.active !== false).map((formula) => ({
    id: formula.id, name: formula.name, description: formula.description, price: formula.pricePerGuest,
    minimum: formula.minimumGuests, recommended: formula.recommended,
    readyEnabled: formula.readyEnabled, customEnabled: formula.customEnabled,
    presentations: {
      ready: { ...formula.presentations.ready, price: formula.presentations.ready.pricePerGuest },
      custom: { ...formula.presentations.custom, price: formula.presentations.custom.pricePerGuest },
    },
    rules: formula.rules.map((rule) => ({
      category: rule.category, enabled: rule.enabled, choices: rule.choices, optional: rule.optional,
      products: Object.entries(rule.products || {}).filter(([id]) => visibleIds.has(id)).map(([id, config]) => ({ id, ...config })),
    })),
  }));
  return {
    logo: "../mil-logo.webp", categories, tags, products,
    addonIds: products.filter((product) => state.products.find((entry) => entry.id === product.id)?.quickAdd?.enabled).map((product) => product.id),
    formulas, endpoint: state.settings.formspreeEndpoint,
    vat: state.settings.vat, deposit: state.settings.deposit,
    paymentMethods: state.settings.paymentMethods, terms: state.settings.terms,
  };
}

export function createProduct() {
  return enrichProduct({ id: `recette-${crypto.randomUUID()}`, name: "Nouvelle recette", category: "bouchees", published: false }, Date.now());
}
