import Util from '@/util/Util';

describe('Util.ts', () => {
  it('nonBlankStartsWith', () => {
    expect(Util.nonBlankStartsWith('   abcdefghijklmn', ['ab', 'bc]'], 5)).toBeTruthy();
    expect(Util.nonBlankStartsWith('   bcdefghijklmn', ['ab', 'bc]'], 5)).toBeFalsy();
  });

  it('nonBlankEndsWith', () => {
    expect(Util.nonBlankEndsWith('   abcdefghijklmn  \t', ['mn', 'n'], 5)).toBeTruthy();
    expect(Util.nonBlankEndsWith('   bcdefghijklm \n\t  ', ['mn', 'n'], 5)).toBeFalsy();
  });
});
