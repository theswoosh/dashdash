import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderMarkdownLite } from '../markdown-lite';

describe('renderMarkdownLite', () => {
  it('renders bold, italic, strike and inline code', () => {
    const { container } = render(<>{renderMarkdownLite('**bold** *it* ~~gone~~ `code`', 'chat-link')}</>);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('it');
    expect(container.querySelector('s')?.textContent).toBe('gone');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('never emits raw HTML from message content (XSS)', () => {
    const { container } = render(<>{renderMarkdownLite('**<img src=x onerror=alert(1)>**', 'chat-link')}</>);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toContain('<img');
  });

  it('leaves unformatted text untouched (still linkifies URLs)', () => {
    const { container } = render(<>{renderMarkdownLite('see https://example.com', 'chat-link')}</>);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });
});
