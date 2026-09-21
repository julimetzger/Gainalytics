import fs from 'fs';
import path from 'path';

/**
 * GH-450: the app UI must stay entirely English. This walks every .ts/.tsx
 * file under app/ and flags German text in the places users actually see it —
 * JSX text nodes and known "label-ish" props/keys (title, label, placeholder,
 * text, message, Alert.alert/Toast.show strings, ...). It deliberately does
 * NOT scan comments, variable/route names, or object keys, since German code
 * identifiers are out of scope for GH-450 as long as the user never sees them
 * (e.g. the `name="Analyse"` navigation route key, or the `useAlleExercises`
 * hook, must keep working).
 */

const APP_ROOT = path.resolve(__dirname, '../../app');

const GERMAN_INDICATOR_CHARS = /[äöüÄÖÜß]/;

// Distinctly-German words that have shown up (or are likely to show up) as
// leftover UI labels. Deliberately excludes German/English homographs like
// "Pause" that are legitimate English UI words in this app.
const GERMAN_WORDS = [
  'Gesamt', 'gesamt',
  'Analyse', // as rendered text, e.g. a tab/segment label — the navigation route key is not scanned
  'Bank', // German for "bench" — this is a lifting app, "Bank" is never a legitimate English UI word here
  'Speichern', 'Abbrechen', 'Löschen', 'Hinzufügen', 'Bearbeiten',
  'Einstellungen', 'Zurück', 'Fertig', 'Wiederholungen', 'Gewicht',
  'Sätze', 'Übung', 'Übungen', 'Trainingsplan', 'Wochen', 'Minuten',
  'Sekunden', 'Stunden', 'erfolgreich', 'Erfolgreich', 'ungültig',
  'erforderlich', 'Ergebnisse', 'Übersicht', 'Verlauf', 'Hinweis',
  'Achtung', 'Bestätigen', 'Warnung', 'Bitte', 'Kalorien', 'Notiz', 'Notizen',
];
const GERMAN_WORD_PATTERN = new RegExp(`\\b(${GERMAN_WORDS.join('|')})\\b`);

// JSX/object-literal keys whose string value is shown to the user.
const UI_TEXT_KEYS = [
  'title', 'label', 'placeholder', 'text', 'text1', 'text2', 'message',
  'description', 'hint', 'tabBarLabel', 'accessibilityLabel',
  'accessibilityHint', 'drawerLabel', 'header', 'subtitle', 'buttonText',
];
const KEY_PATTERN_GLOBAL = new RegExp(`\\b(${UI_TEXT_KEYS.join('|')})\\s*[:=]`, 'g');
const QUOTED_STRING_PATTERN = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

const JSX_TEXT_PATTERN = />([^<>{}\n]{2,})</g;

const ALERT_TOAST_PATTERN = /(?:Alert\.alert|Toast\.show)\(([\s\S]*?)\);/g;

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      return [fullPath];
    }
    return [];
  });
}

interface Finding {
  file: string;
  line: number;
  snippet: string;
}

function candidateStrings(fileContent: string): {value: string; line: number}[] {
  const results: {value: string; line: number}[] = [];
  const lines = fileContent.split('\n');

  lines.forEach((lineText, index) => {
    let keyMatch;
    KEY_PATTERN_GLOBAL.lastIndex = 0;
    while ((keyMatch = KEY_PATTERN_GLOBAL.exec(lineText)) !== null) {
      const searchFrom = keyMatch.index + keyMatch[0].length;
      QUOTED_STRING_PATTERN.lastIndex = searchFrom;
      const stringMatch = QUOTED_STRING_PATTERN.exec(lineText);
      // Only take a quoted string that immediately follows the key (allowing for a
      // short ternary/nullish-coalescing expression in between on the same line) —
      // this avoids picking up an unrelated string value from a sibling key on the
      // same line, e.g. `{value: 'gesamt', label: 'Total'}` must not flag 'gesamt'.
      if (stringMatch && stringMatch.index - searchFrom < 80) {
        const value = stringMatch[1] ?? stringMatch[2] ?? stringMatch[3] ?? '';
        if (value.trim().length > 0) {
          results.push({value, line: index + 1});
        }
      }
    }

    let jsxMatch;
    JSX_TEXT_PATTERN.lastIndex = 0;
    while ((jsxMatch = JSX_TEXT_PATTERN.exec(lineText)) !== null) {
      const value = jsxMatch[1].trim();
      if (value.length > 0 && /[a-zA-ZäöüÄÖÜß]/.test(value)) {
        results.push({value, line: index + 1});
      }
    }
  });

  let alertMatch;
  ALERT_TOAST_PATTERN.lastIndex = 0;
  while ((alertMatch = ALERT_TOAST_PATTERN.exec(fileContent)) !== null) {
    const block = alertMatch[1];
    const lineOfBlock = fileContent.slice(0, alertMatch.index).split('\n').length;
    let stringMatch;
    QUOTED_STRING_PATTERN.lastIndex = 0;
    while ((stringMatch = QUOTED_STRING_PATTERN.exec(block)) !== null) {
      const value = stringMatch[1] ?? stringMatch[2] ?? stringMatch[3] ?? '';
      if (value.trim().length > 0) {
        results.push({value, line: lineOfBlock});
      }
    }
  }

  return results;
}

describe('GH-450: no German text in the app UI', () => {
  const files = listSourceFiles(APP_ROOT);

  it('scans at least the known app source files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('contains no German UI text', () => {
    const findings: Finding[] = [];

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(path.resolve(__dirname, '../..'), filePath);

      candidateStrings(content).forEach(({value, line}) => {
        if (GERMAN_INDICATOR_CHARS.test(value) || GERMAN_WORD_PATTERN.test(value)) {
          findings.push({file: relativePath, line, snippet: value});
        }
      });
    });

    if (findings.length > 0) {
      const report = findings.map((f) => `  ${f.file}:${f.line} → "${f.snippet}"`).join('\n');
      throw new Error(`Found German-looking text in the app UI:\n${report}`);
    }
  });
});
