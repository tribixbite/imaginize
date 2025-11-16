/**
 * Multi-book series type definitions
 */

/**
 * Book information in a series
 */
export interface BookInfo {
  /** Unique book identifier */
  id: string;
  /** Book title */
  title: string;
  /** Relative path from series root */
  path: string;
  /** Order in the series (1-indexed) */
  order: number;
  /** Processing status */
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  /** Optional error message if status is 'error' */
  error?: string;
}

/**
 * Series configuration
 */
export interface SeriesConfig {
  /** Schema version */
  version: number;
  /** Series name */
  name: string;
  /** Optional series description */
  description?: string;
  /** Books in the series */
  books: BookInfo[];
  /** Shared elements configuration */
  sharedElements: {
    /** Enable element sharing */
    enabled: boolean;
    /** Discovery mode */
    mode: 'progressive' | 'manual';
    /** Element merge strategy */
    mergeStrategy: 'enrich' | 'union' | 'override';
  };
  /** Visual style inheritance configuration */
  visualStyle?: {
    /** Book ID to inherit style from */
    inheritFromBook?: string;
    /** Allow style variations in subsequent books */
    allowVariations?: boolean;
  };
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Entity first appearance information
 */
export interface EntityFirstAppearance {
  /** Book ID where entity first appeared */
  bookId: string;
  /** Book title */
  bookTitle: string;
  /** Chapter number */
  chapter: number;
}

/**
 * Entity appearance in a specific book
 */
export interface EntityAppearance {
  /** Book ID */
  bookId: string;
  /** Chapters where entity appears */
  chapters: number[];
}

/**
 * Entity enrichment (additional details)
 */
export interface EntityEnrichment {
  /** Additional detail about the entity */
  detail: string;
  /** Book ID that added this detail */
  sourceBook: string;
  /** Chapter number where detail appeared */
  sourceChapter: number;
  /** Timestamp when detail was added */
  addedAt: string;
}

/**
 * Series-wide entity memory
 */
export interface SeriesEntity {
  /** Entity name */
  name: string;
  /** Entity type */
  type: 'character' | 'creature' | 'place' | 'item' | 'event' | 'other';
  /** Base description from first appearance */
  baseDescription: string;
  /** First appearance information */
  firstAppearance: EntityFirstAppearance;
  /** All appearances across books */
  appearances: EntityAppearance[];
  /** Additional details discovered across books */
  enrichments: EntityEnrichment[];
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Series elements memory file structure
 */
export interface SeriesElementsMemory {
  /** Schema version */
  version: number;
  /** Series name */
  seriesName: string;
  /** Last update timestamp */
  lastUpdated: string;
  /** All entities in the series */
  entities: Record<string, SeriesEntity>;
  /** Series statistics */
  statistics: {
    /** Total unique entities */
    totalEntities: number;
    /** Total enrichments across all entities */
    totalEnrichments: number;
    /** Number of books processed */
    booksProcessed: number;
  };
}

/**
 * Import/export operation result
 */
export interface ImportExportResult {
  /** Number of entities imported/exported */
  count: number;
  /** Entity names that were imported/exported */
  entities: string[];
}

/**
 * Element merge result
 */
export interface MergeResult {
  /** Number of new entities added */
  added: number;
  /** Number of existing entities updated */
  updated: number;
  /** Number of entities enriched with new details */
  enriched: number;
}

/**
 * Series statistics
 */
export interface SeriesStats {
  /** Series name */
  name: string;
  /** Total books */
  totalBooks: number;
  /** Completed books */
  completedBooks: number;
  /** Books in progress */
  inProgressBooks: number;
  /** Pending books */
  pendingBooks: number;
  /** Total unique entities */
  totalEntities: number;
  /** Entities by type */
  entitiesByType: Record<string, number>;
  /** Total enrichments */
  totalEnrichments: number;
}

/**
 * Series configuration in book config
 */
export interface BookSeriesConfig {
  /** Enable series integration */
  enabled: boolean;
  /** Path to series root directory */
  seriesRoot: string;
  /** Book ID (must match series config) */
  bookId: string;
}

/**
 * Book-level entity memory (loaded from .elements-memory.json)
 * This is different from EntityMemory in concurrent/elements-memory.ts
 * as it includes additional tracking fields needed for series integration
 */
export interface BookEntityMemory {
  /** Entity name */
  name: string;
  /** Entity type */
  type: 'character' | 'creature' | 'place' | 'item' | 'event' | 'other';
  /** Full description */
  description: string;
  /** Chapter where first mentioned */
  firstMentionedIn: number;
  /** Chapters where entity appears */
  appearsIn: number[];
  /** Additional details discovered */
  enrichments: string[];
}
