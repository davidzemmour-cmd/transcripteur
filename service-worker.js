// Service worker du Transcripteur : garde une copie de l'appli sur le téléphone
// pour qu'elle s'ouvre même sans réseau.
// Stratégie « réseau d'abord » : on prend la version en ligne si possible (les mises à jour
// arrivent donc toutes seules), et la copie sur le téléphone seulement si le réseau ne répond pas.
// Les appels à Groq (autre site) ne passent jamais par ici.

var VERSION_CACHE = 'transcripteur-v1';
var DELAI_MAX_RESEAU = 4000; // ms : au-delà, on utilise la copie sur le téléphone
var FICHIERS_APPLI = [
  './',
  './index.html',
  './manifest.json',
  './icones/favicon.svg',
  './icones/icone-32.png',
  './icones/icone-180.png',
  './icones/icone-192.png',
  './icones/icone-512.png'
];

self.addEventListener('install', function (evenement) {
  evenement.waitUntil(
    caches.open(VERSION_CACHE).then(function (cache) { return cache.addAll(FICHIERS_APPLI); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Supprime les copies des anciennes versions.
self.addEventListener('activate', function (evenement) {
  evenement.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.filter(function (nom) { return nom !== VERSION_CACHE; })
        .map(function (nom) { return caches.delete(nom); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function chercherSurLeReseau(requete) {
  return new Promise(function (resoudre, rejeter) {
    var minuteur = setTimeout(function () { rejeter(new Error('Réseau trop lent')); }, DELAI_MAX_RESEAU);
    fetch(requete).then(function (reponse) {
      clearTimeout(minuteur);
      if (reponse && reponse.ok) {
        var copie = reponse.clone();
        caches.open(VERSION_CACHE).then(function (cache) { cache.put(requete, copie); });
      }
      resoudre(reponse);
    }, function (erreur) {
      clearTimeout(minuteur);
      rejeter(erreur);
    });
  });
}

self.addEventListener('fetch', function (evenement) {
  var requete = evenement.request;
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  evenement.respondWith(
    chercherSurLeReseau(requete).catch(function () {
      return caches.match(requete, { ignoreSearch: true }).then(function (reponse) {
        if (reponse) return reponse;
        if (requete.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
