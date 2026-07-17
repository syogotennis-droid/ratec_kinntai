import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RATEC ONE 業務管理システム',
    short_name: 'RATEC ONE',
    description: '勤怠・予定・売上・見積書・請求書などを管理する社内向け業務管理システム',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#012074',
    icons: [
      { src: '/icons/icon-192-v4.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-v4.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512-v4.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
