// The contract library's one rule, kept pure for the tests: what a heading or a line may be.
// One line of plain text, whitespace folded, no control characters, within the length given.

export function cleanLibraryText(value, max) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
