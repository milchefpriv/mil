import { auth, loadOrders, loadPrivateState, saveState } from "./api.js?v=20260830-private";
import { toPublicInput } from "./model.js?v=20260830-private";

const root = document.querySelector("#app");

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
})[character]);

const localizeState = (input) => {
  if (!input?.products || !input?.formulas) throw new Error("Données privées indisponibles");
  const state = structuredClone(input);
  state.products = state.products.map((product) => ({
    ...product,
    photo: product.photo ? `./media/${product.photo.split("/").pop()}` : "",
  }));
  return state;
};

function showLogin(message = "") {
  try {
    localStorage.removeItem("atelier-mil-pro-cache");
    localStorage.removeItem("atelier-mil-pro-restore-point");
  } catch {}
  root.innerHTML = "";
  document.body.classList.add("owner-login-open");
  document.querySelector(".owner-login-layer")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="owner-login-layer">
    <section class="owner-login-card" role="dialog" aria-modal="true" aria-labelledby="owner-login-title">
      <img src="./mil-logo.webp" alt="MiL">
      <span>ACCÈS PROPRIÉTAIRE</span>
      <h1 id="owner-login-title">Connexion à l’atelier</h1>
      <p>Cette interface est strictement privée. Connectez-vous avec le compte propriétaire MiL.</p>
      <form>
        <label>E-mail<input required type="email" name="email" autocomplete="email"></label>
        <label>Mot de passe<input required minlength="8" type="password" name="password" autocomplete="current-password"></label>
        ${message ? `<div class="owner-login-error" role="alert">${escapeHtml(message)}</div>` : ""}
        <button class="button primary" type="submit">Se connecter</button>
      </form>
    </section>
  </div>`);

  const form = document.querySelector(".owner-login-card form");
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    button.textContent = "Connexion…";
    try {
      await auth.signIn(data.email, data.password);
      location.reload();
    } catch {
      showLogin("E-mail ou mot de passe incorrect.");
    }
  };
}

async function startPrivateAtelier() {
  const session = auth.session();
  if (!session?.access_token) {
    showLogin();
    return;
  }

  let initialState;
  try {
    const [privateRow, orderRows] = await Promise.all([loadPrivateState(), loadOrders()]);
    initialState = localizeState(privateRow?.payload);
    initialState.orders = (orderRows || []).map((row) => ({
      ...(row.payload || {}),
      id: row.id || row.payload?.id,
      status: row.status || row.payload?.status || "new",
      createdAt: row.created_at || row.payload?.createdAt,
    }));
  } catch {
    auth.signOut();
    showLogin("Ce compte n’est pas autorisé à accéder à l’Atelier MiL.");
    return;
  }

  // The original application prefers its browser cache when it looks newer
  // than the server payload. Always seed it with the authorized server state.
  try {
    localStorage.setItem("atelier-mil-pro-cache", JSON.stringify(initialState));
  } catch {}

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (resource, options = {}) => {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    if (url !== "/api/state") return nativeFetch(resource, options);

    const method = (options.method || "GET").toUpperCase();
    if (method === "PUT") {
      const state = localizeState(JSON.parse(String(options.body || "{}")));
      const savedAt = await saveState(state, toPublicInput(state));
      initialState = state;
      return Response.json({ state, savedAt });
    }
    if (method === "DELETE") {
      const state = localizeState(initialState);
      const savedAt = await saveState(state, toPublicInput(state));
      return Response.json({ state, savedAt });
    }
    return Response.json({ state: initialState, savedAt: initialState.updatedAt });
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest(".sidebar-note") && confirm("Se déconnecter de l’Atelier ?")) {
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

  document.body.classList.remove("owner-login-open");
  root.innerHTML = "";
  ReactClient.hydrateRoot(
    root,
    React.createElement(Atelier, {
      initialState,
      remoteAvailable: true,
      readOnly: false,
      ownerSignInPath: "./",
    }),
    { onRecoverableError() {} },
  );
}

await startPrivateAtelier();
