import {prometheusStr} from '../sampleData';

import { describe, expect, test } from 'vitest'
import PrometheusParser from './PrometheusParser';
import { TD } from 'treedoc';

describe('PrometheusParser.ts', () => {
  const parser = new PrometheusParser();
  test('parse', () => {
    const result = parser.parse(prometheusStr);
    console.log(TD.stringify(result, "  "));
    expect(result).toMatchSnapshot();
  })
});