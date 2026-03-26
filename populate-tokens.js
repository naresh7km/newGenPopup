/**
 * One-time script to load all tokens from valid-tokens.json into Redis.
 *
 * Usage:
 *   REDIS_URL=rediss://<your-render-keyval-url> node populate-tokens.js
 */

const Redis = require("ioredis");
const tokens = require("./valid-tokens.json");

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function main() {
  // Push all tokens into the list in one batch (RPUSH keeps insertion order,
  // so RPOP will take from the end — same as the original .pop() behaviour)
  const count = await redis.rpush("valid_tokens", ...tokens);
  console.log(`Pushed ${count} tokens into Redis key "valid_tokens"`);
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
