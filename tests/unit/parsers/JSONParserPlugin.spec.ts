import sampleData from '@/sampleData';
import JSONParserPlugin, { JSONParserType } from '@/parsers/JSONParserPlugin';

describe('JSONParser.ts', () => {
  const parser = new JSONParserPlugin();
  const parserMapToString = new JSONParserPlugin("Map.toString", JSONParserType.JAVA_MAP_TO_STRING);
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.jsonStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();

    expect(parserMapToString.looksLike(sampleData.mapToStringStr)).toBeTruthy();
    expect(parserMapToString.looksLike(sampleData.xmlStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.jsonStr);
    expect(result.message).toBe('TDJSONParser.parser()');
  });
});
