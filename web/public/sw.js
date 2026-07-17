// 業務データは常に最新を取得したいため、積極的なキャッシュは行わない。
// ホーム画面へのインストールを可能にするための最小限のservice workerです。
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // 何もキャッシュせず、常にネットワークから取得する
})
