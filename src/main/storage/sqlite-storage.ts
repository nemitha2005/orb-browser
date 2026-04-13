import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { STORAGE_MIGRATIONS } from './migrations';
import type {
  BookmarkRecord,
  BookmarksRepository,
  HistoryRecord,
  HistoryRepository,
  SessionRepository,
  SessionTabRecord,
  StorageLayer,
  StorageMigration,
  StorageOptions,
} from './types';

const DEFAULT_STORAGE_FILE_NAME = 'orb-storage.sqlite';

interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown;
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface SqliteModule {
  DatabaseSync: new (filename: string) => SqliteDatabase;
}

function loadSqliteModule(): SqliteModule {
  if (!DatabaseSync) {
    throw new Error('SQLite module is unavailable: DatabaseSync constructor was not found');
  }

  return { DatabaseSync };
}

function asObjectRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => {
    return entry !== null && typeof entry === 'object';
  });
}

function asObjectRow(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapBookmarkRow(row: Record<string, unknown>): BookmarkRecord | null {
  const id = asNumber(row.id);
  const url = asString(row.url);
  const title = asString(row.title);
  const createdAt = asString(row.created_at);
  const updatedAt = asString(row.updated_at);

  if (id === null || !url || !title || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    url,
    title,
    createdAt,
    updatedAt,
  };
}

function mapHistoryRow(row: Record<string, unknown>): HistoryRecord | null {
  const id = asNumber(row.id);
  const url = asString(row.url);
  const title = asString(row.title);
  const visitCount = asNumber(row.visit_count);
  const lastVisitedAt = asString(row.last_visited_at);

  if (id === null || !url || !title || visitCount === null || !lastVisitedAt) {
    return null;
  }

  return {
    id,
    url,
    title,
    visitCount,
    lastVisitedAt,
  };
}

function mapSessionTabRow(row: Record<string, unknown>): SessionTabRecord | null {
  const tabOrder = asNumber(row.tab_order);
  const isActive = asNumber(row.is_active);
  const rawUrl = row.url;

  if (tabOrder === null || isActive === null) {
    return null;
  }

  if (rawUrl !== null && rawUrl !== undefined && typeof rawUrl !== 'string') {
    return null;
  }

  return {
    tabOrder,
    url: rawUrl ?? null,
    isActive: isActive > 0,
  };
}

function runInTransaction(db: SqliteDatabase, callback: () => void): void {
  db.exec('BEGIN');

  try {
    callback();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function ensureMigrationTable(db: SqliteDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

function getAppliedMigrationVersions(db: SqliteDatabase): Set<number> {
  const statement = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC');
  const rows = asObjectRows(statement.all());
  const appliedVersions = new Set<number>();

  rows.forEach(row => {
    const version = asNumber(row.version);
    if (version !== null) {
      appliedVersions.add(version);
    }
  });

  return appliedVersions;
}

function applyMigration(db: SqliteDatabase, migration: StorageMigration): void {
  runInTransaction(db, () => {
    migration.statements.forEach(statement => {
      db.exec(statement);
    });

    db.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(
      migration.version,
      migration.name,
    );
  });
}

function applyMigrations(db: SqliteDatabase): void {
  ensureMigrationTable(db);
  const appliedVersions = getAppliedMigrationVersions(db);

  STORAGE_MIGRATIONS.forEach(migration => {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(db, migration);
    }
  });
}

function createBookmarksRepository(db: SqliteDatabase): BookmarksRepository {
  return {
    list: () => {
      const statement = db.prepare(
        'SELECT id, url, title, created_at, updated_at FROM bookmarks ORDER BY updated_at DESC',
      );

      return asObjectRows(statement.all())
        .map(mapBookmarkRow)
        .filter((entry): entry is BookmarkRecord => entry !== null);
    },

    upsert: (url, title) => {
      db.prepare(
        `INSERT INTO bookmarks(url, title, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(url)
         DO UPDATE SET
           title = excluded.title,
           updated_at = CURRENT_TIMESTAMP`,
      ).run(url, title);

      const row = asObjectRow(
        db.prepare(
          'SELECT id, url, title, created_at, updated_at FROM bookmarks WHERE url = ?',
        ).get(url),
      );

      if (!row) {
        throw new Error('Failed to read bookmark after upsert');
      }

      const mappedRow = mapBookmarkRow(row);
      if (!mappedRow) {
        throw new Error('Bookmark row shape is invalid');
      }

      return mappedRow;
    },

    remove: (id) => {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
    },
  };
}

function createHistoryRepository(db: SqliteDatabase): HistoryRepository {
  return {
    listRecent: (limit) => {
      const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
      const statement = db.prepare(
        `SELECT id, url, title, visit_count, last_visited_at
         FROM history
         ORDER BY last_visited_at DESC
         LIMIT ?`,
      );

      return asObjectRows(statement.all(safeLimit))
        .map(mapHistoryRow)
        .filter((entry): entry is HistoryRecord => entry !== null);
    },

    recordVisit: (url, title) => {
      db.prepare(
        `INSERT INTO history(url, title, visit_count, last_visited_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(url)
         DO UPDATE SET
           title = excluded.title,
           visit_count = history.visit_count + 1,
           last_visited_at = CURRENT_TIMESTAMP`,
      ).run(url, title);

      const row = asObjectRow(
        db.prepare(
          `SELECT id, url, title, visit_count, last_visited_at
           FROM history
           WHERE url = ?`,
        ).get(url),
      );

      if (!row) {
        throw new Error('Failed to read history row after recordVisit');
      }

      const mappedRow = mapHistoryRow(row);
      if (!mappedRow) {
        throw new Error('History row shape is invalid');
      }

      return mappedRow;
    },

    clear: () => {
      db.prepare('DELETE FROM history').run();
    },
  };
}

function createSessionRepository(db: SqliteDatabase): SessionRepository {
  return {
    load: () => {
      const statement = db.prepare(
        `SELECT tab_order, url, is_active
         FROM session_tabs
         ORDER BY tab_order ASC`,
      );

      const tabs = asObjectRows(statement.all())
        .map(mapSessionTabRow)
        .filter((entry): entry is SessionTabRecord => entry !== null);

      if (tabs.length === 0) {
        return null;
      }

      let activeTabIndex = tabs.findIndex(tab => tab.isActive);
      if (activeTabIndex < 0) {
        activeTabIndex = 0;
      }

      return {
        tabs,
        activeTabIndex,
      };
    },

    save: (snapshot) => {
      runInTransaction(db, () => {
        db.prepare('DELETE FROM session_tabs').run();

        snapshot.tabs.forEach((tab, index) => {
          const isActive = index === snapshot.activeTabIndex || tab.isActive ? 1 : 0;
          db.prepare(
            'INSERT INTO session_tabs(tab_order, url, is_active) VALUES (?, ?, ?)',
          ).run(tab.tabOrder, tab.url, isActive);
        });
      });
    },

    clear: () => {
      db.prepare('DELETE FROM session_tabs').run();
    },
  };
}

class SqliteStorageLayer implements StorageLayer {
  public readonly bookmarks: BookmarksRepository;
  public readonly history: HistoryRepository;
  public readonly session: SessionRepository;

  constructor(private readonly db: SqliteDatabase) {
    this.bookmarks = createBookmarksRepository(db);
    this.history = createHistoryRepository(db);
    this.session = createSessionRepository(db);
  }

  close(): void {
    this.db.close();
  }
}

export function getStorageFilePath(options: StorageOptions): string {
  return path.join(options.userDataPath, options.fileName ?? DEFAULT_STORAGE_FILE_NAME);
}

export function initializeStorageLayer(options: StorageOptions): StorageLayer {
  mkdirSync(options.userDataPath, { recursive: true });
  const sqliteModule = loadSqliteModule();
  const databasePath = getStorageFilePath(options);
  const db = new sqliteModule.DatabaseSync(databasePath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  applyMigrations(db);

  return new SqliteStorageLayer(db);
}