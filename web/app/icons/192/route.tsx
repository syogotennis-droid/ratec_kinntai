import { ImageResponse } from 'next/og'
import { renderAppIcon } from '@/lib/pwa-icon'

export async function GET() {
  return new ImageResponse(renderAppIcon(192), { width: 192, height: 192 })
}
