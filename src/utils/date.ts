import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export function parseRelativeDate(dateStr: string): DateRange {
  const now = new Date();
  
  switch (dateStr.toLowerCase()) {
    case 'today':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
      };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    case 'last-7d':
    case '7d':
      return {
        from: startOfDay(subDays(now, 7)),
        to: endOfDay(now),
      };
    case 'last-30d':
    case '30d':
      return {
        from: startOfDay(subDays(now, 30)),
        to: endOfDay(now),
      };
    default:
      return {};
  }
}

export function parseDateOption(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  
  const relativeRange = parseRelativeDate(dateStr);
  if (relativeRange.from) {
    return relativeRange.from;
  }
  
  return new Date(dateStr);
}
