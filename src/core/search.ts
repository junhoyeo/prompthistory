import Fuse from 'fuse.js';
import type { HistoryEntry, SearchOptions, SearchResult } from '../types/history.js';

export class HistorySearchEngine {
  private fuse: Fuse<HistoryEntry>;

  constructor(entries: HistoryEntry[]) {
    this.fuse = new Fuse(entries, {
      keys: ['display', 'project'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  search(options: SearchOptions): SearchResult[] {
    let results: SearchResult[];

    if (options.query) {
      const fuseResults = this.fuse.search(options.query);
      results = fuseResults.map((r) => ({
        entry: r.item,
        score: r.score,
        matches: r.matches?.map((m) => ({
          key: m.key || '',
          value: m.value || '',
          indices: (m.indices || []) as Array<[number, number]>,
        })),
      }));
    } else {
      const allEntries: HistoryEntry[] = [];
      for (const item of (this.fuse as any)._docs) {
        allEntries.push(item);
      }
      results = allEntries.map((entry) => ({ entry }));
    }

    // Apply filters
    results = this.applyFilters(results, options);

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  private applyFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
    let filtered = results;

    // Filter by project
    if (options.project) {
      const projectFilter = options.project.toLowerCase();
      filtered = filtered.filter((r) =>
        r.entry.project.toLowerCase().includes(projectFilter)
      );
    }

    // Filter by date range
    if (options.from) {
      filtered = filtered.filter((r) => r.entry.timestamp >= options.from!.getTime());
    }
    if (options.to) {
      filtered = filtered.filter((r) => r.entry.timestamp <= options.to!.getTime());
    }

    // Filter out slash commands
    if (!options.includeSlashCommands) {
      filtered = filtered.filter((r) => !r.entry.display.trim().startsWith('/'));
    }

    // Deduplicate
    if (options.unique) {
      const seen = new Set<string>();
      filtered = filtered.filter((r) => {
        const key = r.entry.display.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return filtered;
  }
}
