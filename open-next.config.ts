// OpenNext for Cloudflare Workers (`npm run cf:build`). The Vercel build never reads this file.
// The incremental cache (ISR and fetch cache entries) lives in the existing R2 bucket `everybird-opennext-cache`,
// bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc. Stickers and data stay on R2 under their own domain.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
