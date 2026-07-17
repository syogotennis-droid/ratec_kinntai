import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d4fd1',
          color: '#ffffff',
          fontSize: 260,
          fontWeight: 700,
        }}
      >
        R
      </div>
    ),
    { width: 512, height: 512 }
  )
}
