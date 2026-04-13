import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { initializeStorageLayer } from '../src/main/storage';

const temporaryDirectories: string[] = [];

function createStorage() {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'orb-storage-'));
  temporaryDirectories.push(temporaryDirectory);

  return initializeStorageLayer({
    userDataPath: temporaryDirectory,
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('sqlite storage foundation', () => {
  it('supports bookmark, history, and session repositories', () => {
    const storage = createStorage();

    const bookmark = storage.bookmarks.upsert('https://example.com/', 'Example');
    expect(bookmark.url).toBe('https://example.com/');
    expect(storage.bookmarks.list()).toHaveLength(1);

    const updatedBookmark = storage.bookmarks.upsert('https://example.com/', 'Example Home');
    expect(updatedBookmark.title).toBe('Example Home');

    const historyRow = storage.history.recordVisit('https://example.com/', 'Example Home');
    expect(historyRow.visitCount).toBe(1);
    const revisitedRow = storage.history.recordVisit('https://example.com/', 'Example Home');
    expect(revisitedRow.visitCount).toBe(2);
    expect(storage.history.listRecent(10)).toHaveLength(1);

    storage.session.save({
      tabs: [
        {
          tabOrder: 0,
          url: 'https://example.com/',
          isActive: true,
        },
        {
          tabOrder: 1,
          url: null,
          isActive: false,
        },
      ],
      activeTabIndex: 0,
    });

    const session = storage.session.load();
    expect(session).not.toBeNull();
    expect(session?.tabs).toHaveLength(2);
    expect(session?.activeTabIndex).toBe(0);

    storage.close();
  });

  it('keeps data across reinitialization with migrations applied once', () => {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'orb-storage-reopen-'));
    temporaryDirectories.push(temporaryDirectory);

    const firstStorage = initializeStorageLayer({
      userDataPath: temporaryDirectory,
    });
    firstStorage.bookmarks.upsert('https://orb.dev/', 'Orb');
    firstStorage.close();

    const secondStorage = initializeStorageLayer({
      userDataPath: temporaryDirectory,
    });
    const bookmarks = secondStorage.bookmarks.list();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]?.title).toBe('Orb');
    secondStorage.close();
  });
});