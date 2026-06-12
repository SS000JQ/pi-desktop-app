import { describe, expect, it, vi } from 'vitest'

import { isAllowedExternalUrl, normalizeExternalUrl, openExternalUrl } from '../../src/main/external-links'

describe('external link handling', () => {
  it('allows only browser-safe external protocols', () => {
    expect(isAllowedExternalUrl('https://example.com/docs')).toBe(true)
    expect(isAllowedExternalUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedExternalUrl('mailto:support@example.com')).toBe(true)

    expect(isAllowedExternalUrl('file:///C:/Users/me/secret.txt')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
    expect(isAllowedExternalUrl('')).toBe(false)
  })

  it('normalizes whitespace without changing valid urls', () => {
    expect(normalizeExternalUrl('  https://example.com/path?q=1  ')).toBe('https://example.com/path?q=1')
  })

  it('opens allowed urls through the injected shell implementation', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined)

    const result = await openExternalUrl('https://example.com', openExternal)

    expect(result).toEqual({ success: true })
    expect(openExternal).toHaveBeenCalledWith('https://example.com/')
  })

  it('rejects disallowed urls without calling shell', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined)

    const result = await openExternalUrl('file:///C:/Users/me/secret.txt', openExternal)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Unsupported external URL/)
    expect(openExternal).not.toHaveBeenCalled()
  })
})
