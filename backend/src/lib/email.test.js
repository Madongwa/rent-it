import { describe, it, expect } from 'vitest';
import { escapeHtml, renderNotificationEmail } from './email.js';

describe('renderNotificationEmail', () => {
  it('escapes what people typed in the title and body', () => {
    const html = renderNotificationEmail({
      title: 'New message from <b>Ravi</b>',
      body: '<a href="https://evil.example">Verify your account</a> & "pay" now',
      link: '/messages?c=1',
    });
    expect(html).not.toContain('<a href="https://evil.example"');
    expect(html).not.toContain('<b>Ravi</b>');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;Verify your account&lt;/a&gt; &amp; &quot;pay&quot; now');
    expect(html).toContain('New message from &lt;b&gt;Ravi&lt;/b&gt;');
  });

  it('only links to a path on the site', () => {
    expect(renderNotificationEmail({ title: 't', link: '/messages?c=1&x=2' })).toContain('/messages?c=1&amp;x=2"');
    for (const link of ['//evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      const html = renderNotificationEmail({ title: 't', link });
      expect(html).not.toContain('evil.example');
      expect(html).not.toContain('javascript:');
    }
  });

  it('escapes quotes and handles empty values', () => {
    expect(escapeHtml(`a'b"c`)).toBe('a&#39;b&quot;c');
    expect(escapeHtml(null)).toBe('');
  });
});
