import {promethusStr} from '../sampleData';

import { describe, expect, test } from 'vitest'
import PrometheusParser from './PrometheusParser';
import { TD } from 'treedoc';

describe('PrometheusParser.ts', () => {
  const parser = new PrometheusParser();
  test('parse', () => {
    const result = parser.parse(promethusStr);
    console.log(TD.stringify(result, "  "));
    expect(result).toMatchSnapshot();
  })
});