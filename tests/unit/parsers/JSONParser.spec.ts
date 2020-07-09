import History from '@/models/History';
import sampleData from '@/sampleData';
import JSONParser from '@/parsers/JSONParser';
import { ParseResult } from '@/models/JTTOption';

describe('JSONParser.ts', () => {
  const parser = new JSONParser();
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.jsonStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.jsonStr);
    expect(result.message).toBe('TDJSONParser.parser()');
  });
});
