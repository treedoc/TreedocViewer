import { sampleData, xmlStr, jsonStr } from '../data/sampleData';
import XMLParserPlugin from './XMLParserPlugin';
import { describe, expect, test } from 'vitest'

/**
 * @vitest-environment jsdom
 */
describe('XMLParser.ts', () => {
  const parser = new XMLParserPlugin();
  
  test('looksLike', () => {
    expect(parser.looksLike(xmlStr)).toBeTruthy();
    expect(parser.looksLike(jsonStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(xmlStr);
    expect(result.message).toBe('DOMParser.parseFromString()');
    expect(result.result).toMatchSnapshot();
  });

  test('parse Compacted', () => {
    const compactParser = new XMLParserPlugin('XML compact', 'text/xml', true);
    const result = compactParser.parse(xmlStr);
    expect(result.message).toBe('DOMParser.parseFromString()');
    expect(result.result).toMatchSnapshot();
  });
});
