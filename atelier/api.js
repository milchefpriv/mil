import { CONFIG } from "./config.js";

const SESSION_KEY = "mil-atelier-session-v1";

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}

function saveSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function consumeSessionFromUrl() {
  const params = new URLSearchParams(location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;
  saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(params.get("expires_in") || 3600),
    token_type: params.get("token_type") || "bearer",
  });
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

consumeSessionFromUrl();

async function authRequest(path, body) {
  const response = await fetch(`${CONFIG.supabaseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: CONFIG.supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || "Connexion refusée");
  if (result.access_token) saveSession(result);
  return result;
}

export const auth = {
  session: readSession,
  async signIn(email, password) {
    return authRequest("token?grant_type=password", { email, password });
  },
  async refresh() {
    const session = readSession();
    if (!session?.refresh_token) throw new Error("Session expirée");
    return authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  },
  signOut() { saveSession(null); },
};

async function rest(path, options = {}, authenticated = false) {
  let session = readSession();
  const headers = {
    apikey: CONFIG.supabaseKey,
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (authenticated) {
    if (!session?.access_token) throw new Error("Connexion requise");
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  let response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, { ...options, headers });
  if (response.status === 401 && authenticated && session?.refresh_token) {
    session = await auth.refresh();
    headers.Authorization = `Bearer ${session.access_token}`;
    response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, { ...options, headers });
  }
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(result?.message || result?.hint || "Erreur de synchronisation");
  return result;
}

export async function loadPublicCatalog() {
  const rows = await rest(`mil_public_catalog?id=eq.${CONFIG.stateId}&select=payload,updated_at`);
  return rows?.[0] || null;
}

export async function loadPrivateState() {
  const rows = await rest(`mil_atelier_state?id=eq.${CONFIG.stateId}&select=payload,updated_at`, {}, true);
  return rows?.[0] || null;
}

export async function saveState(payload, publicPayload) {
  const now = new Date().toISOString();
  // Orders live in their own small table. Keeping them out of the large
  // atelier payload prevents the same customer data being downloaded twice.
  const privatePayload = { ...payload, orders: [] };
  await Promise.all([
    rest(`mil_atelier_state?id=eq.${CONFIG.stateId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload: privatePayload, updated_at: now }),
    }, true),
    rest(`mil_public_catalog?id=eq.${CONFIG.stateId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payload: publicPayload, updated_at: now }),
    }, true),
  ]);
  return now;
}

export async function loadOrders() {
  return rest("mil_orders?select=id,status,payload,created_at&order=created_at.desc&limit=250", {}, true);
}

export async function savePublicOrder(request) {
  const createdAt = request?.createdAt || new Date().toISOString();
  return rest("mil_orders?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      id: request.id,
      status: "new",
      payload: { ...request, status: "new", createdAt },
      created_at: createdAt,
      updated_at: createdAt,
    }),
  });
}

export async function saveAdminOrder(order) {
  await savePublicOrder({ ...order, status: "new" });
  if (order.status && order.status !== "new") {
    await updateOrderStatus(order.id, order.status);
  }
}

export async function updateOrderStatus(id, status) {
  return rest(`mil_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  }, true);
}
