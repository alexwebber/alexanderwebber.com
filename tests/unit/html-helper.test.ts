// tests/helpers/html.ts: the tests' reading of built HTML is only as good as this.
import { describe, expect, it } from 'vitest';
import { stripTags } from '../helpers/html.ts';

describe('stripTags', () => {
  it('turns tags into spaces, so words either side stay apart', () => {
    expect(stripTags('<p class="a">One</p><p>Two</p>')).toBe(' One  Two ');
  });

  it('leaves out styles and scripts, contents included', () => {
    expect(stripTags('a<style data-x>.b > .c { color: red }</style>d<script>if (1 < 2) go();</script>e')).toBe('ade');
  });

  it('leaves out the elements it is given, and only those', () => {
    expect(stripTags('<caption>Skip</caption>Keep<style>x</style>', ['caption'])).toBe('Keep x ');
  });

  it('keeps text with no tags, and text after the last tag', () => {
    expect(stripTags('plain')).toBe('plain');
    expect(stripTags('<b>a</b> tail')).toBe(' a  tail');
  });

  it('stops at a tag that never closes', () => {
    expect(stripTags('a<b')).toBe('a');
  });
});
