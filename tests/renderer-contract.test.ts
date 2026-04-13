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
      'btn-float',
      'browser-area',
      'new-tab-page',
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

    expect(tailwindCss).toContain('#titlebar');
    expect(tailwindCss).toContain('#tabbar');
    expect(tailwindCss).toContain('#navbar');
    expect(tailwindCss).toContain('.tab-close');
    expect(tailwindCss).toContain('-webkit-app-region: drag;');
    expect(tailwindCss).toContain('-webkit-app-region: no-drag;');
  });
});