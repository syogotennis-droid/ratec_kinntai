// 業務データは常に最新を取得したいため、積極的なキャッシュは行わない。
// ホーム画面へのインストールを可能にするための最小限のservice workerです。
// v5-logo-optical-center: このコメント自体がファイルの内容を変え、ブラウザに更新を検知させる
// ためのバージョン目印です（アイコン差し替えなどを速やかに反映させる目的）。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // 何もキャッシュせず、常にネットワークから取得する
})
