import {prometheusStr} from '../sampleData';

import { describe, expect, test } from 'vitest'
import PrometheusParser from './PrometheusParser';
import { TD } from 'treedoc';

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
    console.log(TD.stringify(result, "  "));
    expect(result).toMatchSnapshot();
  })
});