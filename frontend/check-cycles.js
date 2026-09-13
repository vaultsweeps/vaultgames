const fs = require('fs');
const path = require('path');

function getImports(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/from\s+['"]([^'"]+)['"]/);
    if (m) imports.push(m[1]);
    const m2 = line.match(/import\s+['"]([^'"]+)['"]/);
    if (m2) imports.push(m2[1]);
  }
  return imports;
}

const base = './src';
function resolve(from, imp) {
  if (imp.startsWith('@/')) {
    return path.join(base, imp.slice(2));
  }
  return path.resolve(path.dirname(from), imp);
}

function findFile(p) {
  const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
  for (const ext of exts) {
    if (fs.existsSync(p + ext)) return p + ext;
  }
  return null;
}

const target = './src/components/modals/ManualCashoutModal.tsx';
const visited = new Set();

function visit(file, chain) {
  const imports = getImports(file);
  console.log('\nImports of ' + file + ':');
  for (const imp of imports) {
    const resolved = resolve(file, imp);
    const found = findFile(resolved);
    console.log('  ' + imp + (found ? ' -> ' + found : ' (external/not found)'));
    if (!found) continue;
    const rel = path.relative('.', found).replace(/\\/g, '/');
    if (chain.includes(rel)) {
      console.log('  *** CYCLE DETECTED: ' + chain.join(' -> ') + ' -> ' + rel);
      continue;
    }
    if (!visited.has(rel) && rel.startsWith('src/')) {
      visited.add(rel);
      visit(found, [...chain, rel]);
    }
  }
}

visited.add(path.relative('.', target).replace(/\\/g, '/'));
visit(target, [path.relative('.', target).replace(/\\/g, '/')]);
