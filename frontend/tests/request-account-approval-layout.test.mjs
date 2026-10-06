import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(
  new URL('../src/app/pages/RequestAccountApproval.tsx', import.meta.url),
  'utf8'
);

test('RequestAccountApproval locks root viewport without page-level scroll', () => {
  // Outermost root wrapper must lock viewport height and hide overflow
  assert.match(pageSource, /h-screen max-h-screen/);
  assert.match(pageSource, /overflow-hidden/);
  assert.doesNotMatch(pageSource, /<div[^>]*min-h-screen[^>]*AnimatedGISBackground/);

  // Header and footer must remain flex-shrink-0
  assert.match(pageSource, /<header[^>]*flex-shrink-0/);
  assert.match(pageSource, /<footer[^>]*flex-shrink-0/);
});

test('RequestAccountApproval isolates overflow inside main and card container', () => {
  // <main> container must clip overflow and flex-fill available space
  assert.match(pageSource, /<main[^>]*overflow-hidden[^>]*flex-1[^>]*min-h-0/);

  // Card <section> must have max-h-full and overflow-y-auto
  assert.match(pageSource, /<section[^>]*max-h-full[^>]*overflow-y-auto/);
});

test('RequestAccountApproval uses compact form spacing and field heights', () => {
  // Compact outer card padding
  assert.match(pageSource, /py-2 sm:px-6 sm:py-3/);

  // Compact field grid gap
  assert.match(pageSource, /gap-2 sm:grid-cols-2 sm:gap-2\.5/);

  // Compact vertical spacing between form groups
  assert.match(pageSource, /className="space-y-1\.5"/);

  // Inputs have compact height, padding, and font size
  assert.match(pageSource, /h-8 w-full rounded-lg[^>]*px-3 py-1 text-\[13px\]/);
});
