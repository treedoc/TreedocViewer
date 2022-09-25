import _ from 'lodash';
import { Bookmark } from 'treedoc';

export default class TextLine {
  lineOffsets: number[] = [];
  constructor(private text: string) {
    let newLine = true;
    for (let i = 0; i < text.length; i++) {
      if (newLine)
        this.lineOffsets.push(i);
      newLine = false;
      if (text.charAt(i) === '\n')
        newLine = true;
    }
  }

  getBookmark(offset: number) {
    let line = _.sortedIndex(this.lineOffsets, offset)
    let column = 0;
    if (offset === this.lineOffsets.length || offset < this.lineOffsets[line]) {
      line --;
      column = offset - this.lineOffsets[line];
    }
    return new Bookmark(line, column, offset);
  }
}