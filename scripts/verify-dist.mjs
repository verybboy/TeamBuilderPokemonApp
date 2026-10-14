import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      if (entry.isSymbolicLink()) throw new Error(`Enlace no permitido: ${entry.name}`);
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(target) : [target];
    }),
  );
  return nested.flat();
}

try {
  const files = await filesIn(root);
  const relative = files.map((file) => path.relative(root, file).replaceAll('\\', '/'));
  for (const file of relative) {
    const allowed =
      file === 'index.html' ||
      file === 'THIRD_PARTY_NOTICES.txt' ||
      file === 'branding/torkoal.png' ||
      /^assets\/[\w-]+-[\w-]+\.(js|css)$/.test(file);
    if (!allowed) throw new Error(`Archivo ajeno al paquete de producción: ${file}`);
  }
  for (const required of ['index.html', 'branding/torkoal.png', 'THIRD_PARTY_NOTICES.txt']) {
    if (!relative.includes(required)) throw new Error(`Falta ${required}`);
  }
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  if (!references.some((url) => /^\/assets\/.+\.js$/.test(url))) {
    throw new Error('index.html no incluye el JavaScript compilado.');
  }
  for (const reference of references) {
    if (!reference.startsWith('/') || reference.startsWith('//')) {
      throw new Error(`Se espera un recurso local desde la raíz del dominio: ${reference}`);
    }
    const target = path.resolve(root, `.${reference}`);
    const contained = path.relative(root, target);
    if (contained.startsWith('..') || path.isAbsolute(contained)) {
      throw new Error(`Recurso fuera de dist/: ${reference}`);
    }
    if (!(await stat(target)).isFile()) throw new Error(`Recurso inexistente: ${reference}`);
  }
  for (const file of files.filter((entry) => entry.endsWith('.js'))) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+\.js)["']/g);
    for (const [, reference] of imports) {
      const target = path.resolve(path.dirname(file), reference);
      if (!files.includes(target)) {
        throw new Error(`Módulo importado inexistente: ${path.basename(file)} → ${reference}`);
      }
    }
  }
  const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
  const megabytes = sizes.reduce((sum, size) => sum + size, 0) / 1024 ** 2;
  console.log(`dist/ verificado: ${files.length} archivos, ${megabytes.toFixed(2)} MiB.`);
} catch (error) {
  console.error(`Paquete de producción inválido: ${error.message}`);
  process.exitCode = 1;
}
