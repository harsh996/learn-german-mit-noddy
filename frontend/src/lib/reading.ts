import fs from "fs";
import path from "path";

import type { Story } from "./readingTypes";

let cache: { stories: Story[]; mtime: number } | null = null;

export function getStories(): Story[] {
  const d = path.join(process.cwd(), "data", "reading");
  if (!fs.existsSync(d)) return [];
  const files = fs.readdirSync(d).filter((f) => /^(a1|a2|b1|b2|c1|c2)\.json$/i.test(f));
  const mtime = Math.max(0, ...files.map((f) => fs.statSync(path.join(d, f)).mtimeMs));
  if (cache && cache.mtime === mtime) return cache.stories;

  const stories: Story[] = [];
  for (const f of files) {
    try {
      stories.push(...(JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) as Story[]));
    } catch (e) {
      console.error(`Invalid reading file ${f}:`, e);
    }
  }
  // Level order, then shortest first so each level starts gently.
  stories.sort((a, b) => a.level.localeCompare(b.level) || a.words - b.words);
  cache = { stories, mtime };
  return stories;
}
