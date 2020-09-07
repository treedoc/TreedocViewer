import History from '@/models/History';
import sampleData from '@/sampleData';
import JSONParser from '@/parsers/JSONParser';
import { ParseResult } from '@/models/JTTOption';
import XMLParser, { XMLParserOption } from '@/parsers/XMLParser';

describe('JSONParser.ts', () => {
  const parser = new XMLParser();
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.xmlStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.jsonStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });

  it('parse Compacted', () => {
    const compactParser = new XMLParser('XML compact', 'text/xml', true);
    const result = compactParser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });
});
