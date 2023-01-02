import sampleData from '../sampleData';
import XMLParserPlugin, { XMLParserOption } from '../parsers/XMLParserPlugin';
import { describe, expect, test } from 'vitest'

/**
 * @vitest-environment jsdom
 */
describe('JSONParser.ts', () => {
  const parser = new XMLParserPlugin();
  test('looksLike', () => {
    expect(parser.looksLike(sampleData.xmlStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.jsonStr)).toBeFalsy();
  });

  test('parse', () => {
    const result = parser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });

  test('parse Compacted', () => {
    const compactParser = new XMLParserPlugin('XML compact', 'text/xml', true);
    const result = compactParser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });
});
