import sampleData from '../../../src/sampleData';
import CSVParserPlugin from '../../../src/parsers/CSVParserPlugin';
import { describe, expect, test } from 'vitest'

describe('CSVParser.ts', () => {
  const parser = new CSVParserPlugin();
  test('looksLike', () => {
    expect(parser.looksLike(sampleData.csvStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(sampleData.csvStr);
    expect(result.message).toBe('CSVParser.parser()');
    expect(result.result?.toStringInternal("", true, true)).toMatchSnapshot();
  });
});
