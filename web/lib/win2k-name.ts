import { Win2kResult, Win2kSpecSummary } from '@/lib/win2k'

export function buildWin2kName(makerLabel: string, result: Win2kResult, spec?: Win2kSpecSummary | null): string {
  const sizePrefix = spec?.size ? `${spec.size}${spec.shapeWord ?? ''}` : ''
  const wattageSuffix = spec?.wattage ? `${spec.wattage}W` : ''
  const category = spec?.productType ?? result.category
  const productLine = category
    ? `${makerLabel}　${sizePrefix}${category}${wattageSuffix}`
    : makerLabel
  return `${productLine}\n型番：${result.code}`
}
