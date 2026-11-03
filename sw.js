const CACHE_NAME='unicron-plus-v2';
const urlsToCache=['/','/index.html','/download.html','/manifest.json','/icon-192.png','/icon-512.png','/logo.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(urlsToCache)))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>{if(k!==CACHE_NAME) return caches.delete(k)}))))});
