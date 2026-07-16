import { Win2kResult } from '@/lib/win2k'
import { Win2kSpecSummary } from '@/app/api/win2k-spec/route'

export function buildWin2kName(makerLabel: string, result: Win2kResult, spec?: Win2kSpecSummary | null): string {
  const sizePrefix = spec?.size && spec.shapeWord ? `${spec.size}${spec.shapeWord}` : ''
  const wattageSuffix = spec?.wattage ? `${spec.wattage}W` : ''
  const productLine = result.category
    ? `${makerLabel}　${sizePrefix}${result.category}${wattageSuffix}`
    : makerLabel
  return `${productLine}\n型番：${result.code}`
}
