import { ImageResponse } from 'next/og'
import { renderAppIcon } from '@/lib/pwa-icon'

export async function GET() {
  return new ImageResponse(renderAppIcon(512), { width: 512, height: 512 })
}
