const APP_VERSION = "9c86219ca116aa2ebccd";
const APP_FILES = ["./app.js","./domain.js","./icons/apple-touch-icon.png","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.svg","./index.html","./manifest.webmanifest","./storage.js","./style.css"];
// APP_VERSION and APP_FILES are prefixed by server.mjs from the actual shell contents.
const CACHE_PREFIX='prichudy-calculator-';
const CACHE_NAME=CACHE_PREFIX+APP_VERSION;
const INDEX_URL=new URL('./index.html',self.registration.scope).href;
const FILE_URLS=APP_FILES.map(name=>new URL(name,self.registration.scope).href);

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(FILE_URLS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const previous=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME);
    for(const name of previous) await caches.delete(name);
    await self.clients.claim();
    if(previous.length) await notifyUpdate();
  })());
});

async function notifyUpdate() {
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) client.postMessage({type:'APP_UPDATED'});
}

async function refreshNavigation(cache,cachedText) {
  try {
    const fresh=await fetch(INDEX_URL,{cache:'no-store'});
    if(!fresh.ok || !fresh.headers.get('content-type')?.includes('text/html'))return;
    const text=await fresh.clone().text();
    if(text!==cachedText) {
      // Keep the current shell coherent; install a new version before prompting refresh.
      await self.registration.update();
    }
  } catch {}
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  const navigation=request.mode==='navigate';
  const key=navigation ? INDEX_URL : url.href;
  if(!navigation && !FILE_URLS.includes(key)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(key);
    if(cached) {
      if(navigation) {
        // Start reading a clone before respondWith hands the original response away.
        const cachedText=cached.clone().text();
        event.waitUntil(cachedText.then(text=>refreshNavigation(cache,text)));
      }
      return cached;
    }
    try {
      const fresh=await fetch(request);
      if(fresh.ok) await cache.put(key,fresh.clone());
      return fresh;
    } catch {
      return new Response('Нет сохранённой версии. Откройте приложение один раз с подключением.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
