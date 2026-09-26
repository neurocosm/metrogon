importScripts('./version.js','./samples.js');
const CACHE=`metrogon-${METROGON_VERSION}`;
const FILES=['./','./index.html','./styles.css','./version.js','./app.js','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./samples.js','./sample-credits.html','./samples/sources.json','./samples/NakedDrums-LICENSE.txt','./samples/Frankensnare-LICENSE.txt','./samples/Big-Rusty-Drums-LICENSE.txt','./samples/CC0-1.0.txt',...Object.values(SAMPLE_FILES)];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('metrogon-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));});
