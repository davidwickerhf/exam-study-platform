"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readJson } from "@/components/workspace/use-json";

export type RefreshSettings = { enabled: boolean; updatesMinutes: number; materialsMinutes: number; studyStatus: "studying" | "completed"; policy?: { mode?: string; reason?: string; checkedAt?: string } };
const defaults: RefreshSettings = { enabled: true, updatesMinutes: 30, materialsMinutes: 360, studyStatus: "studying" };
const frequency = (minutes: number) => minutes < 60 ? `Every ${minutes} minutes` : minutes === 60 ? "Every hour" : minutes === 1440 ? "Daily" : minutes === 10080 ? "Weekly" : `Every ${minutes / 60} hours`;
const control = "border-input bg-background mt-2 h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";

export function CanvasRefreshSettings({ origin, saved, collectionEnabled, onSaved }: { origin: string; saved?: RefreshSettings; collectionEnabled: boolean; onSaved: () => void }) {
  const [value, setValue] = useState<RefreshSettings>(saved || defaults);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const active = value.enabled && value.studyStatus === "studying";
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      await readJson("/api/account/integrations/canvas/refresh", { method: "PUT", body: JSON.stringify({ canvasUrl: origin, settings: value }) });
      setNotice(active ? "Refresh settings saved. Course selection will be checked automatically." : "Automatic refresh paused. Saved materials and manual refresh remain available.");
      onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mt-5 border-t pt-5">
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Automatic refresh</h3><p className="text-muted-foreground mt-1 max-w-2xl text-sm">Follows your academic calendar as periods change. Only the latest edition of a retaken course is refreshed.</p></div><label className="flex shrink-0 items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-primary" checked={value.enabled} disabled={busy} onChange={event => setValue({ ...value, enabled: event.target.checked })} />Enabled</label></div>
    {!collectionEnabled && <p className="text-muted-foreground mt-3 text-sm">Enable material collection above to activate this schedule.</p>}
    <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-medium">Announcements &amp; assignments<select className={control} value={value.updatesMinutes} disabled={!active} onChange={event => setValue({ ...value, updatesMinutes: Number(event.target.value) })}>{[15,30,60,180,360,1440].map(minutes => <option key={minutes} value={minutes}>{frequency(minutes)}</option>)}</select></label>
      <label className="text-sm font-medium">Course materials<select className={control} value={value.materialsMinutes} disabled={!active} onChange={event => setValue({ ...value, materialsMinutes: Number(event.target.value) })}>{[60,360,720,1440,10080].map(minutes => <option key={minutes} value={minutes}>{frequency(minutes)}</option>)}</select></label>
      <label className="text-sm font-medium">Programme status<select className={control} value={value.studyStatus} onChange={event => setValue({ ...value, studyStatus: event.target.value as RefreshSettings["studyStatus"] })}><option value="studying">Still studying</option><option value="completed">Completed — pause refresh</option></select></label>
    </fieldset>
    <p className="text-muted-foreground mt-3 max-w-3xl text-xs leading-relaxed">During breaks, including summer, we keep watching the ending year and newly available next-year courses. Marking your programme completed pauses background refresh; change it back when you resume studying. Individual course pauses still apply.</p>
    {saved?.policy?.reason && <p className="text-muted-foreground mt-2 text-xs">Last course-selection check: {saved.policy.reason}{saved.policy.checkedAt ? ` · ${new Date(saved.policy.checkedAt).toLocaleString()}` : ""}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save refresh settings"}</Button>{notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-destructive text-sm">{error}</p>}</div>
  </form>;
}
