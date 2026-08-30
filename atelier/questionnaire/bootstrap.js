import { createOrder, loadPublicCatalog } from "../api.js";
import { questionnaireRuntime } from "./runtime.js";

const fallback = await fetch("./default-input.json").then((response) => response.json());
let input = fallback;

try {
  const row = await loadPublicCatalog();
  if (row?.payload?.products && row?.payload?.formulas) input = row.payload;
} catch {
  // La version intégrée garde le questionnaire disponible hors ligne.
}

input = structuredClone(input);
input.logo = "../mil-logo.webp";
input.products = (input.products || []).map((product) => ({
  ...product,
  photo: String(product.photo || "")
    .replace(/^\/media\//, "../media/")
    .replace(/^\.\/media\//, "../media/"),
}));

window.milSubmitOrder = createOrder;
questionnaireRuntime(input);

