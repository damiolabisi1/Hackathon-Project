import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * MongoDB connection.
 *
 * Next.js hot-reloads modules in dev, which would open a brand new connection
 * on every save and quickly exhaust the Atlas connection limit. So in dev we
 * cache the client promise on `globalThis`, which survives hot reloads.
 *
 * Two things this deliberately guards against:
 *  - Hanging. Without an explicit timeout the driver retries for ~30s, so a
 *    request never returns and the UI spins forever. Fail fast instead.
 *  - A poisoned cache. If the first connect() rejects, the cached promise stays
 *    rejected, so every later request reuses the failure until a restart. Clear
 *    the cache on failure so the next request genuinely retries.
 */

const DB_NAME = process.env.MONGODB_DB || "kitchenaid";

// Fail fast: a dead database should surface an error, not hang the page.
const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env.local (see .env.template).",
    );
  }

  const isDev = process.env.NODE_ENV === "development";
  const cached = isDev ? globalThis._mongoClientPromise : clientPromise;
  if (cached) return cached;

  const pending = new MongoClient(uri, CONNECT_OPTIONS)
    .connect()
    .catch((error: unknown) => {
      // Don't cache a failure — the next request should try again.
      if (isDev) globalThis._mongoClientPromise = undefined;
      else clientPromise = undefined;
      throw error;
    });

  if (isDev) globalThis._mongoClientPromise = pending;
  else clientPromise = pending;

  return pending;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db(DB_NAME);
}

/** True when a connection string is configured at all. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

/**
 * Turn a driver error into something a user can act on. The raw message is a
 * wall of TLS/topology internals.
 */
export function describeDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    /ServerSelection|ECONNREFUSED|ETIMEDOUT|tlsv1|SSL|topology/i.test(message)
  ) {
    return "Could not reach the recipe database. Check that your IP is allowed in MongoDB Atlas (Network Access) and that the cluster is running.";
  }

  if (/auth|password|credentials/i.test(message)) {
    return "MongoDB rejected the credentials. Check the username and password in MONGODB_URI.";
  }

  return "The recipe database is unavailable right now.";
}
