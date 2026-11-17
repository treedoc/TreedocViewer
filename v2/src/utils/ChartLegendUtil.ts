// Values must be chronological observations within the selected range.
// Missing buckets are not zero-filled. Increase excludes the latest observation,
// which may be partial, and is not a counter rate.
export function summarizeChartValues(values: number[]) {
  const finite = values.filter(Number.isFinite)
  const last = finite[finite.length - 1] ?? 0
  return {
    max: finite.length ? Math.max(...finite) : 0,
    mean: finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0,
    last,
    increase: finite.length > 1 ? finite[finite.length - 2] - finite[0] : 0,
  }
}
