import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readWorkspaceFile(relativePath: string): string {
  const filePath = path.resolve(__dirname, '..', relativePath);
  return readFileSync(filePath, 'utf8');
}

describe('renderer contract smoke', () => {
  it('keeps required interactive DOM ids in main renderer page', () => {
    const indexHtml = readWorkspaceFile('src/renderer/index.html');

    const requiredIds = [
      'tabs',
      'btn-new-tab',
      'address-bar',
      'new-tab-search',
      'btn-back',
      'btn-forward',
      'btn-reload',
      'btn-bookmark',
      'btn-float',
      'btn-menu',
      'bookmark-bar',
      'bookmark-bar-list',
      'bookmark-bar-empty',
      'bookmark-editor',
      'bookmark-editor-title',
      'bookmark-editor-url',
      'bookmark-editor-save',
      'bookmark-editor-cancel',
      'browser-layout',
      'browser-area',
      'new-tab-page',
      'bookmarks-sidebar',
      'btn-bookmarks-close',
      'btn-bookmarks-detailed',
      'bookmarks-list',
      'bookmarks-empty',
      'history-sidebar',
      'btn-history-clear',
      'btn-history-close',
      'btn-history-detailed',
      'history-list',
      'history-empty',
      'full-page-view',
      'full-page-title',
      'btn-full-page-close',
      'full-page-bookmarks',
      'full-page-bookmarks-list',
      'full-page-bookmarks-empty',
      'full-page-history',
      'btn-full-page-history-clear',
      'full-page-history-list',
      'full-page-history-empty',
      'full-page-downloads',
      'download-directory-value',
      'btn-download-directory-select',
      'full-page-downloads-list',
      'full-page-downloads-empty',
    ];

    requiredIds.forEach(id => {
      expect(indexHtml).toContain(`id="${id}"`);
    });

    expect(indexHtml).toContain('<body class="flex h-screen flex-col');
  });

  it('keeps Electron drag/no-drag safety rules', () => {
    const indexHtml = readWorkspaceFile('src/renderer/index.html');
    const tailwindCss = readWorkspaceFile('src/renderer/styles/tailwind.css');

    expect(indexHtml).toContain('[-webkit-app-region:drag]');
    expect(indexHtml).toContain('[-webkit-app-region:no-drag]');

    expect(tailwindCss).toContain('#tabbar');
    expect(tailwindCss).toContain('#navbar');
    expect(tailwindCss).toContain('.tab-close');
    expect(tailwindCss).toContain('-webkit-app-region: drag;');
    expect(tailwindCss).toContain('-webkit-app-region: no-drag;');
  });
});