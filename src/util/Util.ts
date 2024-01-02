export default class Util {
  static nonBlankStartsWith(str: string, pattern: string[], detectLength = 1000): boolean {
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

  public static textLimit(text: string, limit: number, suffix = '...'): string {
    if (typeof text !== 'string')
      text = JSON.stringify(text);
    if (!text || text.length <= limit)
      return text;
    return text.substring(0, limit) + suffix;
  }

  public static toFixed(value: number, precision: number): string {
    const power = Math.pow(10, precision || 0);
    return String(Math.round(value * power) / power);
  }

  public static head(array: any[], n = 1) { return array.slice(0, n); }
  
}

export function memoize<T extends (...args:any[])=>any>(func: T): T {
  let cachedKey: any[] | null = null;
  let cachedValue: any = null;
  const res = function (...args: any[]) {
    if (isArrayEquals(args, cachedKey))
      return cachedValue;
    const result = func(...args);
    cachedKey = args;
    cachedValue = result;
    return result
    }
  return res as T
}

function isArrayEquals(a1: any[] | null, a2: any[] | null) {
  if (a1 == null && a2 == null)
    return true;
  if (a1 == null || a2 == null)
    return false;

  return a1.length === a2.length && a1.every((v, i) => v === a2[i]);
}
