/* 영어 노트 — 설치형(오프라인) · 열 때마다 새 판 확인 */
const C = "eng-app-v1.0-11141719-ico1114";
const FILES = ["./", "./index.html", "./manifest.json", "./jay.html", "./jay.webmanifest", "./icon-192.png", "./icon-512.png", "./favicon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("eng-app-") && k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url); if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match(u.pathname.endsWith("jay.html") ? "./jay.html" : "./index.html"))));
});
