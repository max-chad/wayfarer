"use client";

import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { cn, formatDate } from "@/lib/utils";

interface Key {
  id: number;
  name: string;
  prefix: string;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  usedThisMonth: number;
}

export function ApiKeyManager({ initial, quota, used }: { initial: Key[]; quota: number; used: number }) {
  const { toast } = useApp();
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/developer/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error || "Couldn't create a key", "error");
    setFresh(j.key);
    setKeys(j.keys);
    setName("");
  };
  const revoke = async (id: number) => {
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    const res = await fetch(`/api/developer/keys/${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return toast(j.error || "Couldn't revoke", "error");
    setKeys(j.keys);
    toast("Key revoked", "info");
  };
  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const pct = Math.min(100, (used / quota) * 100);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4 text-brand-600" /> Your API keys
        </div>
        <div className="w-full max-w-xs text-xs text-muted">
          <div className="flex justify-between">
            <span>This month</span>
            <span>
              {used.toLocaleString("en-US")} / {quota.toLocaleString("en-US")} calls
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn("h-full rounded-full", pct > 90 ? "bg-coral-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {fresh && (
        <div className="mt-4 rounded-xl border border-brand-300 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950">
          <div className="text-xs font-semibold">Copy your new key now — you won&apos;t see it again.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-2 py-1.5 font-mono text-xs">{fresh}</code>
            <button onClick={copy} className="btn btn-dark btn-sm">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 divide-y divide-line">
        {keys.length === 0 && <p className="py-3 text-sm text-muted">No keys yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className={cn("flex flex-wrap items-center gap-3 py-3 text-sm", k.revoked && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{k.name}</div>
              <div className="font-mono text-xs text-muted">{k.prefix}…</div>
            </div>
            <div className="text-xs text-muted">
              {k.usedThisMonth.toLocaleString("en-US")} calls · {k.lastUsedAt ? `last used ${formatDate(k.lastUsedAt)}` : "never used"}
            </div>
            {k.revoked ? (
              <span className="badge bg-surface-3 text-muted">Revoked</span>
            ) : (
              <button onClick={() => revoke(k.id)} className="btn btn-ghost btn-icon" aria-label={`Revoke ${k.name}`}>
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. Production" className="input py-2 text-sm" maxLength={60} aria-label="Key name" />
        <button onClick={create} disabled={busy} className="btn btn-primary btn-sm shrink-0">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Create key
        </button>
      </div>
    </div>
  );
}
