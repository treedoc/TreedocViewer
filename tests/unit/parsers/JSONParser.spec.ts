import sampleData from '@/sampleData';
import JSONParserPlugin from '@/parsers/JSONParserPlugin';

describe('JSONParser.ts', () => {
  const parser = new JSONParserPlugin();
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.jsonStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.jsonStr);
    expect(result.message).toBe('TDJSONParser.parser()');
  });
});
