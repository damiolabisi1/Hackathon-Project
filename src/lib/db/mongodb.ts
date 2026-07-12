import "server-only";
import { MongoClient, type Db } from "mongodb";

/**
 * MongoDB connection.
 *
 * Next.js hot-reloads modules in dev, which would open a brand new connection
 * on every save and quickly exhaust the Atlas connection limit. So in dev we
 * cache the client promise on `globalThis`, which survives hot reloads.
 */

const DB_NAME = process.env.MONGODB_DB || "kitchenaid";

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

  if (process.env.NODE_ENV === "development") {
    if (!globalThis._mongoClientPromise) {
      globalThis._mongoClientPromise = new MongoClient(uri).connect();
    }
    return globalThis._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db(DB_NAME);
}

/** True when a connection string is configured at all. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}
