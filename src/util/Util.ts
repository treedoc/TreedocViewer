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
}
