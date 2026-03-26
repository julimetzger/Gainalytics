export function ensureFormat(value: string): string {
  return value.replace(',', '.');
}

export function convertToNumber(value: string) {
  return Number.parseFloat(ensureFormat(value));
}

export function convertToInteger(value: string) {
  return Number.parseInt(ensureFormat(value), 10);
}
