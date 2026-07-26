#!/usr/bin/env node
/**
 * Validate catalog/sources.json: shipped sources must have >= minStarsPolicy stars.
 *
 * Usage: node scripts/validate-sources-registry.mjs
 */
import { loadSourcesRegistry } from "./load-sources-registry.mjs";

async function fetchStars(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "curse-book" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${repo}`);
  }
  const data = await res.json();
  return data.stargazers_count ?? 0;
}

async function main() {
  const registry = await loadSourcesRegistry();
  const minStars = registry.minStarsPolicy ?? 1000;
  let failed = false;

  for (const source of registry.sources) {
    if (!source.shipped) {
      console.log(`skip ${source.id} (reference only)`);
      continue;
    }

    const stars = await fetchStars(source.repo);
    const ok = stars >= minStars;
    const status = ok ? "OK" : "FAIL";
    console.log(
      `[${status}] ${source.id} (${source.repo}): ${stars} stars (min ${minStars}, at review ${source.starsAtReview})`,
    );
    if (!ok) failed = true;
  }

  if (failed) {
    console.error("\nRegistry validation failed: shipped source below star threshold.");
    process.exit(1);
  }
  console.log("\nRegistry validation passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
