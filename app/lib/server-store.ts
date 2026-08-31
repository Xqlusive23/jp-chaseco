import { promises as fs } from "fs";
import path from "path";
import type { AppStore } from "./app-store";

const STORE_KEY = "blueco-store";
const FILE = path.join(process.cwd(), "data", "app-store.json");

function redis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function isStoreConfigured() {
  return Boolean(redis()) || !process.env.VERCEL;
}

export async function readServerStore(): Promise<AppStore | null> {
  const kv = redis();
  if (kv) {
    const response = await fetch(kv.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", STORE_KEY]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: string | AppStore | null };
    if (!payload.result) return null;
    return typeof payload.result === "string" ? (JSON.parse(payload.result) as AppStore) : payload.result;
  }

  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as AppStore;
  } catch {
    return null;
  }
}

export async function writeServerStore(store: AppStore) {
  const kv = redis();
  if (kv) {
    const response = await fetch(kv.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", STORE_KEY, JSON.stringify(store)]),
    });
    if (!response.ok) {
      throw new Error("Could not save the shared store.");
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Add Upstash Redis (Vercel Marketplace) so branding and members sync across devices.");
  }

  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store), "utf8");
}
