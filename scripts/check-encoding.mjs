import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'out', 'coverage', 'dist', 'build']);
const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx',
  '.css', '.scss', '.sql', '.yml', '.yaml', '.txt', '.html', '.xml',
  '.svg', '.sh', '.ps1', '.toml', '.ini', '.env',
]);
const suspiciousText = [
  /Ã[\u0080-\u00bf]/u,
  /Â[\u0080-\u00bf]/u,
  /â€[\u0080-\u00bf]/u,
  /�/u,
  /¶»§q«\^/u,
];

const failures = [];
let checked = 0;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    const isEnvExample = entry.name === '.env.example';
    if (!textExtensions.has(extension) && !isEnvExample && entry.name !== '.gitattributes') continue;

    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');
    const bytes = await readFile(absolutePath);

    let content;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      failures.push(`${relativePath}: secuencia UTF-8 inválida`);
      continue;
    }

    checked += 1;

    if (content.startsWith('\uFEFF')) {
      failures.push(`${relativePath}: contiene BOM UTF-8; guardar como UTF-8 sin BOM`);
    }

    if (suspiciousText.some((pattern) => pattern.test(content))) {
      failures.push(`${relativePath}: posible mojibake o carácter de reemplazo`);
    }
  }
}

await walk(root);

if (failures.length > 0) {
  console.error('Falló el control de codificación:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`UTF-8 OK: ${checked} archivos de texto inspeccionados.`);
}
