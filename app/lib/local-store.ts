import type { AppStore } from "./app-store";
import { BRAND_KEY, DEFAULT_BRAND, readBrand } from "./brand";
import { STORAGE_PREFIX, listBankUsernames, loadBank } from "./bank-store";
import { USERS_KEY, readStoredUsers } from "./users";
import type { BankState } from "./types";

const UPDATED_KEY = "blueco_store_updated_at";

export function collectLocalStore(): AppStore {
  const banks: Record<string, BankState> = {};
  for (const username of listBankUsernames()) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${username}`);
    if (!raw) continue;
    try {
      banks[username] = JSON.parse(raw) as BankState;
    } catch {
      banks[username] = loadBank(username);
    }
  }
  return {
    updatedAt: Number(localStorage.getItem(UPDATED_KEY) || 0),
    brand: readBrand(),
    users: readStoredUsers(),
    banks,
  };
}

export function applyLocalStore(store: AppStore) {
  localStorage.setItem(BRAND_KEY, JSON.stringify(store.brand || DEFAULT_BRAND));
  localStorage.setItem(USERS_KEY, JSON.stringify(store.users || []));
  localStorage.setItem(UPDATED_KEY, String(store.updatedAt || Date.now()));

  const keep = new Set(Object.keys(store.banks || {}));
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_PREFIX) && !keep.has(key.slice(STORAGE_PREFIX.length))) {
      localStorage.removeItem(key);
    }
  }
  for (const [username, bank] of Object.entries(store.banks || {})) {
    localStorage.setItem(`${STORAGE_PREFIX}${username}`, JSON.stringify(bank));
  }
  window.dispatchEvent(new Event("blueco-brand"));
}
