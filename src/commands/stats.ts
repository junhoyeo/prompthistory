import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { parseHistory } from '../core/parser.js';
import { getOpenCodeDbPath, openCodeDbExists } from '../core/parser.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_HISTORY_PATH = openCodeDbExists() 
  ? getOpenCodeDbPath() 
  : join(homedir(), '.claude', 'history.jsonl');

interface StatsOptions {
  project?: string;
  from?: string;
  to?: string;
}

export function registerStatsCommand(program: Command) {
  program
    .command('stats')
    .description('Show statistics about your prompt history')
    .option('-p, --project <project>', 'Filter by project path')
    .option('-f, --from <date>', 'Filter from date (YYYY-MM-DD)')
    .option('-t, --to <date>', 'Filter to date (YYYY-MM-DD)')
    .action(async (options: StatsOptions) => {
      try {
        const entries = await parseHistory(DEFAULT_HISTORY_PATH);
        
        // Apply filters
        let filtered = entries.filter(e => !e._isSlashCommand);
        
        if (options.project) {
          filtered = filtered.filter(e => 
            e.project.toLowerCase().includes(options.project!.toLowerCase())
          );
        }
        
        if (options.from) {
          const fromDate = new Date(options.from);
          filtered = filtered.filter(e => new Date(e.timestamp) >= fromDate);
        }
        
        if (options.to) {
          const toDate = new Date(options.to);
          filtered = filtered.filter(e => new Date(e.timestamp) <= toDate);
        }

        if (filtered.length === 0) {
          console.log(chalk.yellow('No prompts found with the given filters.'));
          return;
        }

        // Calculate stats
        const totalPrompts = filtered.length;
        const uniqueProjects = new Set(filtered.map(e => e.project));
        const uniqueSessions = new Set(filtered.map(e => e.sessionId));

        // Project frequency
        const projectCounts: Record<string, number> = {};
        filtered.forEach(e => {
          projectCounts[e.project] = (projectCounts[e.project] || 0) + 1;
        });

        const topProjects = Object.entries(projectCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Time distribution (hourly)
        const hourCounts: Record<number, number> = {};
        filtered.forEach(e => {
          const hour = new Date(e.timestamp).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // Keyword frequency (simple word count)
        const wordCounts: Record<string, number> = {};
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        
        filtered.forEach(e => {
          const words = e.display
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));
          
          words.forEach(word => {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          });
        });

        const topKeywords = Object.entries(wordCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        // Print summary
        console.log(chalk.bold.blue('\n📊 Prompt History Statistics\n'));
        
        const summaryTable = new Table({
          style: { head: ['cyan'] },
        });
        
        summaryTable.push(
          ['Total Prompts', totalPrompts.toLocaleString()],
          ['Unique Projects', uniqueProjects.size.toLocaleString()],
          ['Unique Sessions', uniqueSessions.size.toLocaleString()],
          ['Average Prompt Length', Math.round(filtered.reduce((sum, e) => sum + e.display.length, 0) / filtered.length).toLocaleString() + ' chars']
        );
        
        console.log(summaryTable.toString());

        // Top projects
        if (topProjects.length > 0) {
          console.log(chalk.bold.blue('\n🏆 Top 5 Projects\n'));
          
          const projectTable = new Table({
            head: ['Project', 'Count', 'Percentage'],
            style: { head: ['cyan'] },
          });
          
          topProjects.forEach(([project, count]) => {
            const percentage = ((count / totalPrompts) * 100).toFixed(1);
            projectTable.push([project, count.toString(), `${percentage}%`]);
          });
          
          console.log(projectTable.toString());
        }

        // Hourly distribution (ASCII bar chart)
        console.log(chalk.bold.blue('\n⏰ Activity by Hour\n'));
        
        const maxCount = Math.max(...Object.values(hourCounts));
        const barWidth = 40;
        
        for (let hour = 0; hour < 24; hour++) {
          const count = hourCounts[hour] || 0;
          const barLength = Math.round((count / maxCount) * barWidth);
          const bar = '█'.repeat(barLength) + '░'.repeat(barWidth - barLength);
          const hourStr = hour.toString().padStart(2, '0');
          const countStr = count.toString().padStart(4);
          
          console.log(`${hourStr}:00 ${chalk.cyan(bar)} ${countStr}`);
        }

        // Top keywords
        if (topKeywords.length > 0) {
          console.log(chalk.bold.blue('\n🔑 Top Keywords\n'));
          
          const keywordTable = new Table({
            head: ['Keyword', 'Count'],
            style: { head: ['cyan'] },
          });
          
          topKeywords.forEach(([keyword, count]) => {
            keywordTable.push([keyword, count.toString()]);
          });
          
          console.log(keywordTable.toString());
        }

        console.log(); // Empty line at end

      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
