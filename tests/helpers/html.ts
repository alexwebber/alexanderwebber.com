// Reading the site's own built HTML in unit tests.
//
// A scanner, not a chain of regex replaces: each copy of a tag-stripping regex trips CodeQL's
// js/incomplete-multi-character-sanitization, which reads it as a security sanitiser. This only
// ever reads our own build output, so it isn't one.

/**
 * `html` with every tag replaced by a space, and the `drop` elements left out whole, contents
 * included (the text a page shows is what's left). A tag that never closes ends the text.
 */
export function stripTags(html: string, drop: readonly string[] = ['style', 'script']): string {
  let text = '';
  let at = 0;
  for (let open = html.indexOf('<'); open !== -1; open = html.indexOf('<', at)) {
    text += html.slice(at, open);
    const element = drop.find((name) => html.startsWith(`<${name}`, open));
    const close = element ? `</${element}>` : '>';
    const end = html.indexOf(close, open);
    if (end === -1) return text;
    if (!element) text += ' ';
    at = end + close.length;
  }
  return text + html.slice(at);
}
