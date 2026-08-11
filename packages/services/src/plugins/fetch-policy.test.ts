import { describe, expect, it } from 'vitest';
import { isAllowedPluginFetchUrl, isLoopbackOrPrivateHttpHost } from './fetch-policy.js';

describe('isLoopbackOrPrivateHttpHost', () => {
  it('allows loopback', () => {
    expect(isLoopbackOrPrivateHttpHost('localhost')).toBe(true);
    expect(isLoopbackOrPrivateHttpHost('127.0.0.1')).toBe(true);
    expect(isLoopbackOrPrivateHttpHost('::1')).toBe(true);
  });

  it('allows RFC1918', () => {
    expect(isLoopbackOrPrivateHttpHost('192.168.0.2')).toBe(true);
    expect(isLoopbackOrPrivateHttpHost('10.0.0.1')).toBe(true);
    expect(isLoopbackOrPrivateHttpHost('172.16.5.5')).toBe(true);
    expect(isLoopbackOrPrivateHttpHost('172.31.255.255')).toBe(true);
  });

  it('denies public and non-private', () => {
    expect(isLoopbackOrPrivateHttpHost('example.com')).toBe(false);
    expect(isLoopbackOrPrivateHttpHost('8.8.8.8')).toBe(false);
    expect(isLoopbackOrPrivateHttpHost('172.15.0.1')).toBe(false);
    expect(isLoopbackOrPrivateHttpHost('172.32.0.1')).toBe(false);
  });
});

describe('isAllowedPluginFetchUrl', () => {
  it('allows https anywhere', () => {
    expect(isAllowedPluginFetchUrl(new URL('https://example.com/'))).toBe(true);
  });

  it('allows private http', () => {
    expect(isAllowedPluginFetchUrl(new URL('http://192.168.0.2/'))).toBe(true);
    expect(isAllowedPluginFetchUrl(new URL('http://127.0.0.1:8123/'))).toBe(true);
  });

  it('denies public http', () => {
    expect(isAllowedPluginFetchUrl(new URL('http://example.com/'))).toBe(false);
  });
});
