import sampleData, {promethusStr} from '../sampleData';

import JSONParserPlugin, { JSONParserType } from './JSONParserPlugin';
import { describe, expect, test } from 'vitest'
import PrometheusParser from './PrometheusParser';
import { TD, TreeDoc } from 'treedoc';

describe('PrometheusParser.ts', () => {
  const parser = new PrometheusParser();
  test('parse', () => {
    const result = parser.parse(promethusStr);
    console.log(TD.stringify(result, "  "));
    expect(result).toMatchSnapshot();
  })
});