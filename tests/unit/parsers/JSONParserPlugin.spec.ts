import sampleData from '../../../src/sampleData';
import JSONParserPlugin, { JSONParserType } from '../../../src/parsers/JSONParserPlugin';
import { describe, expect, test } from 'vitest'

describe('JSONParser.ts', () => {
  const parser = new JSONParserPlugin();
  const parserMapToString = new JSONParserPlugin('Map.toString', JSONParserType.JAVA_MAP_TO_STRING);
  test('looksLike', () => {
    expect(parser.looksLike(sampleData.jsonStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();

    expect(parserMapToString.looksLike(sampleData.mapToStringStr)).toBeTruthy();
    expect(parserMapToString.looksLike(sampleData.xmlStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(sampleData.jsonStr);
    expect(result.message).toBe('TDJSONParser.parser()');
  });
});