"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { Toggle } from "../../../components/Toggle";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  applyTransactionToState,
  adjustBalance,
  createActivity,
  currentAccountStatus,
  mainAccountId,
  removeTransaction,
  setAccountActivityStatus,
  setAccountBalance,
  statusLabel,
  updateTransaction,
} from "../../../lib/activity";
import { loadBank, removeAccount, removeCard, saveBank } from "../../../lib/bank-store";
import { seedCards } from "../../../lib/cards";
import { formatDateTime, formatMoney, fromDateTimeLocal, toDateTimeLocal } from "../../../lib/format";
import { signIn } from "../../../lib/session";
import { SUPPORT_CHANNELS, supportPlaceholder } from "../../../lib/support";
import { readBrand } from "../../../lib/brand";
import { notifyAccountEmail } from "../../../lib/notify-account";
import { isValidEmail, noticeFromBank, notifyTransferEmail } from "../../../lib/notify-transfer";
import { deleteUser, getUser, isMemberApproved, setMemberApproval, updateUser } from "../../../lib/users";
import type { ActivityStatus, BankState, StoredUser, SupportChannel } from "../../../lib/types";

const emptyActivity = {
  description: "",
  category: "Transfer",
  accountId: "acc_checking",
  amount: "",
  date: toDateTimeLocal(new Date().toISOString()),
  status: "posted" as ActivityStatus,
  email: "",
};

export default function AdminUserPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = decodeURIComponent(params.username || "");
  const [state, setState] = useState<BankState | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activity, setActivity] = useState(emptyActivity);
  const [profile, setProfile] = useState({
    displayName: "",
    email: "",
    address: "",
    transferPin: "",
    password: "",
    createdAt: "",
  });
  const [adjust, setAdjust] = useState({
    accountId: "acc_checking",
    amount: "",
    note: "",
    date: toDateTimeLocal(new Date().toISOString()),
  });

  useEffect(() => {
    function loadMember() {
      setReady(true);
      const found = getUser(username);
      if (!found) return;
      const bank = loadBank(username);
      setUser(found);
      setState(bank);
      setProfile({
        displayName: found.displayName,
        email: found.email || bank.email || "",
        address: found.address || bank.address || "",
        transferPin: found.transferPin || bank.transferPin || "",
        password: "",
        createdAt: toDateTimeLocal(found.createdAt),
      });
      setActivity((current) => ({ ...current, accountId: mainAccountId(bank.accounts) }));
      setAdjust((current) => ({ ...current, accountId: mainAccountId(bank.accounts) }));
    }
    loadMember();
    window.addEventListener("blueco-brand", loadMember);
    return () => window.removeEventListener("blueco-brand", loadMember);
  }, [username]);

  const visible = useMemo(() => {
    if (!state) return [];
    return state.transactions.slice().sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [state]);

  function persist(next: BankState | ((current: BankState) => BankState), note?: string) {
    setState((current) => {
      if (!current) return current;
      const resolved = typeof next === "function" ? next(current) : next;
      saveBank(username, resolved);
      return resolved;
    });
    if (note) setMessage(note);
  }

  function handleProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const next = updateUser(username, {
      displayName: profile.displayName,
      email: profile.email,
      address: profile.address,
      transferPin: profile.transferPin,
      createdAt: fromDateTimeLocal(profile.createdAt),
      ...(profile.password.trim() ? { password: profile.password.trim() } : {}),
    });
    setUser(next);
    setState(loadBank(username));
    setProfile((current) => ({ ...current, password: "" }));
    setMessage("Profile saved.");
  }

  function handleSetBalance(accountId: string, value: string) {
    if (!state) return;
    const balance = Number(value);
    if (!Number.isFinite(balance)) {
      setMessage("Enter a valid balance.");
      return;
    }
    persist({ ...state, accounts: setAccountBalance(state.accounts, accountId, balance) }, "Balance updated.");
  }

  function handleAdjust(event: FormEvent) {
    event.preventDefault();
    if (!state) return;
    const amount = Number(adjust.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("Enter an amount to add or deduct.");
      return;
    }
    persist((current) => {
      const accountId = amount > 0 ? mainAccountId(current.accounts) : adjust.accountId;
      return applyTransactionToState(
        {
          ...current,
          accounts: setAccountBalance(
            current.accounts,
            accountId,
            (current.accounts.find((account) => account.id === accountId)?.balance ?? 0) + amount
          ),
        },
        createActivity({
          accountId,
          description: adjust.note.trim() || (amount > 0 ? "Admin credit" : "Admin debit"),
          category: "Other",
          amount,
          date: fromDateTimeLocal(adjust.date),
          status: "posted",
          applied: true,
          manualStatus: true,
        })
      );
    }, amount > 0 ? "Funds added to the main account." : "Funds deducted.");
    setAdjust((current) => ({ ...current, amount: "", note: "" }));
  }

  function handleActivity(event: FormEvent) {
    event.preventDefault();
    if (!state) return;
    const amount = Number(activity.amount);
    if (!activity.description.trim() || !Number.isFinite(amount)) {
      setMessage("Add a description and a valid amount.");
      return;
    }
    if (activity.email && !isValidEmail(activity.email)) {
      setMessage("Enter a valid recipient email, or leave it blank.");
      return;
    }
    const accountId = amount > 0 ? mainAccountId(state.accounts) : activity.accountId || mainAccountId(state.accounts);
    const payload = {
      description: activity.description.trim(),
      category: activity.category,
      accountId,
      amount,
      date: fromDateTimeLocal(activity.date),
      status: currentAccountStatus(state),
      recipientEmail: activity.email.trim() || undefined,
      recipientDetail: activity.email.trim() || undefined,
    };
    persist((current) => {
      if (editingId) {
        return updateTransaction(current, editingId, { ...payload, applied: true, manualStatus: true });
      }
      const transaction = createActivity({ ...payload, applied: true, manualStatus: true });
      const next = {
        ...current,
        accounts: adjustBalance(current.accounts, accountId, amount),
        transactions: [transaction, ...current.transactions],
      };
      void notifyTransferEmail(noticeFromBank(transaction, current, readBrand().name));
      return next;
    }, editingId ? "Activity updated." : "Activity added.");
    setEditingId(null);
    setActivity({ ...emptyActivity, accountId: mainAccountId(state.accounts) });
  }

  if (!ready || !state) return <p className="text-[var(--muted)]">Loading member…</p>;
  if (!user) {
    return (
      <div className="panel px-5 py-8 text-[var(--muted)]">
        Member not found. <Link href="/admin/members" className="text-[var(--blue)] underline">Back to members</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/members" className="text-sm font-semibold text-[var(--blue)]">← Members</Link>
          <h1 className="page-title mt-2">{user.displayName}</h1>
          <p className="page-sub">
            @{user.username} · joined {formatDateTime(user.createdAt)}
            {!isMemberApproved(user) ? " · pending approval" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isMemberApproved(user) && (
            <button
              type="button"
              onClick={() => {
                const next = setMemberApproval(username, true);
                setUser(next);
                void notifyAccountEmail({ to: next.email || "", displayName: next.displayName, kind: "approved" });
                setMessage("Member approved. An email was sent.");
              }}
              className="btn-primary"
            >
              Approve application
            </button>
          )}
          <button type="button" onClick={() => { if (!isMemberApproved(user)) { setMessage("Approve this member before signing in as them."); return; } signIn(username, "member"); window.location.assign("/dashboard"); }} className="btn-secondary">
            Sign in as member
          </button>
          <button type="button" onClick={() => { if (confirm(`Remove ${username}?`)) { deleteUser(username); router.replace("/admin/members"); } }} className="text-sm font-semibold text-red-700">
            Delete
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl bg-[var(--sky)] px-4 py-3 text-sm text-[var(--navy)]">{message}</p>}

      <section className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--navy)]">Account hold</h2>
            <p className="text-sm text-[var(--muted)]">When on, the member cannot send transfers or pay bills.</p>
          </div>
          <Toggle
            label={state.accountHold ? "On hold" : "Active"}
            checked={Boolean(state.accountHold)}
            onChange={(value) => persist({ ...state, accountHold: value }, value ? "Account placed on hold." : "Account released.")}
          />
        </div>
      </section>

      <form onSubmit={handleProfile} className="panel grid gap-5 p-6 lg:grid-cols-2">
        <h2 className="text-xl font-semibold text-[var(--navy)] lg:col-span-2">Identity</h2>
        <Field label="Username"><input value={user.username} disabled className="field bg-[var(--page)]" /></Field>
        <Field label="Registered name"><input value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} className="field" /></Field>
        <Field label="Email"><input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="field" /></Field>
        <Field label="Transfer PIN"><input value={profile.transferPin} onChange={(event) => setProfile((current) => ({ ...current, transferPin: event.target.value.replace(/\D/g, "").slice(0, 6) }))} className="field" placeholder="4–6 digits" /></Field>
        <Field label="Address / billing">
          <input value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} className="field" />
        </Field>
        <Field label="New password"><input type="password" value={profile.password} onChange={(event) => setProfile((current) => ({ ...current, password: event.target.value }))} className="field" placeholder="Leave blank to keep current" /></Field>
        <Field label="Account created">
          <input type="datetime-local" value={profile.createdAt} onChange={(event) => setProfile((current) => ({ ...current, createdAt: event.target.value }))} className="field" />
        </Field>
        <div className="lg:col-span-2">
          <button className="btn-primary">Save identity</button>
        </div>
      </form>

      <section className="panel grid gap-4 p-6 lg:grid-cols-2">
        <h2 className="text-xl font-semibold text-[var(--navy)] lg:col-span-2">Live support for this member</h2>
        <Field label="Channel">
          <select
            value={state.support?.channel ?? "email"}
            onChange={(event) =>
              persist({
                ...state,
                support: { channel: event.target.value as SupportChannel, value: state.support?.value ?? "" },
              })
            }
            className="field"
          >
            {SUPPORT_CHANNELS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label={state.support?.channel === "phone" ? "Mobile number" : "Number, email, or handle"}>
          <input
            value={state.support?.value ?? ""}
            onChange={(event) =>
              persist({
                ...state,
                support: { channel: state.support?.channel ?? "email", value: event.target.value },
              })
            }
            className="field"
            placeholder={supportPlaceholder(state.support?.channel)}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--navy)]">Accounts</h2>
        <div className="grid gap-4 xl:grid-cols-3">
          {state.accounts.map((account) => (
            <article key={account.id} className="panel space-y-3 p-5">
              <p className="text-xs font-semibold uppercase text-[var(--blue)]">{account.type}</p>
              <input value={account.name} onChange={(event) => persist({ ...state, accounts: state.accounts.map((item) => item.id === account.id ? { ...item, name: event.target.value } : item) })} className="field" />
              <input value={account.number} onChange={(event) => persist({ ...state, accounts: state.accounts.map((item) => item.id === account.id ? { ...item, number: event.target.value } : item) })} className="field" />
              <input defaultValue={account.balance} key={`${account.id}-${account.balance}`} onBlur={(event) => handleSetBalance(account.id, event.target.value)} className="field" />
              <p className="font-semibold text-[var(--navy)]">{formatMoney(account.balance)}</p>
              {state.accounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => persist(removeAccount(state, account.id), "Account removed.")}
                  className="text-sm font-semibold text-red-700"
                >
                  Delete account
                </button>
              )}
            </article>
          ))}
        </div>
        <form onSubmit={handleAdjust} className="panel grid gap-3 p-5 md:grid-cols-2">
          <h3 className="font-semibold text-[var(--navy)] md:col-span-2">Add or deduct funds</h3>
          <p className="text-sm text-[var(--muted)] md:col-span-2">Credits land on the main checking account unless you pick another account. The balance updates immediately.</p>
          <select value={adjust.accountId} onChange={(event) => setAdjust((current) => ({ ...current, accountId: event.target.value }))} className="field">
            {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.type === "checking" ? " (main)" : ""}</option>)}
          </select>
          <input value={adjust.amount} onChange={(event) => setAdjust((current) => ({ ...current, amount: event.target.value }))} className="field" placeholder="250 or -80" />
          <input type="datetime-local" value={adjust.date} onChange={(event) => setAdjust((current) => ({ ...current, date: event.target.value }))} className="field" />
          <input value={adjust.note} onChange={(event) => setAdjust((current) => ({ ...current, note: event.target.value }))} className="field" placeholder="Memo" />
          <button className="btn-primary md:col-span-2">Apply</button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--navy)]">Cards</h2>
          <button type="button" onClick={() => persist({ ...state, cards: seedCards(state.displayName) }, "New card numbers generated.")} className="btn-secondary">
            Generate new numbers
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {state.cards.map((card) => (
            <article key={card.id} className="panel space-y-3 p-5">
              <input value={card.name} onChange={(event) => persist({ ...state, cards: state.cards.map((item) => item.id === card.id ? { ...item, name: event.target.value } : item) })} className="field" />
              <p className="text-sm text-[var(--muted)]">•••• {card.last4} · EXP {card.expires} · CVV {card.cvv || "•••"}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => persist({ ...state, cards: state.cards.map((item) => item.id === card.id ? { ...item, locked: !item.locked } : item) }, card.locked ? "Card unfrozen." : "Card frozen.")} className="btn-secondary">
                  {card.locked ? "Unfreeze card" : "Freeze card"}
                </button>
                <button type="button" onClick={() => persist(removeCard(state, card.id), "Card removed.")} className="text-sm font-semibold text-red-700">
                  Delete card
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--navy)]">Transfers</h2>
            <p className="text-sm text-[var(--muted)]">This status applies to new transfers only. Existing activity stays as it is.</p>
          </div>
          <select
            value={currentAccountStatus(state)}
            onChange={(event) => {
              const status = event.target.value as ActivityStatus;
              persist((current) => setAccountActivityStatus(current, status), `New transfers will use ${statusLabel(status)}.`);
            }}
            className="field max-w-[220px]"
          >
            {ACTIVITY_STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </div>
        <div className="panel overflow-hidden">
          {visible.filter((item) => item.category === "Transfer" || item.transferType || item.category === "Bills").length === 0 && (
            <p className="px-5 py-6 text-[var(--muted)]">No transfers yet.</p>
          )}
          {visible.filter((item) => item.category === "Transfer" || item.transferType || item.category === "Bills").map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 last:border-b-0">
              <div>
                <Link href={`/admin/receipt/${encodeURIComponent(username)}/${encodeURIComponent(item.id)}`} className="font-medium text-[var(--navy)]">{item.description}</Link>
                <p className="text-sm text-[var(--muted)]">{formatMoney(item.amount)}</p>
              </div>
              <span className={`status-chip ${item.status}`}>{statusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--navy)]">Activity</h2>
        <form onSubmit={handleActivity} className="panel grid gap-3 p-5 md:grid-cols-2">
          <input className="field md:col-span-2" placeholder="Description" value={activity.description} onChange={(event) => setActivity((current) => ({ ...current, description: event.target.value }))} />
          <select className="field" value={activity.category} onChange={(event) => setActivity((current) => ({ ...current, category: event.target.value }))}>
            {ACTIVITY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select className="field" value={activity.accountId} onChange={(event) => setActivity((current) => ({ ...current, accountId: event.target.value }))}>
            {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.type === "checking" ? " (main)" : ""}</option>)}
          </select>
          <input className="field" placeholder="Amount" value={activity.amount} onChange={(event) => setActivity((current) => ({ ...current, amount: event.target.value }))} />
          <input type="datetime-local" className="field" value={activity.date} onChange={(event) => setActivity((current) => ({ ...current, date: event.target.value }))} />
          <input className="field md:col-span-2" type="email" placeholder="Recipient email" value={activity.email} onChange={(event) => setActivity((current) => ({ ...current, email: event.target.value }))} />
          <p className="text-sm text-[var(--muted)] md:col-span-2">New activity uses the account transfer status: {statusLabel(currentAccountStatus(state))}.</p>
          <button className="btn-primary md:col-span-2">{editingId ? "Save activity" : "Add activity"}</button>
        </form>
        <div className="panel overflow-hidden">
          {visible.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3 last:border-b-0">
              <p className="font-medium">{item.description} <span className="text-sm text-[var(--muted)]">· {formatMoney(item.amount)}</span></p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditingId(item.id); setActivity({ description: item.description, category: item.category, accountId: item.accountId, amount: String(item.amount), date: toDateTimeLocal(item.date), status: item.status, email: item.recipientEmail || "" }); }} className="text-sm font-semibold text-[var(--blue)]">Edit</button>
                <button type="button" onClick={() => persist(removeTransaction(state, item.id), "Activity removed.")} className="text-sm font-semibold text-red-700">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--navy)]">Bills</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {state.bills.map((bill) => (
            <article key={bill.id} className="panel grid gap-3 p-5">
              <input value={bill.payee} onChange={(event) => persist({ ...state, bills: state.bills.map((item) => item.id === bill.id ? { ...item, payee: event.target.value } : item) })} className="field" />
              <input value={bill.amount} onChange={(event) => persist({ ...state, bills: state.bills.map((item) => item.id === bill.id ? { ...item, amount: Number(event.target.value) || 0 } : item) })} className="field" />
              <select value={bill.status} onChange={(event) => persist({ ...state, bills: state.bills.map((item) => item.id === bill.id ? { ...item, status: event.target.value as "due" | "paid" } : item) })} className="field">
                <option value="due">Due</option>
                <option value="paid">Paid</option>
              </select>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
