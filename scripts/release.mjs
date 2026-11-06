/**
 * Versionamento do Clearmic (no espírito do release.mjs do VOR).
 *
 *   node scripts/release.mjs --check            só valida (árvore limpa, branch main, tag inexistente)
 *   node scripts/release.mjs patch|minor|major  sobe a versão, faz commit "vX.Y.Z" e cria a tag local
 *   node scripts/release.mjs 1.2.3              idem, com versão explícita
 *
 * Nada é enviado ao GitHub. Para publicar (só com ok do Vitor):
 *   git push origin main --follow-tags
 * O workflow build.yml compila Windows/Linux/macOS e cria o GitHub Release ao receber a tag v*.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const sh = (c) => execSync(c, { encoding: 'utf8' }).trim();
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.error(`  ✗ ${m}`); process.exit(1); };

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const arg = process.argv[2];
const checkOnly = arg === '--check' || !arg;

const bump = (v, kind) => {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [a, b, c] = v.split('.').map(Number);
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  if (kind === 'patch') return `${a}.${b}.${c + 1}`;
  fail(`argumento inválido: ${kind} (use patch, minor, major ou X.Y.Z)`);
};

console.log(`\nClearmic ${pkg.version}\n`);
if (sh('git status --porcelain')) fail('há alterações não commitadas'); else ok('árvore limpa');
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') console.warn(`  ! branch atual é ${branch} (releases saem da main)`); else ok('branch main');

const next = checkOnly ? pkg.version : bump(pkg.version, arg);
if (sh(`git tag -l v${next}`)) fail(`a tag v${next} já existe`); else ok(`v${next} ainda não existe`);
if (checkOnly) { console.log('\nSó verificação. Nada foi alterado.\n'); process.exit(0); }

pkg.version = next;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.version = next; if (lock.packages?.['']) lock.packages[''].version = next;
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
sh('git add package.json package-lock.json');
sh(`git commit -m "v${next}"`);
sh(`git tag -a v${next} -m "Clearmic v${next}"`);
ok(`versão ${next} commitada e tag v${next} criada localmente`);
console.log(`\nPara publicar (somente com aprovação):\n  git push origin ${branch} --follow-tags\n`);
