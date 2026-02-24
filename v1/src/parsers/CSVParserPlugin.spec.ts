import sampleData from '../sampleData';
import CSVParserPlugin from './CSVParserPlugin';
import { describe, expect, test } from 'vitest'

describe('CSVParser.ts', () => {
  const parser = new CSVParserPlugin();
  test('looksLike', () => {
    expect(parser.looksLike(sampleData.csvStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(sampleData.csvStr);
    expect(result.message).toBe('CSVParser.parse()');
    expect(result.result?.toStringInternal("", true, true)).toMatchSnapshot();
  });
});
