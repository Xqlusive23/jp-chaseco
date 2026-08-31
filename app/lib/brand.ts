import { DEFAULT_P2P_EMAIL, normalizeP2pEmail, type P2pEmailTemplate } from "./p2p-template";
import type { Account, Card } from "./types";
import { schedulePush } from "./sync";

export type BrandSettings = {
  name: string;
  logo: string;
  nameImage: string;
  nameImageScale: number;
  p2pEmail: P2pEmailTemplate;
};

export const BRAND_KEY = "blueco_brand";

export const DEFAULT_BRAND: BrandSettings = {
  name: "blueco Bank",
  logo: "",
  nameImage: "",
  nameImageScale: 56,
  p2pEmail: DEFAULT_P2P_EMAIL,
};

export function readBrand(): BrandSettings {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  const raw = localStorage.getItem(BRAND_KEY);
  if (!raw) return DEFAULT_BRAND;
  try {
    const parsed = JSON.parse(raw) as BrandSettings;
    return {
      name: parsed.name?.trim() || DEFAULT_BRAND.name,
      logo: parsed.logo || "",
      nameImage: parsed.nameImage || "",
      nameImageScale: Number(parsed.nameImageScale) || DEFAULT_BRAND.nameImageScale,
      p2pEmail: normalizeP2pEmail(parsed.p2pEmail),
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export function bankDisplayName(name?: string) {
  const raw = (name || DEFAULT_BRAND.name).trim() || DEFAULT_BRAND.name;
  if (/\bbank\b/i.test(raw)) return raw;
  return `${raw} Bank`;
}

export function brandedCardName(type: "debit" | "credit" | string, name?: string) {
  return type === "debit" ? `${bankDisplayName(name)} Debit` : `${bankDisplayName(name)} Credit`;
}

function looksGenericProductName(value: string) {
  return /blueco/i.test(value) || /bank(\s+bank)+/i.test(value) || /^(credit card|everyday debit|credit|debit)$/i.test(value.trim());
}

export function labeledCardName(cardName: string, type: "debit" | "credit" | string, name?: string) {
  if (looksGenericProductName(cardName) || !cardName.trim()) return brandedCardName(type, name);
  return applyBrandName(cardName, bankDisplayName(name));
}

export function labeledAccountName(accountName: string, type: string, name?: string) {
  const bank = bankDisplayName(name);
  if (type === "credit" && looksGenericProductName(accountName)) return `${bank} Credit`;
  return applyBrandName(accountName, bank);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyBrandName(text: string, name: string, previousName = DEFAULT_BRAND.name) {
  if (!text) return text;
  const brand = bankDisplayName(name);
  const replacements = Array.from(new Set([previousName, bankDisplayName(previousName), DEFAULT_BRAND.name, "blueco Bank"]))
    .filter((from) => from && from !== brand)
    .sort((a, b) => b.length - a.length);

  let next = text;
  for (const from of replacements) {
    next = next.split(from).join(brand);
  }
  if (brand !== "blueco") {
    next = next.replace(/\bblueco\b(?!\s+Bank)/g, brand);
  }
  next = next.replace(new RegExp(`(?:${escapeRegExp(brand)}\\s*){2,}`, "g"), `${brand} `);
  next = next.replace(new RegExp(`(${escapeRegExp(brand)})(?:\\s+Bank)+`, "g"), "$1");
  return next.replace(/\s+/g, " ").trim();
}

export function writeBrand(brand: BrandSettings) {
  const previous = readBrand();
  localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
  rebrandStoredContent(previous.name, bankDisplayName(brand.name));
  window.dispatchEvent(new Event("blueco-brand"));
  schedulePush();
}

export function rebrandStoredContent(previousName: string, nextName: string) {
  if (typeof window === "undefined" || !nextName || previousName === nextName) return;
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("northline_bank_")) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const state = JSON.parse(raw) as {
        accounts?: Account[];
        cards?: Card[];
      };
      if (state.accounts) {
        state.accounts = state.accounts.map((account) => ({
          ...account,
          name: labeledAccountName(account.name, account.type, nextName),
        }));
      }
      if (state.cards) {
        state.cards = state.cards.map((card) => ({
          ...card,
          name: labeledCardName(card.name, card.type, nextName),
        }));
      }
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* keep the original value if a profile cannot be rewritten */
    }
  }
}

export function brandMark(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? "C"}${parts[1][0] ?? ""}`.toUpperCase();
  return (name.trim()[0] ?? "C").toUpperCase();
}
