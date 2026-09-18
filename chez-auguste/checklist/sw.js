"use strict";

const BUILD_ID = "16";
const CACHE_NAME = `auguste-checklist-v${BUILD_ID}`;
const CACHE_PREFIX = "auguste-checklist-";
const INDEX_URL = new URL("./index.html", self.location.href).href;
const CORE_SHELL = [
  "./index.html",
  "./styles.css?v=14",
  "./app.js?v=15",
  "./manifest.webmanifest",
  "../assets/supabase-D_AYc1Jo.js",
];
const OPTIONAL_ASSETS = [
  "../favicon.svg",
  "../app-icon-180.png",
  "../app-icon-192.png",
  "../app-icon-512.png",
];
const APP_SHELL_URLS = new Set(
  [...CORE_SHELL, ...OPTIONAL_ASSETS].map((asset) => new URL(asset, self.location.href).href),
);

async function cacheAsset(cache, asset) {
  const request = new Request(new URL(asset, self.location.href).href, { cache: "reload" });
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Impossible de mettre en cache ${asset}: ${response.status}`);
  await cache.put(request, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(CORE_SHELL.map((asset) => cacheAsset(cache, asset)));
      await Promise.all(
        OPTIONAL_ASSETS.map((asset) => cacheAsset(cache, asset).catch(() => undefined)),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackKey = request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) await cache.put(fallbackKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  let responsePromise = null;
  if (request.mode === "navigate") {
    responsePromise = networkFirst(request, INDEX_URL);
  } else if (APP_SHELL_URLS.has(url.href)) {
    responsePromise = networkFirst(request);
  }

  if (!responsePromise) return;
  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.then(() => undefined, () => undefined));
});
