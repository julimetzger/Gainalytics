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
    expect(
      ['Training (Sport) schreiben und lesen', 'Körpergewicht lesen', 'Verlauf lesen', 'Schlaf und Schritte lesen', 'Widerruf:', 'Gesundheitsdaten bleiben auf Ihrem Gerät'].filter(
        (text) => !policy.includes(text),
      ),
    ).toEqual([]);
    expect(policy).not.toContain('erhebt, speichert oder verarbeitet keine personenbezogenen Daten');
  });

  it('GH-619: names the opt-in transfer of sleep and steps to the user-configured AI provider instead of "no transfer to third parties"', () => {
    const policy = read('index.html');

    expect(policy).not.toContain('Alle Daten bleiben auf Ihrem Gerät. Gainalytics überträgt keine Gesundheitsdaten an uns oder an Dritte');
    expect(
      [
        'Ist im KI-Chat „Include sleep and steps“ eingeschaltet (standardmäßig aus)',
        'an den KI-Anbieter, den Sie selbst eingerichtet haben',
        'Darüber hinaus überträgt Gainalytics keine Gesundheitsdaten an uns oder an Dritte',
      ].filter((text) => !policy.replace(/\s+/g, ' ').includes(text)),
    ).toEqual([]);
  });
});
