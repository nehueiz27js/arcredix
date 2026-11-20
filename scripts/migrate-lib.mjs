import { createHash } from 'node:crypto';

export function gitBlobSha1(content) {
  const bytes = Buffer.from(content, 'utf8');
  const header = Buffer.from('blob ' + bytes.length + '\0', 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

export function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let i = 0;
  let state = 'normal';
  let blockDepth = 0;
  let dollarTag = null;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'single') {
      if (char === '\\') { i += 2; continue; }
      if (char === "'") {
        if (next === "'") { i += 2; continue; }
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 'double') {
      if (char === '"') {
        if (next === '"') { i += 2; continue; }
        state = 'normal';
      }
      i += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') state = 'normal';
      i += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (char === '/' && next === '*') { blockDepth += 1; i += 2; continue; }
      if (char === '*' && next === '/') {
        blockDepth -= 1;
        i += 2;
        if (blockDepth === 0) state = 'normal';
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'dollar') {
      if (source.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        state = 'normal';
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (char === "'") { state = 'single'; i += 1; continue; }
    if (char === '"') { state = 'double'; i += 1; continue; }
    if (char === '-' && next === '-') { state = 'line-comment'; i += 2; continue; }
    if (char === '/' && next === '*') { state = 'block-comment'; blockDepth = 1; i += 2; continue; }

    if (char === '$') {
      const match = source.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*|)\$/);
      if (match) {
        dollarTag = match[0];
        state = 'dollar';
        i += dollarTag.length;
        continue;
      }
    }

    if (char === ';') {
      const statement = source.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
    i += 1;
  }

  if (state === 'single' || state === 'double' || state === 'block-comment' || state === 'dollar') {
    throw new Error('SQL migration ended inside an unterminated ' + state + ' construct.');
  }

  const finalStatement = source.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}
