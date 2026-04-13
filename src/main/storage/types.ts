export interface BookmarkRecord {
  id: number;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: number;
  url: string;
  title: string;
  visitCount: number;
  lastVisitedAt: string;
}

export interface SessionTabRecord {
  tabOrder: number;
  url: string | null;
  isActive: boolean;
}

export interface SessionSnapshot {
  tabs: SessionTabRecord[];
  activeTabIndex: number;
}

export interface BookmarksRepository {
  list(): BookmarkRecord[];
  upsert(url: string, title: string): BookmarkRecord;
  remove(id: number): void;
}

export interface HistoryRepository {
  listRecent(limit: number): HistoryRecord[];
  recordVisit(url: string, title: string): HistoryRecord;
  clear(): void;
}

export interface SessionRepository {
  load(): SessionSnapshot | null;
  save(snapshot: SessionSnapshot): void;
  clear(): void;
}

export interface StorageLayer {
  bookmarks: BookmarksRepository;
  history: HistoryRepository;
  session: SessionRepository;
  close(): void;
}

export interface StorageOptions {
  userDataPath: string;
  fileName?: string;
}

export interface StorageMigration {
  version: number;
  name: string;
  statements: string[];
}