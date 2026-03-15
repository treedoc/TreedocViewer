import { sampleData, csvStr, yamlStr } from '../data/sampleData';
import CSVParserPlugin from './CSVParserPlugin';
import { describe, expect, test } from 'vitest'

describe('CSVParser.ts', () => {
  const parser = new CSVParserPlugin();
  
  test('looksLike', () => {
    expect(parser.looksLike(csvStr)).toBeTruthy();
    expect(parser.looksLike(yamlStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(csvStr);
    expect(result.message).toBe('CSVParser.parse()');
    expect(result.result).toMatchSnapshot();
  });
});
