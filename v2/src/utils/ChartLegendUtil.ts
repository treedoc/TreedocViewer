// Values must be chronological observations within the selected range.
// Missing buckets are not zero-filled; Increase is last minus first, not a counter rate.
export function summarizeChartValues(values: number[]) {
  const finite = values.filter(Number.isFinite)
  const last = finite[finite.length - 1] ?? 0
  return {
    max: finite.length ? Math.max(...finite) : 0,
    mean: finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0,
    last,
    increase: last - (finite[0] ?? 0),
  }
}
