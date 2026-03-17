/** Read head string in str upto length, and terminate the at the last line break within this head string */
export function topLines(str: string, length: number): { length: number, numLines: number } {
    const result = { length: -1, numLines: 0 };
    for (let i = Math.min(str.length, length); i >= 0; i--) {
        if (str[i] === '\n') {
            if (result.length < 0)
                result.length = i + 1;
            result.numLines++;
        }
    }
    return result;
}