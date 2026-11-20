import test from 'node:test';
import assert from 'node:assert/strict';

import { gitBlobSha1, splitSqlStatements } from '../migrate-lib.mjs';

test('splits top-level SQL statements only', () => {
  const source = `-- semicolon in comment ;
  SELECT 'a;b', \"quoted;identifier\";
  /* nested /* comment ; */ still comment */
  DO $$ BEGIN RAISE NOTICE 'inside; block'; END $$;
  SELECT 4;`;
  const statements = splitSqlStatements(source);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /a;b/);
  assert.match(statements[1], /inside; block/);
  assert.match(statements[2], /SELECT 4/);
});

test('supports tagged dollar-quoted bodies', () => {
  const statements = splitSqlStatements(`DO $body$ BEGIN PERFORM 1; PERFORM 2; END $body$; SELECT 3;`);
  assert.equal(statements.length, 2);
});

test('rejects unterminated SQL quoting', () => {
  assert.throws(() => splitSqlStatements(`SELECT 'unfinished`), /unterminated single/);
  assert.throws(() => splitSqlStatements(`DO $$ BEGIN`), /unterminated dollar/);
});

test('computes the Git blob SHA-1, not plain text SHA-1', () => {
  assert.equal(gitBlobSha1('test'), '30d74d258442c7c65512eafab474568dd706c430');
});
