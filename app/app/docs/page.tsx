"use client";

import { useMemo, useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, LockKeyholeIcon, TerminalIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readJson } from "@/components/workspace/use-json";
import type { CreatedApiKey } from "@/lib/workspace/account.mjs";

type Client = "codex" | "claude";
const MCP_PACKAGE = "wicker-study-mcp@2.7.0";

function quoted(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function installCommand(client: Client, origin: string, secret: string) {
  const configure = `WICKER_STUDY_URL=${quoted(origin)} WICKER_STUDY_API_KEY=${quoted(secret)} npx -y ${MCP_PACKAGE} configure`;
  const register = client === "codex"
    ? `codex mcp add wicker-study -- npx -y ${MCP_PACKAGE}`
    : `claude mcp add --scope user wicker-study -- npx -y ${MCP_PACKAGE}`;
  return `${configure}\n${register}`;
}

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="border-t">
    <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
      <span className="text-muted-foreground text-xs">One copy, then paste the complete block into your terminal</span>
      <Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText(command); setCopied(true); }}>
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}{copied ? "Copied" : "Copy"}
      </Button>
    </div>
    <pre className="bg-muted/25 overflow-x-auto border-t px-5 py-5 text-xs leading-6 sm:px-6"><code>{command}</code></pre>
  </div>;
}

export default function WorkspaceDocsPage() {
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "https://study.wicker.life" : window.location.origin;
  const commands = useMemo(() => created ? {
    codex: installCommand("codex", origin, created.secret),
    claude: installCommand("claude", origin, created.secret),
  } : null, [created, origin]);

  async function createInstallation() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      setCreated(await readJson<CreatedApiKey>("/api/account/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "MCP terminal installation", scopes: ["read", "write"], lifetime: "1y" }),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The installation key could not be created.");
    } finally {
      setCreating(false);
    }
  }

  return <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <header className="border-b pb-6">
      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">Manage</span>
      <h1 className="font-heading mt-2 text-[32px] leading-[1.08] font-semibold tracking-[-0.03em]">Docs &amp; agent access</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">Connect Codex or Claude to your courses, documents, calendar, and planner through Wicker Study&apos;s authenticated MCP server.</p>
    </header>

    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg"><TerminalIcon className="size-[18px]" /></span>
        <div className="min-w-60 flex-1">
          <h2 className="font-heading text-xl font-semibold tracking-[-0.025em]">Install Wicker MCP</h2>
          <p className="text-muted-foreground mt-1 text-sm">Generate one copy-ready block. Your personal key is already embedded; there is no credential to copy or paste separately.</p>
        </div>
        {!created && <Button onClick={() => void createInstallation()} disabled={creating}><KeyRoundIcon data-icon="inline-start" />{creating ? "Creating…" : "Generate one-copy block"}</Button>}
      </div>

      {error && <p role="alert" className="border-t px-5 py-3 text-sm text-destructive sm:px-6">Nothing was installed. {error}</p>}
      {commands ? <>
        <Alert className="mx-5 mb-5 border-border sm:mx-6">
          <LockKeyholeIcon />
          <AlertTitle>This block contains a secret shown once</AlertTitle>
          <AlertDescription>The first line stores the embedded key in <code>~/.config/wicker-study/config.json</code> with owner-only permissions; the second connects your agent. Run it only in your private terminal and clear that shell-history entry afterwards. Revoke or replace it under Settings → API access.</AlertDescription>
        </Alert>
        <Tabs defaultValue="codex" className="gap-0 border-t">
          <TabsList variant="line" className="h-12 justify-start px-5 sm:px-6">
            <TabsTrigger value="codex">Codex</TabsTrigger>
            <TabsTrigger value="claude">Claude Code</TabsTrigger>
          </TabsList>
          <TabsContent value="codex" className="mt-0"><CommandBlock command={commands.codex} /></TabsContent>
          <TabsContent value="claude" className="mt-0"><CommandBlock command={commands.claude} /></TabsContent>
        </Tabs>
      </> : <div className="grid border-t md:grid-cols-3">
        {[
          ["1", "Create a scoped key", "Read and write access only; account deletion and key management remain browser-only."],
          ["2", "Copy one block", "Choose Codex or Claude Code and paste both lines into your own terminal."],
          ["3", "Ask about your study", "The MCP reads the same reconciled planner and source-grounded context as Tutor."],
        ].map(([step, title, copy]) => <div key={step} className="px-5 py-5 md:border-r md:last:border-r-0 sm:px-6"><span className="font-data text-primary text-xs font-semibold">{step}</span><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="text-muted-foreground mt-1 text-xs leading-relaxed">{copy}</p></div>)}
      </div>}
    </section>

    <section className="grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border bg-card px-5 py-5 sm:px-6"><h2 className="text-base font-semibold">What the connection can do</h2><ul className="text-muted-foreground mt-3 space-y-2 text-sm"><li>Retrieve course material with source provenance</li><li>Read deadlines, announcements, attendance, and academic plans</li><li>Propose and apply planner or practice actions through scoped tools</li></ul></div>
      <div className="rounded-xl border bg-card px-5 py-5 sm:px-6"><h2 className="text-base font-semibold">Credential safety</h2><ul className="text-muted-foreground mt-3 space-y-2 text-sm"><li>The API stores only a hash of the generated key</li><li>The local helper writes a 0600 file inside a 0700 directory</li><li>Revoking the key immediately disconnects every client using it</li></ul><a href="/app/settings?tab=api" className="text-primary mt-4 inline-flex text-sm font-semibold">Manage API access</a></div>
    </section>
  </div>;
}
