/**
 * Minimal RFC 4180 CSV reader/writer for the Strong CSV import/export (GH-496).
 * Handles quoted fields, escaped quotes (""), delimiters and line breaks inside
 * quotes, CRLF line endings and a UTF-8 byte order mark.
 */

/** Strong 6.x writes `;`, older Strong versions `,`. Pick whichever the header uses more. */
export function detectDelimiter(text: string): ',' | ';' {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => firstLine.split(char).length - 1;
  return count(';') > count(',') ? ';' : ',';
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(input: string, delimiter: string): string[][] {
  const text = stripBom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // Skip blank lines (a lone empty field), e.g. the trailing newline.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else if (char === '\n') {
      endRow();
    } else {
      field += char;
    }
    i++;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Quotes every field like Strong does (`"a";"b"`), doubling embedded quotes. */
export function serializeCsv(rows: (string | number)[][], delimiter: string): string {
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(delimiter)).join('\n') + '\n';
}
