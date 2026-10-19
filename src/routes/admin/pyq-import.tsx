import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  checkIsAdmin,
  extractPyqFromText,
  getPyqImportStats,
  importPyqQuestions,
} from "@/lib/pyq/api";
import type { ExtractedQuestion, ExtractResult, ImportQuestionInput } from "@/lib/pyq/types";
import type { SubjectId } from "@/lib/jee/types";

export const Route = createFileRoute("/admin/pyq-import")({
  component: PyqImportPage,
});

type ReviewRow = ExtractedQuestion & { keep: boolean };

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs: any = await import(
    /* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((it: { str?: string }) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    parts.push(line);
    parts.push("\f");
  }
  return parts.join("\n");
}

function PyqImportPage() {
  const { user, isPending } = useCurrentUserState();
  const [adminOk, setAdminOk] = useState<boolean | null>(null);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState<SubjectId>("maths");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    bySubject: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    checkIsAdmin()
      .then((r) => setAdminOk(r.isAdmin))
      .catch(() => setAdminOk(false));
    getPyqImportStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [user?.id]);

  const keepCount = useMemo(() => rows.filter((r) => r.keep).length, [rows]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-raised" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (adminOk === false) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-2xl text-fg">Admin only</h1>
        <p className="mt-2 text-sm text-muted">
          PYQ import is restricted to emails listed in the server ADMIN_EMAILS environment
          variable.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-accent underline">
          Back to desk
        </Link>
      </main>
    );
  }
  if (adminOk === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-muted">Checking admin access…</p>
      </main>
    );
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setImportMsg(null);
    setResult(null);
    setRows([]);
    setFileName(file.name);
    setBusy(true);
    try {
      const text = await extractTextFromPdf(file);
      const extracted = await extractPyqFromText({
        data: { text, fileName: file.name, subject },
      });
      setResult(extracted);
      setRows(extracted.questions.map((q) => ({ ...q, keep: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!result) return;
    const selected = rows.filter((r) => r.keep);
    if (selected.length === 0) {
      setError("Select at least one question.");
      return;
    }
    setBusy(true);
    setError(null);
    setImportMsg(null);
    try {
      const payload: ImportQuestionInput[] = selected.map((q) => ({
        externalKey: q.externalKey,
        subject: result.subject,
        chapter: result.chapter,
        topic: q.topic,
        source: q.source,
        questionNumber: q.questionNumber,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        pageNumber: q.pageNumber,
        needsReview: q.needsReview || q.flags.length > 0,
        sourcePdf: result.sourcePdf,
      }));
      const res = await importPyqQuestions({ data: { questions: payload } });
      setImportMsg(
        `Imported ${res.inserted} new question(s); skipped ${res.skipped} duplicate(s).`,
      );
      const s = await getPyqImportStats();
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Admin</p>
          <h1 className="font-serif text-2xl font-bold text-fg">PYQ PDF Import</h1>
          <p className="mt-1 text-sm text-muted">
            Text-first PrepWiser chapter import · answers stay unverified until you check them.
          </p>
        </div>
        <Link
          to="/"
          className="rounded-xl border border-line bg-raised px-3 py-2 text-sm font-medium text-fg"
        >
          ← Desk
        </Link>
      </div>

      {stats ? (
        <p className="mt-4 text-xs text-muted">
          Database: {stats.total} questions
          {stats.bySubject.maths != null ? ` · M ${stats.bySubject.maths}` : ""}
          {stats.bySubject.physics != null ? ` · P ${stats.bySubject.physics}` : ""}
          {stats.bySubject.chemistry != null ? ` · C ${stats.bySubject.chemistry}` : ""}
        </p>
      ) : null}

      <section className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <label className="block text-sm font-medium text-fg">
          Subject
          <select
            className="mt-1 w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-base text-fg"
            value={subject}
            onChange={(e) => setSubject(e.target.value as SubjectId)}
            disabled={busy}
          >
            <option value="maths">Mathematics</option>
            <option value="physics">Physics</option>
            <option value="chemistry">Chemistry</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-fg">
          Chapter PDF (PrepWiser)
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-ink"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {fileName ? <p className="text-xs text-muted">File: {fileName}</p> : null}
        {busy ? <p className="text-sm text-accent">Working…</p> : null}
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        {importMsg ? <p className="text-sm font-medium text-fg">{importMsg}</p> : null}
      </section>

      {result ? (
        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-fg">{result.chapter}</h2>
              <p className="text-xs text-muted">
                {result.questions.length} extracted · subject {result.subject} · keep {keepCount}
              </p>
              {result.warnings.length ? (
                <ul className="mt-1 list-disc pl-5 text-xs text-accent">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-10 rounded-xl border border-line bg-raised px-3 text-sm"
                onClick={() => setRows((prev) => prev.map((r) => ({ ...r, keep: true })))}
              >
                Keep all
              </button>
              <button
                type="button"
                className="min-h-10 rounded-xl border border-line bg-raised px-3 text-sm"
                onClick={() => setRows((prev) => prev.map((r) => ({ ...r, keep: false })))}
              >
                Skip all
              </button>
              <button
                type="button"
                disabled={busy || keepCount === 0}
                className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
                onClick={() => void onImport()}
              >
                Import {keepCount}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <article
                key={row.externalKey}
                className={`rounded-2xl border p-4 ${
                  row.keep ? "border-line bg-surface" : "border-line/50 bg-bg opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.keep}
                      onChange={(e) => updateRow(idx, { keep: e.target.checked })}
                      aria-label={`Keep Q${row.questionNumber}`}
                    />
                    <span className="text-sm font-semibold text-fg">
                      Q{row.questionNumber ?? "?"} · {row.type}
                    </span>
                    <span className="text-xs text-muted">{row.source}</span>
                    {row.pageNumber != null ? (
                      <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] text-muted">
                        p.{row.pageNumber}
                      </span>
                    ) : null}
                    {row.needsReview ? (
                      <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        needs review
                      </span>
                    ) : null}
                  </div>
                  <label className="text-xs text-muted">
                    Answer
                    <input
                      className="ml-2 w-20 rounded-lg border border-line bg-bg px-2 py-1 text-sm text-fg"
                      value={row.correctAnswer ?? ""}
                      onChange={(e) => updateRow(idx, { correctAnswer: e.target.value })}
                    />
                  </label>
                </div>
                <textarea
                  className="mt-2 w-full min-h-[72px] rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg"
                  value={row.questionText}
                  onChange={(e) => updateRow(idx, { questionText: e.target.value })}
                />
                {row.options ? (
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {row.options.map((opt, oi) => (
                      <input
                        key={oi}
                        className="rounded-lg border border-line bg-bg px-2 py-1 text-xs text-fg"
                        value={opt}
                        onChange={(e) => {
                          const next = [...(row.options ?? [])];
                          next[oi] = e.target.value;
                          updateRow(idx, { options: next });
                        }}
                        aria-label={`Option ${String.fromCharCode(65 + oi)}`}
                      />
                    ))}
                  </div>
                ) : null}
                {row.flags.length ? (
                  <p className="mt-2 text-[11px] text-muted">Flags: {row.flags.join(", ")}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-muted">
        Diagrams: each question stores its PDF page number for manual check. Automatic diagram crop
        is not in this MVP. Re-importing the same PDF skips duplicates via external_key.
      </p>
    </main>
  );
}
