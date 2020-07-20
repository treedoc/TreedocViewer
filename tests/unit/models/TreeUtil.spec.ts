import TreeUtil from '@/models/TreeUtil';
import { TDJSONParser, TDJSONParserOption } from 'treedoc/lib/index';

describe('TreeUtil.ts', () => {

  it('getTypeSizeLabel', () => {
    const json = `
    {
      $type:'ActivityHist<Something>',
      $id:1234,
      creationDate:'2014/10/02 10:20:37',
      lastModifiedDate:'2014/10/02 10:20:37',
      runtimeContext:'t=118',
      partitionKey:0,
      activityType:'1-buyerCreateCancel',
      log:'http://www.google.com',
    }
    `;
    const tdNode = TDJSONParser.parse(json);

    expect(TreeUtil.getTypeSizeLabel(tdNode)).toBe('{8} <ActivityHist@1234>');
  });
});
