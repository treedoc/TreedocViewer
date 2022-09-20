import Util from '../../../src/util/Util';
import { describe, expect, test } from 'vitest'

describe('Util.ts', () => {
  test('nonBlankStartsWith', () => {
    expect(Util.nonBlankStartsWith('   abcdefghijklmn', ['ab', 'bc]'], 5)).toBeTruthy();
    expect(Util.nonBlankStartsWith('   bcdefghijklmn', ['ab', 'bc]'], 5)).toBeFalsy();
  });

  test('nonBlankEndsWith', () => {
    expect(Util.nonBlankEndsWith('   abcdefghijklmn  \t', ['mn', 'n'], 5)).toBeTruthy();
    expect(Util.nonBlankEndsWith('   bcdefghijklm \n\t  ', ['mn', 'n'], 5)).toBeFalsy();
  });

  test('topLines', () => {
    expect(Util.topLines('12\n34\n56\n', 10)).toMatchSnapshot();
    expect(Util.topLines('12\n34\n56\n', 7)).toMatchSnapshot();
  });
});
