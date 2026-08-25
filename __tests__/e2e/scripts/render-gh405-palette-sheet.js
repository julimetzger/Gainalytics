/**
 * GH-405 helper: renders the generated colour schemes for a set of source
 * colours into a PPM contact sheet (convert to PNG with ffmpeg) and prints the
 * role -> hex mapping plus the WCAG contrast ratio of every on-colour pair.
 *
 * This is offline evidence for the colour system itself; it does not replace
 * on-device screenshots.
 *
 * Usage: node __tests__/e2e/scripts/render-gh405-palette-sheet.js <out.ppm>
 */
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

// Minimal TS require hook — the theme modules are plain TypeScript with no
// React Native imports, so Babel alone is enough to load them in Node.
require.extensions['.ts'] = (module, filename) => {
  const {code} = babel.transformFileSync(filename, {
    filename,
    babelrc: false,
    configFile: false,
    presets: [
      ['@babel/preset-env', {targets: {node: 'current'}}],
      '@babel/preset-typescript',
    ],
  });
  module._compile(code, filename);
};

const {buildDynamicSchemes, READABILITY_PAIRS} = require(
  path.join(__dirname, '../../../app/theme/dynamicTheme.ts'),
);
const {contrastRatio, parseColor} = require(
  path.join(__dirname, '../../../app/theme/colorScience.ts'),
);

const SOURCES = [
  ['very light', '#FFF7B2'],
  ['very dark', '#101820'],
  ['neon saturated', '#FF00E5'],
  ['pink', '#E91E63'],
  ['teal', '#00897B'],
  ['grey', '#808080'],
];

const ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'secondaryContainer',
  'tertiary',
  'tertiaryContainer',
  'error',
  'errorContainer',
  'background',
  'onBackground',
  'surfaceVariant',
  'onSurfaceVariant',
  'outline',
  'inverseSurface',
];

const CELL = 64;
const GAP = 4;

function main() {
  const outPath = process.argv[2] || 'palette-sheet.ppm';

  const rows = SOURCES.length * 2; // light + dark per source
  const cols = ROLES.length + 1; // leading source swatch
  const width = cols * (CELL + GAP) + GAP;
  const height = rows * (CELL + GAP) + GAP;

  const pixels = Buffer.alloc(width * height * 3, 0x20);

  const fill = (x0, y0, w, h, hex) => {
    const rgb = parseColor(hex) || {r: 0, g: 0, b: 0};
    for (let y = y0; y < y0 + h && y < height; y++) {
      for (let x = x0; x < x0 + w && x < width; x++) {
        const i = (y * width + x) * 3;
        pixels[i] = Math.round(rgb.r);
        pixels[i + 1] = Math.round(rgb.g);
        pixels[i + 2] = Math.round(rgb.b);
      }
    }
  };

  const report = [];
  let row = 0;

  for (const [label, source] of SOURCES) {
    const schemes = buildDynamicSchemes(source);
    for (const mode of ['light', 'dark']) {
      const scheme = schemes[mode];
      const y = GAP + row * (CELL + GAP);
      fill(GAP, y, CELL, CELL, source);
      ROLES.forEach((role, index) => {
        fill(GAP + (index + 1) * (CELL + GAP), y, CELL, CELL, scheme[role]);
      });

      report.push(`\n${label} ${source} — ${mode}`);
      report.push(`  row ${row}: source, ${ROLES.join(', ')}`);
      report.push(`  ${ROLES.map((r) => `${r}=${scheme[r]}`).join(' ')}`);
      const ratios = READABILITY_PAIRS.map(([fg, bg]) => {
        const ratio = contrastRatio(scheme[fg], scheme[bg]);
        return `${fg}/${bg}=${ratio.toFixed(2)}`;
      });
      report.push(`  contrast: ${ratios.join(' ')}`);
      const worst = Math.min(
        ...READABILITY_PAIRS.map(([fg, bg]) => contrastRatio(scheme[fg], scheme[bg])),
      );
      report.push(`  worst contrast ratio: ${worst.toFixed(2)} (WCAG AA needs 4.5)`);
      row++;
    }
  }

  fs.writeFileSync(outPath, Buffer.concat([
    Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii'),
    pixels,
  ]));

  console.log(`Wrote ${outPath} (${width}x${height})`);
  console.log(`Column order: source | ${ROLES.join(' | ')}`);
  console.log(report.join('\n'));
}

main();
