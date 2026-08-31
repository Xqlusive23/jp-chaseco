"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { advanceActivity } from "./activity";
import { loadBank, saveBank } from "./bank-store";
import { getSession } from "./session";
import type { BankState } from "./types";

type BankContextValue = {
  username: string;
  state: BankState;
  update: (updater: (current: BankState) => BankState) => void;
};

const BankContext = createContext<BankContextValue | null>(null);

export function BankProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState("");
  const [state, setState] = useState<BankState | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session || session.role === "admin") return;
    setUsername(session.username);
    setState(loadBank(session.username));

    function syncBrand() {
      const current = getSession();
      if (!current || current.role === "admin") return;
      setState(loadBank(current.username));
    }
    window.addEventListener("storage", syncBrand);
    window.addEventListener("blueco-brand", syncBrand);
    return () => {
      window.removeEventListener("storage", syncBrand);
      window.removeEventListener("blueco-brand", syncBrand);
    };
  }, []);

  useEffect(() => {
    if (state?.accountActivityStatus) return;
    if (!state?.transactions.some((item) => !item.manualStatus && (item.status === "pending" || item.status === "processing"))) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (!current || !username) return current;
        const next = advanceActivity(current);
        if (next === current) return current;
        saveBank(username, next);
        return next;
      });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [state, username]);

  const value = useMemo(() => {
    if (!state || !username) return null;
    return {
      username,
      state,
      update: (updater: (current: BankState) => BankState) => {
        setState((current) => {
          if (!current) return current;
          const next = updater(current);
          saveBank(username, next);
          return next;
        });
      },
    };
  }, [state, username]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page)] text-[var(--navy)]">
        Loading your accounts…
      </div>
    );
  }

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank() {
  const context = useContext(BankContext);
  if (!context) {
    throw new Error("useBank must be used inside BankProvider");
  }
  return context;
}
