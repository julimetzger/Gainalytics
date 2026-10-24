#!/usr/bin/env node
/*
 * Generates THIRD-PARTY-NOTICES.md from
 *   1. npm: every non-dev package in package-lock.json (license field + LICENSE/NOTICE files
 *      from node_modules, so run `npm ci` first),
 *   2. Gradle: Android dependencies, either
 *      - from a Gradle dependency report (exact, includes transitives):
 *          cd android && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath > ../build/gradle-deps.txt
 *          node scripts/third-party-notices/generate.js --gradle-report build/gradle-deps.txt
 *      - or, without a report, from a static scan of android/app/build.gradle and the
 *        android/build.gradle of every autolinked native module (direct dependencies only),
 *   3. manual-entries.json: bundled assets and vendored code that no package manager describes
 *      (YOLO model, icon fonts, MMKV core, proprietary Google libraries).
 *
 * Apache NOTICE files: npm NOTICE files are copied verbatim. For Maven artifacts, NOTICE files are
 * extracted from the local Gradle cache (~/.gradle or $GRADLE_USER_HOME) when the artifacts are
 * there, i.e. after a Gradle build on the same machine.
 *
 * Usage:
 *   node scripts/third-party-notices/generate.js [--gradle-report <file>] [--out <file>] [--check]
 *
 * --check exits with 1 if the output file differs from what would be generated (for CI).
 * Output is deterministic: no timestamps, everything sorted.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const HERE = __dirname;
const LICENSE_TEXT_DIR = path.join(HERE, 'licenses');

function parseArgs(argv) {
  const args = {out: path.join(ROOT, 'THIRD-PARTY-NOTICES.md'), gradleReport: null, check: false};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--gradle-report') args.gradleReport = path.resolve(argv[++i]);
    else if (a === '--check') args.check = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const normalizeText = (t) =>
  t
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function spdxText(id) {
  const p = path.join(LICENSE_TEXT_DIR, `${id}.txt`);
  return fs.existsSync(p) ? normalizeText(fs.readFileSync(p, 'utf8')) : null;
}

// ---------------------------------------------------------------------------------------------
// npm
// ---------------------------------------------------------------------------------------------

const LICENSE_FILE_RE = /^(licen[cs]e|copying|unlicense)([-._].*)?$/i;
const NOTICE_FILE_RE = /^notice([-._].*)?$/i;

function npmLicenseOf(pkgJson, lockEntry) {
  const l = pkgJson.license ?? lockEntry.license;
  if (typeof l === 'string') return l;
  if (l && typeof l === 'object' && l.type) return l.type;
  if (Array.isArray(pkgJson.licenses)) return pkgJson.licenses.map((x) => x.type || x).join(' OR ');
  return null;
}

function authorOf(pkgJson) {
  const a = pkgJson.author;
  if (!a) return null;
  return typeof a === 'string' ? a.replace(/\s*<[^>]*>/, '') : a.name || null;
}

function collectNpm() {
  const lock = readJson(path.join(ROOT, 'package-lock.json'));
  const out = [];
  const problems = [];
  for (const [key, entry] of Object.entries(lock.packages || {})) {
    if (!key || entry.dev || entry.devOptional || entry.link) continue;
    // Platform-specific optional packages (e.g. fsevents on macOS) would make the output differ
    // between machines; none of them ends up in the APK.
    if (entry.optional && (entry.os || entry.cpu)) continue;
    const dir = path.join(ROOT, key);
    const pkgFile = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgFile)) {
      // Optional platform packages (e.g. fsevents on Linux) are not installed.
      if (!entry.optional) problems.push(`${key}: not installed (run npm ci)`);
      continue;
    }
    const pkg = readJson(pkgFile);
    const files = fs.readdirSync(dir).sort();
    const licenseFiles = files.filter((f) => LICENSE_FILE_RE.test(f) && fs.statSync(path.join(dir, f)).isFile());
    const noticeFiles = files.filter((f) => NOTICE_FILE_RE.test(f) && fs.statSync(path.join(dir, f)).isFile());
    const license = npmLicenseOf(pkg, entry);
    if (!license) problems.push(`${key}: no license field`);
    const name = key.replace(/^.*node_modules\//, '');
    out.push({
      name,
      version: pkg.version || entry.version,
      license: license || 'UNKNOWN',
      repository: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || null,
      author: authorOf(pkg),
      licenseTexts: licenseFiles.map((f) => ({file: f, text: normalizeText(fs.readFileSync(path.join(dir, f), 'utf8'))})),
      notices: noticeFiles.map((f) => ({file: f, text: normalizeText(fs.readFileSync(path.join(dir, f), 'utf8'))})),
    });
  }
  // The same name@version can appear at several nesting levels; keep one.
  const seen = new Map();
  for (const p of out) {
    const id = `${p.name}@${p.version}`;
    if (!seen.has(id)) seen.set(id, p);
  }
  return {packages: [...seen.values()].sort((a, b) => byName(a, b) || (a.version < b.version ? -1 : 1)), problems};
}

// ---------------------------------------------------------------------------------------------
// Gradle
// ---------------------------------------------------------------------------------------------

function rnVersionCatalog() {
  const p = path.join(ROOT, 'node_modules/react-native/gradle/libs.versions.toml');
  const versions = {};
  if (!fs.existsSync(p)) return versions;
  let inVersions = false;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (/^\[/.test(line)) inVersions = line.trim() === '[versions]';
    else if (inVersions) {
      const m = line.match(/^([\w-]+)\s*=\s*"([^"]+)"/);
      if (m) versions[m[1]] = m[2];
    }
  }
  return versions;
}

function nativeModuleDirs() {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  return Object.keys(pkg.dependencies || {})
    .sort()
    .map((name) => ({name, dir: path.join(ROOT, 'node_modules', name, 'android')}))
    .filter((m) => fs.existsSync(path.join(m.dir, 'build.gradle')) || fs.existsSync(path.join(m.dir, 'build.gradle.kts')));
}

const DEP_RE = /^\s*(implementation|api)\s*\(?\s*(?:group:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]\s*,\s*version:\s*['"]([^'"]+)['"]|['"]([^'"]+)['"])/;

function staticGradleScan() {
  const catalog = rnVersionCatalog();
  const files = [{via: 'app', file: path.join(ROOT, 'android/app/build.gradle')}];
  for (const m of nativeModuleDirs()) {
    const f = fs.existsSync(path.join(m.dir, 'build.gradle')) ? path.join(m.dir, 'build.gradle') : path.join(m.dir, 'build.gradle.kts');
    files.push({via: m.name, file: f});
  }
  const deps = new Map();
  for (const {via, file} of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (/^\s*\/\//.test(line)) continue;
      const m = line.match(DEP_RE);
      if (!m) continue;
      let coord = m[5] || `${m[2]}:${m[3]}:${m[4]}`;
      if (!/^[\w.-]+:[\w.-]+/.test(coord)) continue; // project(...) or fileTree(...)
      const [group, artifact, rawVersion = ''] = coord.split(':');
      let version = rawVersion.replace(/@.*$/, '');
      if (group === 'com.facebook.fresco') version = catalog.fresco || version;
      if (/\$|^\+$|^$/.test(version)) version = group.startsWith('com.facebook.react') ? 'bundled with react-native' : 'resolved at build time';
      const id = `${group}:${artifact}`;
      const prev = deps.get(id);
      if (prev) prev.via.add(via);
      else deps.set(id, {group, artifact, version, via: new Set([via])});
    }
  }
  return [...deps.values()];
}

function parseGradleReport(file) {
  // Lines look like: "+--- androidx.core:core:1.13.1 -> 1.16.0 (*)",
  // "+--- com.facebook.react:hermes-android -> 0.84.1" (no requested version, e.g. BOM/plugin-managed)
  // or "\--- project :react-native-mmkv" (skipped).
  const deps = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/[+\\]--- ([\w.-]+):([\w.-]+)(?::([^\s]+))?(?:\s+->\s+([^\s]+))?/);
    if (!m) continue;
    const [, group, artifact, requested, resolved] = m;
    if (!requested && !resolved) continue;
    const version = (resolved || requested).replace(/[()*]/g, '');
    const id = `${group}:${artifact}`;
    if (!deps.has(id)) deps.set(id, {group, artifact, version, via: new Set(['gradle report'])});
  }
  return [...deps.values()];
}

function gradleLicenseLookup() {
  const table = readJson(path.join(HERE, 'gradle-licenses.json')).licenses;
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  return (group, artifact) => {
    const id = `${group}:${artifact}`;
    for (const k of keys) {
      if (k === id) return table[k];
      if (k.endsWith('*')) {
        const prefix = k.slice(0, -1);
        if (id.startsWith(prefix)) return table[k];
      }
    }
    return null;
  };
}

function gradleCacheNotices(group, artifact, version) {
  const home = process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle');
  const base = path.join(home, 'caches/modules-2/files-2.1', group, artifact, version);
  if (!fs.existsSync(base)) return [];
  const notices = [];
  for (const hashDir of fs.readdirSync(base).sort()) {
    const dir = path.join(base, hashDir);
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/\.(jar|aar)$/.test(f) || /-sources\.jar$/.test(f)) continue;
      const archive = path.join(dir, f);
      let listing = '';
      try {
        listing = execFileSync('unzip', ['-Z1', archive], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
      } catch {
        continue;
      }
      for (const entry of listing.split('\n').filter((e) => /(^|\/)NOTICE(\.txt|\.md)?$/i.test(e))) {
        try {
          const text = execFileSync('unzip', ['-p', archive, entry], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
          notices.push({file: `${f}!/${entry}`, text: normalizeText(text)});
        } catch {
          /* ignore unreadable entries */
        }
      }
    }
  }
  return notices;
}

function collectGradle(reportFile) {
  const raw = reportFile ? parseGradleReport(reportFile) : staticGradleScan();
  const lookup = gradleLicenseLookup();
  const problems = [];
  const deps = raw
    .map((d) => {
      const info = lookup(d.group, d.artifact);
      if (!info) problems.push(`${d.group}:${d.artifact}: no entry in gradle-licenses.json`);
      return {
        name: `${d.group}:${d.artifact}`,
        version: d.version,
        license: info?.license || 'UNKNOWN',
        copyright: info?.copyright || null,
        via: [...d.via].sort(),
        notices: reportFile ? gradleCacheNotices(d.group, d.artifact, d.version) : [],
      };
    })
    .sort(byName);
  return {deps, problems, mode: reportFile ? 'report' : 'static'};
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

// SPDX ids whose text applies to a license expression. For "A OR B" Gainalytics uses the first option.
function spdxIdsUsed(expr) {
  const clean = String(expr).replace(/[()]/g, '');
  const chosen = clean.split(/\s+OR\s+/)[0];
  return chosen
    .split(/\s+AND\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const mdEscape = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

function fence(text) {
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((s) => s.length));
  const f = '`'.repeat(longest + 1);
  return `${f}text\n${text}\n${f}`;
}

function render(npm, gradle, manual) {
  const L = [];
  const usedSpdx = new Set();
  L.push('# Third-Party Notices');
  L.push('');
  L.push('<!-- GENERATED FILE. Do not edit by hand. Run `node scripts/third-party-notices/generate.js` (see the script header). -->');
  L.push('');
  L.push('Gainalytics is licensed under the GNU Affero General Public License v3.0 or later with an additional');
  L.push('permission under section 7 (see [`LICENSE`](LICENSE)). It includes or links the third-party');
  L.push('components listed below, which remain under their own licenses.');
  L.push('');
  L.push('Contents:');
  L.push('');
  L.push('1. [Bundled assets and vendored code](#1-bundled-assets-and-vendored-code)');
  L.push('2. [Icon fonts](#2-icon-fonts)');
  L.push('3. [Android (Gradle) dependencies](#3-android-gradle-dependencies)');
  L.push('4. [npm packages](#4-npm-packages)');
  L.push('5. [Apache NOTICE files](#5-apache-notice-files)');
  L.push('6. [License texts](#6-license-texts)');
  L.push('');

  // 1. manual components
  L.push('## 1. Bundled assets and vendored code');
  L.push('');
  for (const c of manual.components) {
    L.push(`### ${c.name}`);
    L.push('');
    L.push(`- License: \`${c.license}\``);
    L.push(`- Copyright: ${c.copyright}`);
    L.push(`- Source: <${c.source}>`);
    if (c.files.length) L.push(`- Files: ${c.files.map((f) => `\`${f}\``).join(', ')}`);
    L.push(`- Distribution: ${c.shipped}`);
    if (c.notes) L.push(`- Notes: ${c.notes}`);
    L.push('');
    c.license.split(/\s+AND\s+|\s+OR\s+/).forEach((id) => usedSpdx.add(id.replace(/[()]/g, '')));
  }

  // 2. icon fonts
  L.push('## 2. Icon fonts');
  L.push('');
  L.push(`The following fonts from \`${manual.iconFonts.package}\` are copied into the APK.`);
  L.push('');
  L.push('| Font file | Icon set | License | Copyright | Source |');
  L.push('|---|---|---|---|---|');
  for (const f of manual.iconFonts.fonts) {
    L.push(`| \`${f.file}\` | ${mdEscape(f.name)} | \`${f.license}\` | ${mdEscape(f.copyright)} | <${f.source}> |`);
    f.license.split(/\s+AND\s+|\s+OR\s+/).forEach((id) => usedSpdx.add(id));
  }
  L.push('');
  for (const f of manual.iconFonts.fonts.filter((x) => x.notes)) L.push(`- \`${f.file}\`: ${f.notes}`);
  L.push('- Entypo pictograms by Daniel Bruce are licensed under CC BY-SA 4.0; the font file is redistributed unmodified.');
  L.push('- Font Awesome Free: icons CC BY 4.0, fonts SIL OFL 1.1 ("Font Awesome" is a Reserved Font Name), code MIT.');
  L.push('');

  // 3. Gradle
  L.push('## 3. Android (Gradle) dependencies');
  L.push('');
  if (gradle.mode === 'static') {
    L.push('Direct dependencies declared in `android/app/build.gradle` and in the `android/build.gradle` of each');
    L.push('autolinked native module (static scan; transitive dependencies are not listed). For an exact list');
    L.push('including transitive dependencies, regenerate with `--gradle-report` (see the script header).');
  } else {
    L.push('Resolved `releaseRuntimeClasspath` of the `app` module, including transitive dependencies.');
  }
  L.push('');
  L.push('| Artifact | Version | License | Copyright | Declared by |');
  L.push('|---|---|---|---|---|');
  for (const d of gradle.deps) {
    L.push(`| \`${d.name}\` | ${mdEscape(d.version)} | \`${d.license}\` | ${mdEscape(d.copyright)} | ${mdEscape(d.via.join(', '))} |`);
    d.license.split(/\s+AND\s+|\s+OR\s+/).forEach((id) => usedSpdx.add(id));
  }
  L.push('');
  L.push('`LicenseRef-Android-SDK`: proprietary, [Android Software Development Kit License Agreement](https://developer.android.com/studio/terms).');
  L.push('Not covered by the AGPL; see the section 7 additional permission in `LICENSE`.');
  L.push('');

  // 4. npm
  L.push('## 4. npm packages');
  L.push('');
  L.push('All non-dev packages from `package-lock.json`. This is a superset of what ends up in the APK: it also');
  L.push('contains React Native build tooling (Metro, CLI, codegen) that is only used at build time.');
  L.push('Where a package lists `A OR B`, Gainalytics uses it under the first permissive option.');
  L.push('');
  const counts = {};
  for (const p of npm.packages) counts[p.license] = (counts[p.license] || 0) + 1;
  L.push('| License | Packages |');
  L.push('|---|---|');
  for (const [lic, n] of Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) L.push(`| \`${mdEscape(lic)}\` | ${n} |`);
  L.push('');
  L.push('| Package | Version | License | Repository |');
  L.push('|---|---|---|---|');
  for (const p of npm.packages) {
    const repo = p.repository
      ? p.repository
          .replace(/^git\+/, '')
          .replace(/\.git$/, '')
          .replace(/^git:\/\//, 'https://')
          .replace(/^github:/, 'https://github.com/')
      : '';
    L.push(`| \`${p.name}\` | ${p.version} | \`${mdEscape(p.license)}\` | ${mdEscape(repo)} |`);
  }
  L.push('');
  L.push('### npm license texts');
  L.push('');
  L.push('License files as shipped by each package. Identical texts are printed once and list every package');
  L.push('that uses them.');
  L.push('');
  const groups = new Map();
  for (const p of npm.packages) {
    let texts = p.licenseTexts.map((t) => t.text);
    if (!texts.length) {
      const ids = spdxIdsUsed(p.license);
      ids.forEach((id) => usedSpdx.add(id));
      texts = [`${p.name} does not ship a license file. Its package.json declares "${p.license}"${p.author ? ` (author: ${p.author})` : ''}. See ${ids.join(' / ')} in section 6.`];
    }
    for (const t of texts) {
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(`${p.name}@${p.version}`);
    }
  }
  const sortedGroups = [...groups.entries()].map(([text, pkgs]) => ({text, pkgs: [...new Set(pkgs)].sort()})).sort((a, b) => (a.pkgs[0] < b.pkgs[0] ? -1 : 1));
  for (const g of sortedGroups) {
    L.push(`<details><summary>${g.pkgs.map(mdEscape).join(', ')}</summary>`);
    L.push('');
    L.push(fence(g.text));
    L.push('');
    L.push('</details>');
    L.push('');
  }

  // 5. NOTICE files
  L.push('## 5. Apache NOTICE files');
  L.push('');
  const notices = [
    ...npm.packages.flatMap((p) => p.notices.map((n) => ({owner: `${p.name}@${p.version}`, ...n}))),
    ...gradle.deps.flatMap((d) => d.notices.map((n) => ({owner: `${d.name}:${d.version}`, ...n}))),
  ];
  if (!notices.length) {
    L.push('No NOTICE file was found in the shipped npm packages.');
    if (gradle.mode === 'static') {
      L.push('Maven artifacts were not inspected (static Gradle scan); regenerate with `--gradle-report` after a');
      L.push('Gradle build to extract NOTICE files from the AAR/JAR files in the Gradle cache.');
    } else {
      L.push('No NOTICE file was found in the resolved Maven artifacts available in the local Gradle cache.');
    }
    L.push('');
  }
  for (const n of notices) {
    L.push(`### ${n.owner} (\`${n.file}\`)`);
    L.push('');
    L.push(fence(n.text));
    L.push('');
  }

  // 6. full texts of licenses referenced by sections 1-3
  L.push('## 6. License texts');
  L.push('');
  L.push('Full texts of the licenses referenced above (from the SPDX License List). The AGPL-3.0');
  L.push('text is in [`LICENSE`](LICENSE).');
  L.push('');
  const ids = [...usedSpdx].filter((id) => id && id !== 'AGPL-3.0' && id !== 'UNKNOWN' && !id.startsWith('LicenseRef-')).sort();
  for (const id of ids) {
    const text = spdxText(id);
    L.push(`<details><summary>${id}</summary>`);
    L.push('');
    L.push(text ? fence(text) : `See <https://spdx.org/licenses/${id}.html>.`);
    L.push('');
    L.push('</details>');
    L.push('');
  }
  return (
    L.join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

function main() {
  const args = parseArgs(process.argv);
  const npm = collectNpm();
  const gradle = collectGradle(args.gradleReport);
  const manual = readJson(path.join(HERE, 'manual-entries.json'));
  const output = render(npm, gradle, manual);

  const problems = [...npm.problems, ...gradle.problems];
  for (const p of problems) console.warn(`warning: ${p}`);

  // A missing (non-optional) package means node_modules is absent or incomplete: the inventory
  // would silently shrink, so neither write it nor accept it in --check.
  const missing = npm.problems.filter(p => p.endsWith('not installed (run npm ci)'));
  if (missing.length > 0 || npm.packages.length === 0) {
    console.error(
      `error: ${missing.length} required npm package(s) are not installed (${npm.packages.length} found). Run npm ci first; nothing was written.`,
    );
    process.exit(1);
  }

  if (args.check) {
    const current = fs.existsSync(args.out) ? fs.readFileSync(args.out, 'utf8') : '';
    if (current !== output) {
      console.error(`${path.relative(ROOT, args.out)} is out of date. Run: node scripts/third-party-notices/generate.js`);
      process.exit(1);
    }
    console.log(`${path.relative(ROOT, args.out)} is up to date.`);
    return;
  }
  fs.writeFileSync(args.out, output);
  console.log(
    `Wrote ${path.relative(ROOT, args.out)}: ${npm.packages.length} npm packages, ${gradle.deps.length} Gradle artifacts (${gradle.mode}), ${manual.components.length} manual entries, ${
      manual.iconFonts.fonts.length
    } icon fonts.`,
  );
}

main();
