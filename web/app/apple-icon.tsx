import { ImageResponse } from 'next/og'
import { renderAppIcon } from '@/lib/pwa-icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(renderAppIcon(180), { ...size })
}
