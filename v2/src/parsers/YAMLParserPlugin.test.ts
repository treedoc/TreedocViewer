import { sampleData, yamlStr, xmlStr, jsonStr } from '../data/sampleData';
import { describe, expect, test } from 'vitest'
import YAMLParserPlugin from './YAMLParserPlugin';

describe('YAMLParser.ts', () => {
  const parser = new YAMLParserPlugin();
  
  test('looksLike', () => {
    expect(parser.looksLike(yamlStr)).toBeTruthy();
    expect(parser.looksLike(xmlStr)).toBeFalsy();
    expect(parser.looksLike(jsonStr)).toBeFalsy();
  }); 

  test('parse', () => {
    const result = parser.parse(yamlStr);
    expect(result.message).toBe('YAML.parse()');
    expect(result.result).toMatchSnapshot();
  });

  test('parse multiple documents', () => {
    const str = `document: 1\n---\ndocument: 2`;
    const result = parser.parse(str);
    expect(result.message).toBe('YAML.parseAllDocuments()');
    expect(result.result).toMatchSnapshot();
  });
});
