import { describe, it, expect } from 'vitest';
import { workLinksSchema } from './schemas/workLinks';

describe('multiple work links', () => {
  it('accepts pasted bullets and Facebook links without a protocol, keeping query parameters', () => {
    const input = '-https://www.facebook.com/profile.php?id=123\nhttps://www.facebook.com/profile.php?id=456\nwww.facebook.com/profile.php?id=789';
    expect(workLinksSchema.parse(input)).toBe('https://www.facebook.com/profile.php?id=123\nhttps://www.facebook.com/profile.php?id=456\nhttps://www.facebook.com/profile.php?id=789');
    expect(workLinksSchema.parse('• https://example.com/a\n1. facebook.com/example')).toBe('https://example.com/a\nhttps://facebook.com/example');
  });
  it('accepts fifteen links and normalizes blank lines and Windows line endings', () => {
    const links = Array.from({length:15}, (_, i) => `https://www.facebook.com/example/posts/${i + 1}`);
    expect(workLinksSchema.parse(' \r\n' + links.join(' \r\n\r\n') + '\r\n')).toBe(links.join('\n'));
  });
  it('rejects a sixteenth link', () => {
    expect(workLinksSchema.safeParse(Array.from({length:16}, (_, i) => `https://example.com/${i}`).join('\n')).success).toBe(false);
  });
  it('checks every link and accepts an empty optional field', () => {
    expect(workLinksSchema.parse(' \n ')).toBe('');
    for (const invalid of ['javascript:alert(1)', 'https://user:password@example.com', 'not-a-link']) {
      expect(workLinksSchema.safeParse(`https://example.com/valid\n${invalid}`).success).toBe(false);
    }
  });
});
