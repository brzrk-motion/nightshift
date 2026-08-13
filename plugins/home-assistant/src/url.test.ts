import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl, UrlValidationError } from './url.js';

describe('normalizeBaseUrl', () => {
  it('defaults bare IPv4 to http://ip:8123', () => {
    expect(normalizeBaseUrl('192.168.1.10')).toBe('http://192.168.1.10:8123');
  });

  it('keeps an explicit port on a bare IP', () => {
    expect(normalizeBaseUrl('192.168.1.10:8123')).toBe('http://192.168.1.10:8123');
  });

  it('strips a trailing slash from an absolute URL', () => {
    expect(normalizeBaseUrl('http://192.168.1.10:8123/')).toBe('http://192.168.1.10:8123');
  });

  it('keeps https remote hosts without forcing port 8123', () => {
    expect(normalizeBaseUrl('https://example.ui.nabu.casa')).toBe('https://example.ui.nabu.casa');
  });

  it('keeps https IPv4 without forcing port 8123', () => {
    expect(normalizeBaseUrl('https://192.168.1.10')).toBe('https://192.168.1.10');
  });

  it('defaults bare hostnames on http to port 8123', () => {
    expect(normalizeBaseUrl('homeassistant.local')).toBe('http://homeassistant.local:8123');
  });

  it('rejects empty input', () => {
    expect(() => normalizeBaseUrl('')).toThrow(UrlValidationError);
    expect(() => normalizeBaseUrl('   ')).toThrow(UrlValidationError);
  });

  it('rejects garbage', () => {
    expect(() => normalizeBaseUrl('://')).toThrow(UrlValidationError);
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeBaseUrl('ftp://192.168.1.10')).toThrow(UrlValidationError);
  });
});
