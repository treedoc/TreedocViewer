export default class Util {
  static nonBlankStartsWith(str: string, pattern: string[], detectLength= 1000): boolean {
    for (let i = 0; i < detectLength && i < str.length; i++) {
      if (this.isBlank(str[i]))
        continue;
      for (const p of pattern) {
          if (str.startsWith(p, i))
            return true;
        }
      return false;
      }
    return false;
  }

  static nonBlankEndsWith(str: string, pattern: string[], detectLength= 1000): boolean {
    for (let i = str.length - 1; i >= 0 && i > str.length - detectLength; i--) {
      if (this.isBlank(str[i]))
        continue;
      for (const p of pattern) {
        if (str.endsWith(p, i + 1))
          return true;
      }
      return false;
    }
    return false;
  }

  static isBlank(str: string): boolean {
    return ' \n\r\t'.indexOf(str) >= 0;
  }

  /** Read head string in str upto length, and terminate the at the last line break within this head string */
  static topLines(str: string, length: number): {length: number, numLines: number} {
    const result = { length: -1, numLines: 0 };
    for (let i = Math.min(str.length, length); i >= 0; i--) {
      if (str[i] === '\n') {
        if (result.length < 0) 
          result.length = i + 1;
        result.numLines ++;
      }
    }
    return result;
  }

  public static doIf(condition: boolean, action: () => void) { if (condition) action(); }
}
