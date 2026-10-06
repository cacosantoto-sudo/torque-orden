// Service worker: permite instalar la app y que abra rápido.
// Las páginas y config.js van siempre primero a la red (para tener la última versión)
// y solo si no hay conexión se usa la copia guardada.
// Los datos (Supabase) y las funciones de /api nunca se guardan.
var CACHE = "taller-v8";
var BASICOS = ["./", "./index.html", "./config.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(BASICOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function guardar(req, res) {
  if (res && res.ok) { var copia = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Librerías del CDN: usar la copia guardada y actualizarla en segundo plano.
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.match(req).then(function (hit) {
      var red = fetch(req).then(function (res) { return guardar(req, res); }).catch(function () { return hit; });
      return hit || red;
    }));
    return;
  }

  // Del propio sitio, salvo /api: red primero, copia guardada si no hay conexión.
  if (url.origin === self.location.origin && url.pathname.indexOf("/api/") !== 0) {
    e.respondWith(fetch(req).then(function (res) { return guardar(req, res); }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match("./index.html"); });
    }));
  }
  // Todo lo demás (Supabase, fuentes, etc.) va directo a la red.
});
