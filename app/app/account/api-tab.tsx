"use client";

/**
 * API access: the personal keys an agent or MCP client signs with.
 *
 * A newly created secret exists in React state and in the one place it is
 * rendered, and nowhere else. It is never put in a URL, never written to
 * localStorage, and never logged — including in the copy handler, whose
 * failure path reports that copying failed without echoing what it held.
 */

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, CopyIcon, KeyIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readJson, useJson } from "@/components/workspace/use-json";
import {
  type ApiKey,
  type CreatedApiKey,
  KEY_LIFETIMES,
  KEY_STATE_LABEL,
  SCOPE_COPY,
  activeKeys,
  availableScopes,
  keyState,
  mcpSnippet,
  normalizeScopes,
  skillSnippet,
} from "@/lib/workspace/account.mjs";
import {
  Confirm,
  Failed,
  NUMERALS,
  RULE,
  Section,
  clockOrDate,
  relative,
} from "./shared";

function SecretOnce({
  created,
  onDismiss,
}: {
  created: CreatedApiKey;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied("done");
    } catch {
      // Deliberately says nothing about the value it was holding.
      setCopied("failed");
    }
  }

  return (
    <Alert role="status">
      <KeyIcon />
      <AlertTitle>
        Copy this key now — it is shown once and never again
      </AlertTitle>
      <AlertDescription>
        <span className="flex flex-col gap-3">
          <span>
            Only a hash of it is stored, so it cannot be shown, mailed or
            recovered later. If you lose it, revoke the key and create another.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <code
              className={`bg-card border px-2 py-1 text-xs break-all ${NUMERALS}`}
            >
              {created.secret}
            </code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied === "done" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied === "done"
                ? "Copied"
                : copied === "failed"
                  ? "Select and copy"
                  : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Done
            </Button>
          </span>
        </span>
      </AlertDescription>
    </Alert>
  );
}

export function ApiTab() {
  const keys = useJson<{ keys: ApiKey[]; scopes: string[]; admin: boolean }>(
    "/api/account/api-keys",
  );
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [name, setName] = useState("");
  const [lifetime, setLifetime] = useState("90d");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const admin = Boolean(keys.data?.admin);
  const offered = availableScopes(admin);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const rows = keys.data?.keys ?? [];

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    setFormError(null);
    let granted: string[];
    try {
      granted = normalizeScopes(scopes, { admin });
    } catch (cause) {
      setFormError((cause as Error).message);
      return;
    }
    setCreating(true);
    try {
      const key = await readJson<CreatedApiKey>("/api/account/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes: granted, lifetime }),
      });
      setCreated(key);
      setName("");
      setScopes(["read"]);
      keys.reload();
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    setRevokeError(null);
    try {
      await readJson(
        `/api/account/api-keys/${encodeURIComponent(revoking.id)}`,
        { method: "DELETE" },
      );
      setRevoking(null);
      keys.reload();
    } catch (cause) {
      setRevokeError(
        `The key was not revoked, and still works. ${(cause as Error).message}`,
      );
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {created && (
        <SecretOnce created={created} onDismiss={() => setCreated(null)} />
      )}

      <Section
        title="Personal API keys"
        note={
          <>
            A key acts as you, limited to its scopes. Send it as{" "}
            <code className="text-xs">Authorization: Bearer wsk_…</code>. Keys
            cannot manage other keys, reset data, or delete your account.
            <Link href="/app/settings?tab=activity" className="text-primary mt-2 block text-sm font-semibold">View AI activity →</Link>
          </>
        }
        action={
          <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
            {activeKeys(rows).length} active
          </span>
        }
      >
        {keys.error ? (
          <Failed what="Your keys could not be read" message={keys.error} />
        ) : !keys.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !rows.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No keys yet</EmptyTitle>
              <EmptyDescription>
                Create one to let an agent or the MCP server work with your
                record.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key) => {
                const state = keyState(key);
                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className={`text-xs ${NUMERALS}`}>
                        {key.prefix}…
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant={
                              scope === "admin" ? "default" : "secondary"
                            }
                          >
                            {scope}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {relative(key.createdAt)}
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {relative(key.lastUsedAt) ?? "never"}
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {key.expiresAt
                        ? clockOrDate(key.expiresAt, "date")
                        : "never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {state === "active" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setRevokeError(null);
                            setRevoking(key);
                          }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {KEY_STATE_LABEL[state]}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <form onSubmit={create} className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
              <span className={RULE}>Key name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Claude Desktop"
                required
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={RULE}>Expires</span>
              <Select
                value={lifetime}
                onValueChange={(value) =>
                  setLifetime((value as string) ?? "90d")
                }
              >
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Key lifetime"
                  disabled={creating}
                >
                  <SelectValue>
                    {(value) =>
                      KEY_LIFETIMES.find(([id]) => id === value)?.[1] ??
                      "In 90 days"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {KEY_LIFETIMES.map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={RULE}>Scopes</legend>
            {offered.map((scope) => (
              <label key={scope} className="flex items-start gap-3 py-1">
                <Checkbox
                  checked={scope === "read" ? true : scopes.includes(scope)}
                  disabled={scope === "read" || creating}
                  onCheckedChange={(checked: boolean) =>
                    setScopes((current) =>
                      checked
                        ? [...current, scope]
                        : current.filter((entry) => entry !== scope),
                    )
                  }
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm font-semibold">{scope}</strong>
                  <small className="text-muted-foreground text-xs">
                    {SCOPE_COPY[scope]}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>

          {formError && (
            <p role="alert" className="text-sm font-medium">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={creating || !name.trim()}>
              <KeyIcon data-icon="inline-start" />
              {creating ? "Creating…" : "Create key"}
            </Button>
            {admin && <span className={RULE}>Administrator</span>}
          </div>
        </form>
      </Section>

      <Section
        title="Use it from an agent"
        note={
          <>
            The endpoint list with scopes is at{" "}
            <a
              className="text-primary font-semibold"
              href="/api/agent/manifest"
              target="_blank"
              rel="noopener noreferrer"
            >
              /api/agent/manifest
            </a>
            . The MCP server in the repository wraps the same API.
          </>
        }
      >
        <pre className="bg-card overflow-x-auto border p-4 font-mono text-xs leading-relaxed">
          <code>{mcpSnippet(origin)}</code>
        </pre>
        <p className="text-muted-foreground text-sm">
          Teach Claude Code the study, planning and content workflows with the
          skill:
        </p>
        <pre className="bg-card overflow-x-auto border p-4 font-mono text-xs leading-relaxed">
          <code>{skillSnippet(origin)}</code>
        </pre>
      </Section>

      <Confirm
        open={Boolean(revoking)}
        onOpenChange={(next) => {
          if (!next) setRevoking(null);
        }}
        title={`Revoke “${revoking?.name ?? "this key"}”?`}
        description="Any agent, script or MCP client using this key stops working immediately. Revoking cannot be undone; a replacement key is a new secret."
        word="REVOKE"
        action="Revoke key"
        busy={revokeBusy}
        error={revokeError}
        onConfirm={revoke}
      />
    </div>
  );
}
