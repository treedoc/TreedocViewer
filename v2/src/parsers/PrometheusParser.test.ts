import { prometheusStr } from '../data/sampleData';
import { describe, expect, test } from 'vitest'
import PrometheusParser from './PrometheusParser';

// TODO: test following data
const data = `
# HELP thanos_objstore_bucket_operation_duration_seconds Duration of successful operations against the bucket
# TYPE thanos_objstore_bucket_operation_duration_seconds histogram
thanos_objstore_bucket_operation_duration_seconds_bucket{bucket="thanos",operation="attributes",le="0.01"} 0
thanos_objstore_bucket_operation_duration_seconds_bucket{bucket="thanos",operation="attributes",le="0.1"} 0
`

describe('PrometheusParser.ts', () => {
  const parser = new PrometheusParser();
  
  test('parse', () => {
    const result = parser.parse(prometheusStr);
    expect(result).toMatchSnapshot();
  })

  test('parse histogram', () => {
    const parser2 = new PrometheusParser();
    const result = parser2.parse(data);
    expect(result).toMatchSnapshot();
  })
});
