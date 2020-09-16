import sampleData from '@/sampleData';
import XMLParserPlugin, { XMLParserOption } from '@/parsers/XMLParserPlugin';

describe('JSONParser.ts', () => {
  const parser = new XMLParserPlugin();
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.xmlStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.jsonStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });

  it('parse Compacted', () => {
    const compactParser = new XMLParserPlugin('XML compact', 'text/xml', true);
    const result = compactParser.parse(sampleData.xmlStr);
    expect(result.message).toBe('DOMParser().parseFromString()');
  });
});
