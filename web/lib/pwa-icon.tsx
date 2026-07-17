// PWAのホーム画面アイコン(通常・maskable共通)・favicon・apple-touch-icon で
// 使い回す共通デザイン。書類(帳票)+チェックマークで「業務管理」を表現する。
// OSごとに円形/角丸/四角形どれで切り抜かれても重要部分が欠けないよう、
// 背景は常にフルブリードの正方形にし、図柄は中央60%弱のセーフエリア内に収める。

const BG = '#1d4fd1'
const BADGE = '#163ea3'
const DOC = '#ffffff'
const BARS = '#c7d9fb'

export function renderAppIcon(sizePx: number) {
  const contentSize = Math.round(sizePx * 0.58)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
      }}
    >
      <svg width={contentSize} height={contentSize} viewBox="0 0 100 100">
        <rect x={22} y={14} width={44} height={58} rx={6} fill={DOC} />
        <rect x={30} y={30} width={28} height={5} rx={2.5} fill={BARS} />
        <rect x={30} y={42} width={28} height={5} rx={2.5} fill={BARS} />
        <rect x={30} y={54} width={20} height={5} rx={2.5} fill={BARS} />
        <circle cx={66} cy={78} r={17} fill={BADGE} />
        <path
          d="M58 78 L64 85 L76 69"
          stroke="#ffffff"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  )
}
