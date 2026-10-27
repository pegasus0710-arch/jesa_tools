/* 레시피 노트 — 오프라인용 (새 버전이 있으면 먼저 받고, 인터넷이 없으면 저장본) */
const C = "recipe-note-v1.0-r8";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "manifest.json", "icon-192.png", "icon-512.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith("recipe-note-") && x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => { if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("./")))); });
