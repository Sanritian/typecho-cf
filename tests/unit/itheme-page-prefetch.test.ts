/**
 * iTheme 页面预取判定测试。
 */
import { describe, expect, it } from 'vitest';
import {
  resolvePrefetchUrl,
  shouldSkipPrefetchByConnection,
} from '@/themes/iTheme/assets/page-prefetch.js';

describe('shouldSkipPrefetchByConnection()', () => {
  it('省流模式下跳过预取', () => {
    expect(shouldSkipPrefetchByConnection({ saveData: true })).toBe(true);
  });

  it('2g 和 slow-2g 网络下跳过预取', () => {
    expect(shouldSkipPrefetchByConnection({ effectiveType: '2g' })).toBe(true);
    expect(shouldSkipPrefetchByConnection({ effectiveType: 'slow-2g' })).toBe(true);
  });

  it('未知或正常网络默认允许预取', () => {
    expect(shouldSkipPrefetchByConnection(null)).toBe(false);
    expect(shouldSkipPrefetchByConnection({ effectiveType: '4g' })).toBe(false);
  });
});

describe('resolvePrefetchUrl()', () => {
  it('会规范化站内链接并去掉 hash', () => {
    expect(resolvePrefetchUrl('/archives/1/#comments', 'https://example.com')).toBe('https://example.com/archives/1/');
  });

  it('会拒绝外链、锚点和 javascript 链接', () => {
    expect(resolvePrefetchUrl('https://other.example.com/post', 'https://example.com')).toBeNull();
    expect(resolvePrefetchUrl('#comments', 'https://example.com')).toBeNull();
    expect(resolvePrefetchUrl('javascript:void(0)', 'https://example.com')).toBeNull();
  });

  it('会跳过 php 页面，避免干扰原有回退逻辑', () => {
    expect(resolvePrefetchUrl('/admin/login.php', 'https://example.com')).toBeNull();
  });
});
