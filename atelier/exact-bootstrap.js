import { auth, loadOrders, loadPrivateState, saveState } from "./api.js?v=20260830-exact";
import { toPublicInput } from "./model.js?v=20260830-exact";

const root = document.querySelector("#app");
const fallback = await fetch("./original-state.json").then((response) => response.json());

const localizeState = (input) => {
  const state = structuredClone(input || fallback);
  state.products = (state.products || []).map((product) => ({
    ...product,
    photo: product.photo ? `./media/${product.photo.split("/").pop()}` : "",
  }));
  return state;
};

let session = auth.session();
let readOnly = !session?.access_token;
let initialState = localizeState(fallback);

if (!readOnly) {
  try {
    const [privateRow, orderRows] = await Promise.all([loadPrivateState(), loadOrders()]);
    initialState = localizeState(privateRow?.payload || fallback);
    initialState.orders = (orderRows || []).map((row) => ({
      ...(row.payload || {}),
      id: row.id || row.payload?.id,
      status: row.status || row.payload?.status || "new",
      createdAt: row.created_at || row.payload?.createdAt,
    }));
  } catch {
    auth.signOut();
    session = null;
    readOnly = true;
  }
}

// The original application prefers its browser cache when it looks newer than
// the server payload. Replace leftovers from previous builds before mounting so
// deleted or malformed data can never be revived on the rebuilt site.
try {
  localStorage.setItem("atelier-mil-pro-cache", JSON.stringify(initialState));
} catch {}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (resource, options = {}) => {
  const url = typeof resource === "string" ? resource : resource?.url || "";
  if (url !== "/api/state") return nativeFetch(resource, options);
  if (readOnly) return new Response(JSON.stringify({ error: "Connexion requise" }), { status: 401, headers: { "Content-Type": "application/json" } });

  if ((options.method || "GET").toUpperCase() === "PUT") {
    const state = localizeState(JSON.parse(String(options.body || "{}")));
    const savedAt = await saveState(state, toPublicInput(state));
    return Response.json({ state, savedAt });
  }
  if ((options.method || "GET").toUpperCase() === "DELETE") {
    const state = localizeState(fallback);
    const savedAt = await saveState(state, toPublicInput(state));
    return Response.json({ state, savedAt });
  }
  return Response.json({ state: initialState, savedAt: initialState.updatedAt });
};

function showLogin(message = "") {
  document.querySelector(".owner-login-layer")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="owner-login-layer">
    <section class="owner-login-card" role="dialog" aria-modal="true">
      <button class="owner-login-close" type="button" aria-label="Fermer">×</button>
      <img src="./mil-logo.webp" alt="MiL">
      <span>ACCÈS PROPRIÉTAIRE</span>
      <h2>Connexion à l’atelier</h2>
      <p>Utilisez votre compte Supabase. Les modifications seront enregistrées et visibles sur tous vos appareils.</p>
      <form>
        <label>E-mail<input required type="email" name="email" autocomplete="email"></label>
        <label>Mot de passe<input required minlength="8" type="password" name="password" autocomplete="current-password"></label>
        ${message ? `<div class="owner-login-error">${String(message).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character])}</div>` : ""}
        <button class="button primary" type="submit">Se connecter</button>
        <button class="owner-signup" type="button">Créer mon accès</button>
      </form>
    </section>
  </div>`);
  const layer = document.querySelector(".owner-login-layer");
  layer.querySelector(".owner-login-close").onclick = () => layer.remove();
  layer.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await auth.signIn(data.email, data.password);
      location.reload();
    } catch (error) {
      showLogin(error.message);
    }
  };
  layer.querySelector(".owner-signup").onclick = async () => {
    const form = layer.querySelector("form");
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    try {
      await auth.signUp(data.email, data.password);
      showLogin("Compte créé. Confirmez l’e-mail reçu, puis reconnectez-vous.");
    } catch (error) {
      showLogin(error.message);
    }
  };
}

document.addEventListener("click", (event) => {
  const ownerLink = event.target.closest('a[href="#owner"]');
  if (ownerLink) {
    event.preventDefault();
    showLogin();
    return;
  }
  if (!readOnly && event.target.closest(".sidebar-note") && confirm("Se déconnecter de l’Atelier ?")) {
    auth.signOut();
    location.reload();
  }
}, true);

window.__MIL_STANDALONE__ = true;
const [{ i: reactModule, t: clientModule }, { default: Atelier }] = await Promise.all([
  import("./original-assets/framework-CXnKph_e.js"),
  import("./original-assets/atelier-B4stXUXt.js"),
]);
const React = reactModule();
const ReactClient = clientModule();

if (readOnly) root.innerHTML = "";
ReactClient.hydrateRoot(
  root,
  React.createElement(Atelier, {
    initialState,
    remoteAvailable: !readOnly,
    readOnly,
    ownerSignInPath: "#owner",
  }),
  { onRecoverableError() {} },
);
