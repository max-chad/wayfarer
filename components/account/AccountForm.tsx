"use client";

import { Check, Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProviders";
import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_COLORS, cn, VIBE_EMOJI, VIBES } from "@/lib/utils";

export function AccountForm({
  user,
  cities,
}: {
  user: { displayName: string; bio: string; homeCity: string; interests: string[]; avatarColor: string; email: string | null; username: string };
  cities: string[];
}) {
  const { toast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState(user);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState({ open: false, password: "", busy: false });

  const deleteAccount = async () => {
    if (!confirm("Delete your account permanently? Your profile, reviews, trips and saved places will be removed. This can't be undone.")) return;
    setDel((d) => ({ ...d, busy: true }));
    const r = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: del.password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setDel((d) => ({ ...d, busy: false }));
      return toast(j.error || "Couldn't delete the account", "error");
    }
    toast("Your account has been deleted", "info");
    router.push("/");
    router.refresh();
  };

  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: form.displayName, bio: form.bio, homeCity: form.homeCity, interests: form.interests, avatarColor: form.avatarColor }),
    });
    setBusy(false);
    if (r.ok) {
      toast("Profile saved");
      router.refresh();
    } else toast((await r.json()).error || "Couldn't save", "error");
  };

  const changePw = async () => {
    const r = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pw) });
    const j = await r.json();
    if (r.ok) {
      toast("Password updated");
      setPw({ current: "", next: "" });
    } else toast(j.error, "error");
  };

  return (
    <div className="mt-8 space-y-8">
      <section className="card space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={form.displayName} color={form.avatarColor} size={64} />
          <div>
            <div className="label">Avatar colour</div>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button key={c} onClick={() => setForm((f) => ({ ...f, avatarColor: c }))} className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface", form.avatarColor === c && "ring-2 ring-ink")} style={{ background: c }} aria-label={`Colour ${c}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="dn">
              Display name
            </label>
            <input id="dn" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hc">
              Home city <span className="font-normal text-muted">(for flight times & CO₂)</span>
            </label>
            <select id="hc" value={form.homeCity} onChange={(e) => setForm((f) => ({ ...f, homeCity: e.target.value }))} className="input">
              <option value="">Not set</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="bio">
            Bio
          </label>
          <textarea id="bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} maxLength={400} className="input resize-none" />
        </div>
        <div>
          <div className="label">Travel interests — the AI planner &amp; concierge use these</div>
          <div className="flex flex-wrap gap-1.5">
            {VIBES.map((v) => (
              <button
                key={v}
                onClick={() => setForm((f) => ({ ...f, interests: f.interests.includes(v) ? f.interests.filter((x) => x !== v) : [...f.interests, v] }))}
                className="chip capitalize"
                data-active={form.interests.includes(v)}
              >
                {VIBE_EMOJI[v]} {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            @{user.username} · {user.email}
          </span>
          <button onClick={save} disabled={busy} className="btn btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
          </button>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-display text-xl font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} className="input" autoComplete="current-password" />
          <input type="password" placeholder="New password (8+ characters)" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} className="input" autoComplete="new-password" />
        </div>
        <button onClick={changePw} disabled={!pw.current || pw.next.length < 8} className="btn btn-dark">
          Update password
        </button>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-display text-xl font-semibold">Your data</h2>
        <p className="text-sm text-muted">
          Download a copy of everything Wayfarer holds about you, or delete your account. Deleting removes your profile, reviews, trips and saved places; booking and
          invoice records are kept without your name for accounting. See the <a href="/legal/privacy#rights" className="underline">privacy policy</a>.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" download className="btn btn-outline">
            <Download className="size-4" /> Download my data
          </a>
          {!del.open && (
            <button onClick={() => setDel((d) => ({ ...d, open: true }))} className="btn btn-ghost text-coral-600">
              <Trash2 className="size-4" /> Delete account
            </button>
          )}
        </div>
        {del.open && (
          <div className="rounded-xl border border-coral-200 bg-coral-50/50 p-4 dark:border-coral-500/30 dark:bg-coral-500/5">
            <label className="label" htmlFor="del-pw">
              Confirm with your password
            </label>
            <div className="flex flex-wrap gap-2">
              <input id="del-pw" type="password" value={del.password} onChange={(e) => setDel((d) => ({ ...d, password: e.target.value }))} className="input max-w-xs" autoComplete="current-password" />
              <button onClick={deleteAccount} disabled={!del.password || del.busy} className="btn bg-coral-600 text-white hover:bg-coral-700">
                {del.busy && <Loader2 className="size-4 animate-spin" />} Delete permanently
              </button>
              <button onClick={() => setDel({ open: false, password: "", busy: false })} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
