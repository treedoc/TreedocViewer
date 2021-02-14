import sampleData from '@/sampleData';
import CSVParserPlugin from '@/parsers/CSVParserPlugin';

describe('CSVParser.ts', () => {
  const parser = new CSVParserPlugin();
  it('looksLike', () => {
    expect(parser.looksLike(sampleData.csvStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.yamlStr)).toBeFalsy();
  });

  it('parse', () => {
    const result = parser.parse(sampleData.csvStr);
    expect(result.message).toBe('CSVParser.parser()');
    expect(result).toMatchSnapshot();
  });
});
