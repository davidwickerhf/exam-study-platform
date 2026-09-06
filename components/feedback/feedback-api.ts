export type Subject = {
  kind?: string;
  route?: string;
  [key: string]: string | undefined;
};
export type Evidence = { label: string; mediaType: string; content: string };
export type Options = {
  subject?: Subject;
  category?: string;
  excerpt?: string;
  draftId?: string;
};
export type Draft = {
  draftId: string;
  revision: string;
  preview: {
    category: string;
    subject: Subject;
    note: string;
    evidence: Evidence[];
    aiReview: boolean;
    contactEmail?: string;
    shareContactEmail?: boolean;
  };
  submitted?: boolean;
  url?: string;
};
export const categories = [
  "incorrect",
  "outdated",
  "missing",
  "source",
  "slow",
  "broken",
  "confusing",
  "accessibility",
  "suggestion",
  "other",
  "wrong-edition",
  "incomplete-extraction",
  "broken-download",
  "ignored-context",
  "too-wordy",
  "wrong-action",
];
export const label = (s: string) =>
  s.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
export const field =
  "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm";
export async function feedbackApi(
  path: string,
  body?: unknown,
  method?: string,
) {
  const response = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Please try again.");
  return data;
}
