/* Generated after each production build. The installed app caches its shell for offline use. */
const CACHE_NAME = "studyguide-offline-7e78dbb25953-v9-admin";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/fonts/font-0.woff2",
  "./assets/fonts/font-1.woff2",
  "./assets/fonts/font-2.woff2",
  "./assets/fonts/font-3.woff2",
  "./assets/fonts/font-4.woff2",
  "./assets/fonts/font-5.woff2",
  "./assets/fonts/font-6.woff2",
  "./assets/fonts/font-7.woff2",
  "./assets/fonts/font-8.woff2",
  "./assets/fonts/fonts.css",
  "./assets/index-Hk2Vn6Tz.js",
  "./assets/index-Pw4Rm8Ve.css",
  "./assets/media/certificate.mp4",
  "./assets/media/eschool-palestine-logo_b284864e.jpg",
  "./assets/media/microsoft-teams-user-logo_717daa58.png",
  "./assets/media/studyguide-hero_5ee5b91d.png",
  "./assets/media/studyguide-mobile-illustration_11483182.png",
  "./assets/media/studyguide-official-logo_fc6acc46.png",
  "./assets/media/studyguide-study-illustration_e23fb0fc.png",
  "./manifest.json",
  "./admin.js"
];
const APP_SHELL_URL = new URL("./", self.location).href;

const cacheResponse = async (request, response) => {
  if (!response || (!response.ok && response.type !== "opaque")) return response;
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("studyguide-offline-") && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => cacheResponse(APP_SHELL_URL, response)).catch(() => caches.match(APP_SHELL_URL).then((cached) => cached || caches.match("./index.html"))));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/admin.js")) {
    event.respondWith(fetch(request).then((response) => cacheResponse(request, response)).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => cacheResponse(request, response)).catch(() => cached)));
});
