/**
 * Sanitization Tests
 * 
 * Tests for HTML sanitization to ensure security.
 */

import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { ALLOWED_TAGS, ALLOWED_ATTRS } from '../src/const';

// Setup DOMPurify with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Helper function that mimics the card's sanitization
function sanitize(content: string, trusted = false): string {
  if (trusted) {
    return content;
  }

  return purify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
  });
}

describe('HTML Sanitization', () => {
  describe('Safe content', () => {
    it('should allow basic HTML elements', () => {
      const input = '<div class="test"><span>Hello</span></div>';
      const result = sanitize(input);
      expect(result).toContain('<div');
      expect(result).toContain('<span');
      expect(result).toContain('Hello');
    });

    it('should allow Tailwind classes', () => {
      const input = '<div class="flex items-center gap-4 p-4 bg-blue-500">Content</div>';
      const result = sanitize(input);
      expect(result).toContain('flex items-center gap-4 p-4 bg-blue-500');
    });

    it('should allow ha-icon elements', () => {
      const input = '<ha-icon icon="mdi:thermometer"></ha-icon>';
      const result = sanitize(input);
      expect(result).toContain('<ha-icon');
      expect(result).toContain('mdi:thermometer');
    });

    it('should allow data-ha-action attributes', () => {
      const input = '<button data-ha-action="tap" data-entity="light.test">Click</button>';
      const result = sanitize(input);
      expect(result).toContain('data-ha-action="tap"');
      expect(result).toContain('data-entity="light.test"');
    });

    it('should allow aria attributes', () => {
      const input = '<button aria-label="Toggle light" aria-pressed="true">Toggle</button>';
      const result = sanitize(input);
      expect(result).toContain('aria-label');
      expect(result).toContain('aria-pressed');
    });

    it('should allow style attributes', () => {
      const input = '<div style="color: red; font-size: 16px;">Styled</div>';
      const result = sanitize(input);
      expect(result).toContain('style=');
    });

    it('should allow images with src', () => {
      const input = '<img src="/local/image.png" alt="Test image">';
      const result = sanitize(input);
      expect(result).toContain('<img');
      expect(result).toContain('src="/local/image.png"');
      expect(result).toContain('alt="Test image"');
    });

    it('should allow links with href', () => {
      const input = '<a href="/lovelace/lights" target="_blank">Lights</a>';
      const result = sanitize(input);
      expect(result).toContain('<a');
      expect(result).toContain('href="/lovelace/lights"');
    });

    it('should allow tables', () => {
      const input = '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>';
      const result = sanitize(input);
      expect(result).toContain('<table');
      expect(result).toContain('<thead');
      expect(result).toContain('<tbody');
      expect(result).toContain('<tr');
      expect(result).toContain('<th');
      expect(result).toContain('<td');
    });

    it('should allow SVG elements', () => {
      const input = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"></circle></svg>';
      const result = sanitize(input);
      expect(result).toContain('<svg');
      expect(result).toContain('<circle');
    });
  });

  describe('Unsafe content removal', () => {
    it('should remove script tags', () => {
      const input = '<div>Safe</div><script>alert("XSS")</script>';
      const result = sanitize(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe');
    });

    it('should remove inline event handlers', () => {
      const input = '<button onclick="alert(1)">Click</button>';
      const result = sanitize(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('Click');
    });

    it('should remove onload handlers', () => {
      const input = '<img src="x" onload="alert(1)">';
      const result = sanitize(input);
      expect(result).not.toContain('onload');
    });

    it('should remove onerror handlers', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const result = sanitize(input);
      expect(result).not.toContain('onerror');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitize(input);
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: URLs in links', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const result = sanitize(input);
      expect(result).not.toContain('data:text/html');
    });

    it('should remove iframe elements', () => {
      const input = '<iframe src="https://evil.com"></iframe>';
      const result = sanitize(input);
      expect(result).not.toContain('<iframe');
    });

    it('should remove object elements', () => {
      const input = '<object data="malicious.swf"></object>';
      const result = sanitize(input);
      expect(result).not.toContain('<object');
    });

    it('should remove embed elements', () => {
      const input = '<embed src="malicious.swf">';
      const result = sanitize(input);
      expect(result).not.toContain('<embed');
    });

    it('should remove form elements', () => {
      const input = '<form action="https://evil.com"><input type="password"></form>';
      const result = sanitize(input);
      expect(result).not.toContain('<form');
    });

    it('should remove meta tags', () => {
      const input = '<meta http-equiv="refresh" content="0;url=evil.com">';
      const result = sanitize(input);
      expect(result).not.toContain('<meta');
    });

    it('should remove base tags', () => {
      const input = '<base href="https://evil.com">';
      const result = sanitize(input);
      expect(result).not.toContain('<base');
    });
  });

  describe('XSS attack vectors', () => {
    it('should handle encoded script injection', () => {
      const input = '<div>&#60;script&#62;alert(1)&#60;/script&#62;</div>';
      const result = sanitize(input);
      expect(result).not.toContain('<script');
    });

    it('should handle SVG-based XSS', () => {
      const input = '<svg onload="alert(1)"><circle></circle></svg>';
      const result = sanitize(input);
      expect(result).not.toContain('onload');
    });

    it('should handle style-based XSS', () => {
      const input = '<div style="background:url(javascript:alert(1))">Test</div>';
      const result = sanitize(input);
      // DOMPurify handles this
      expect(result).not.toContain('javascript:');
    });

    it('should handle nested dangerous elements', () => {
      const input = '<div><div><div><script>alert(1)</script></div></div></div>';
      const result = sanitize(input);
      expect(result).not.toContain('<script');
    });

    it('should handle mixed-case bypass attempts', () => {
      const input = '<ScRiPt>alert(1)</ScRiPt>';
      const result = sanitize(input);
      expect(result.toLowerCase()).not.toContain('<script');
    });

    it('should handle malformed HTML', () => {
      const input = '<div onclick=alert(1) class="test">Click</div>';
      const result = sanitize(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('class="test"');
    });
  });

  describe('Trusted mode', () => {
    it('should allow all content in trusted mode', () => {
      const input = '<script>alert("allowed")</script><div onclick="test()">Click</div>';
      const result = sanitize(input, true);
      expect(result).toBe(input);
    });

    it('should preserve inline handlers in trusted mode', () => {
      const input = '<button onclick="toggle()">Toggle</button>';
      const result = sanitize(input, true);
      expect(result).toContain('onclick="toggle()"');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = sanitize('');
      expect(result).toBe('');
    });

    it('should handle plain text', () => {
      const input = 'Just some text without HTML';
      const result = sanitize(input);
      expect(result).toBe(input);
    });

    it('should handle deeply nested safe elements', () => {
      const input = '<div><div><div><div><span class="deep">Deep</span></div></div></div></div>';
      const result = sanitize(input);
      expect(result).toContain('Deep');
    });

    it('should handle HTML entities', () => {
      const input = '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>';
      const result = sanitize(input);
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toMatch(/<script[^<]*>/);
    });

    it('should handle unicode', () => {
      const input = '<div class="emoji">🌡️ Temperature: 22°C</div>';
      const result = sanitize(input);
      expect(result).toContain('🌡️');
      expect(result).toContain('22°C');
    });

    it('should handle very long class names', () => {
      const longClass = 'a'.repeat(1000);
      const input = `<div class="${longClass}">Test</div>`;
      const result = sanitize(input);
      expect(result).toContain(longClass);
    });
  });
});
