import sampleData from '../../../src/sampleData';
import { describe, expect, test } from 'vitest'
import YAMLParserPlugin  from '../../../src/parsers/YAMLParserPlugin';
import { TD, TDEncodeOption } from 'treedoc';

describe('YAMLParser.ts', () => {
  const parser = new YAMLParserPlugin();
  test('looksLike', () => {
    expect(parser.looksLike(sampleData.yamlStr)).toBeTruthy();
    expect(parser.looksLike(sampleData.xmlStr)).toBeFalsy();
    expect(parser.looksLike(sampleData.jsonStr)).toBeFalsy();
  }); 

  test('parse', () => {
    const result = parser.parse(sampleData.yamlStr);
    expect(result.message).toMatchInlineSnapshot('"YAML.parse()"');
    const encodeOpt = new TDEncodeOption();
    encodeOpt.coderOption.coders = [];   // remote default coder which will use `toJSON()` method
    encodeOpt.jsonOption.quoteChar = "'";
    expect(TD.stringify(result.result, encodeOpt)).toMatchSnapshot();
  });
});
