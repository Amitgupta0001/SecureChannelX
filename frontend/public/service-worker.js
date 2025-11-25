const CACHE_VERSION = "v2";
const CACHE_NAME = `securechannelx-cache-${CACHE_VERSION}`;

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-144.png",
  "/icons/icon-144.png"
];

// Install SW – cache static assets
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Install");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );

  self.skipWaiting(); // Make new version active immediately
});

// Fetch – Cache-first strategy
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Add new resources to cache dynamically
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});

// Activate – cleanup old caches
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activate");

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Push Notification Event
self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push Received");

  let data = { title: "New Message", body: "You have a new message", url: "/" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notification click Received");

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Check if there is already a window for this app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === event.notification.data.url && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
