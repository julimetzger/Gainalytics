export const compareArrays = <T>(a: T[], b: T[]): boolean => {
    return a.every((val, index) => val === b[index]) && b.every((val, index) => val === a[index]);
}
