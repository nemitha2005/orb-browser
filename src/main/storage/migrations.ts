import type { StorageMigration } from './types';

export const STORAGE_MIGRATIONS: StorageMigration[] = [
  {
    version: 1,
    name: 'create_core_storage_tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 1,
        last_visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS session_tabs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tab_order INTEGER NOT NULL,
        url TEXT,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      'CREATE INDEX IF NOT EXISTS idx_bookmarks_updated_at ON bookmarks(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_history_last_visited_at ON history(last_visited_at)',
      'CREATE INDEX IF NOT EXISTS idx_session_tabs_order ON session_tabs(tab_order)',
    ],
  },
];