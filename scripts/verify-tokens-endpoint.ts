import { count } from 'drizzle-orm';
import { db } from '../src/db/client';
import { versiculosTokens } from '../src/db/schema';
import { listTokensForChapter } from '../src/db/queries';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function verifyTokensEndpoint(): Promise<void> {
  // 1. Check that versiculos_tokens has rows
  const [tokenCountRow] = await db.select({ total: count() }).from(versiculosTokens);
  const totalTokens = tokenCountRow?.total ?? 0;
  assert(totalTokens > 0, `Expected versiculos_tokens to have rows after import, got ${totalTokens}.`);
  console.info(`  Total tokens in DB: ${totalTokens}`);

  // 2. Verify Genesis 1 has tokens and known Strong code is present
  const genesis1Tokens = await listTokensForChapter({ version: 'spapddpt', libro: 'genesis', capitulo: 1 });
  assert(genesis1Tokens.length > 0, 'Expected tokens for Genesis chapter 1 (spapddpt).');

  // Genesis 1:1 "principio" should have H7225
  const t = genesis1Tokens.find((tok) => tok.codigoStrong === 'H7225');
  assert(t !== undefined, 'Expected H7225 (principio/beginning) in Genesis 1 tokens.');
  assert(t!.palabra === 'principio', `Expected palabra "principio" for H7225, got "${t!.palabra}".`);
  console.info(`  Genesis 1:1 "principio" → H7225 confirmed.`);

  // 3. Confirm position ordering is stable
  const v1Tokens = genesis1Tokens.filter((tok) => tok.versiculo === 1);
  for (let index = 0; index < v1Tokens.length - 1; index++) {
    assert(
      (v1Tokens[index]?.posicion ?? 0) < (v1Tokens[index + 1]?.posicion ?? 0),
      `Expected tokens in ascending posicion order at index ${index}.`,
    );
  }
  console.info(`  Position ordering for Genesis 1:1 tokens verified.`);

  // 4. Check tokens exist for several books (spot-check NT as well)
  const revelation1Tokens = await listTokensForChapter({ version: 'spapddpt', libro: 'apocalipsis', capitulo: 1 });
  assert(revelation1Tokens.length > 0, 'Expected tokens for Apocalipsis chapter 1 (nt spot check).');
  console.info(`  Apocalipsis 1 token count: ${revelation1Tokens.length}`);

  console.info('verify:tokens PASSED.');
}

verifyTokensEndpoint().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
