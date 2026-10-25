import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('GH-528 privacy policy', () => {
  it('the policy shown by Health Connect (rationale activity) is the published one', () => {
    expect(read('android/app/src/main/assets/privacy-policy.html')).toBe(read('index.html'));
  });

  it('has a health data section naming what is read and written and how to revoke it', () => {
    const policy = read('index.html');

    expect(policy).toContain('<h2 id="gesundheitsdaten">4. Gesundheitsdaten (Health Connect)</h2>');
    expect(['Training (Sport) schreiben und lesen', 'Körpergewicht lesen', 'Verlauf lesen', 'Widerruf:', 'Alle Daten bleiben auf Ihrem Gerät'].filter((text) => !policy.includes(text))).toEqual([]);
    expect(policy).not.toContain('erhebt, speichert oder verarbeitet keine personenbezogenen Daten');
  });
});
