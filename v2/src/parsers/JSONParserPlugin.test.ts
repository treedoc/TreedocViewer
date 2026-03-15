import { sampleData, jsonStr, yamlStr, xmlStr } from '../data/sampleData';
import JSONParserPlugin, { JSONParserType } from './JSONParserPlugin';
import { describe, expect, test } from 'vitest'

describe('JSONParser.ts', () => {
  const parser = new JSONParserPlugin();
  const parserMapToString = new JSONParserPlugin('Map.toString', JSONParserType.JAVA_MAP_TO_STRING);
  
  test('looksLike', () => {
    expect(parser.looksLike(jsonStr)).toBeTruthy();
    expect(parser.looksLike(yamlStr)).toBeFalsy();

    const mapToStringStr = '{K1=v1, k2=123, k3={c=Test with ,in}, k4=[ab,c, def]}';
    expect(parserMapToString.looksLike(mapToStringStr)).toBeTruthy();
    expect(parserMapToString.looksLike(xmlStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(jsonStr);
    expect(result.message).toBe('TDJSONParser.parse()');
    expect(result.result).toMatchSnapshot();
  });
});
