import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  checkIsAdmin,
  extractPyqFromText,
  getPyqImportStats,
  importPyqQuestions,
  listPyqDbChapters,
  deletePyqChapter,
  deletePyqJunk,
} from "@/lib/pyq/api";
import type { ExtractedQuestion, ExtractResult, ImportQuestionInput } from "@/lib/pyq/types";
import type { SubjectId } from "@/lib/jee/types";

export const Route = createFileRoute("/admin/pyq-import")({
  component: PyqImportPage,
});

type ReviewRow = ExtractedQuestion & { keep: boolean };

type PdfQuestionCrop = { pageNumber: number; questionNumber: number; imageUrl: string };

async function extractTextFromPdf(
  file: File,
): Promise<{ text: string; questionCrops: PdfQuestionCrop[] }> {
  const pdfjs: any = await import(
    /* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  const questionCrops: PdfQuestionCrop[] = [];

  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as Array<{
      str?: string;
      transform?: number[];
      hasEOL?: boolean;
    }>;

    type Line = { y: number; chunks: Array<{ x: number; s: string }> };
    const lines: Line[] = [];
    for (const it of items) {
      if (typeof it.str !== "string" || !it.str) continue;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4] ?? 0;
      const y = Math.round((tr[5] ?? 0) * 2) / 2;
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - y) < 2.5) {
        last.chunks.push({ x, s: it.str });
      } else {
        lines.push({ y, chunks: [{ x, s: it.str }] });
      }
      if (it.hasEOL) {
        lines.push({ y: y - 0.01, chunks: [] });
      }
    }

    lines.sort((a, b) => b.y - a.y);
    for (const line of lines) {
      if (!line.chunks.length) continue;
      line.chunks.sort((a, b) => a.x - b.x);
      const text = line.chunks.map((c) => c.s).join(" ").replace(/ +/g, " ").trim();
      if (text) parts.push(text);
    }

    const markerCandidates = lines
      .flatMap((line) => {
        if (!line.chunks.length) return [];
        const text = [...line.chunks]
          .sort((a, b) => a.x - b.x)
          .map((c) => c.s)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const match = text.match(/\bQ\s*(\d+)\s+JEE\s+Main\b/i);
        return match ? [{ questionNumber: Number(match[1]), pdfY: line.y }] : [];
      })
      .map((marker) => {
        const view = page.getViewport({ scale: 1.6 });
        return {
          questionNumber: marker.questionNumber,
          y: view.convertToViewportPoint(0, marker.pdfY)[1],
        };
      })
      .sort((a, b) => a.y - b.y);
    const seenQuestionNumbers = new Set<number>();
    const markers = markerCandidates.filter((marker) => {
      if (seenQuestionNumbers.has(marker.questionNumber)) return false;
      seenQuestionNumbers.add(marker.questionNumber);
      return true;
    });

    if (markers.length) {
      const viewport = page.getViewport({ scale: 1.6 });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);
      const pageContext = pageCanvas.getContext("2d", { alpha: false });
      if (pageContext) {
        pageContext.fillStyle = "#fff";
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pageContext, viewport }).promise;

        const margin = 30 * viewport.scale;
        for (let i = 0; i < markers.length; i += 1) {
          const marker = markers[i];
          const next = markers[i + 1];
          const top = Math.max(0, marker.y - 17 * viewport.scale);
          const bottom = Math.min(
            viewport.height,
            next ? next.y - 11 * viewport.scale : viewport.height - 40 * viewport.scale,
          );
          const width = Math.max(1, Math.floor(viewport.width - margin * 2));
          const height = Math.max(1, Math.floor(bottom - top));
          if (height < 42 * viewport.scale) continue;

          const crop = document.createElement("canvas");
          crop.width = width;
          crop.height = height;
          const cropContext = crop.getContext("2d", { alpha: false });
          if (!cropContext) continue;
          cropContext.fillStyle = "#fff";
          cropContext.fillRect(0, 0, width, height);
          cropContext.drawImage(pageCanvas, margin, top, width, height, 0, 0, width, height);
          let imageUrl = crop.toDataURL("image/jpeg", 0.9);
          if (imageUrl.length > 300_000) imageUrl = crop.toDataURL("image/jpeg", 0.72);
          if (imageUrl.length <= 300_000) {
            questionCrops.push({ pageNumber: p, questionNumber: marker.questionNumber, imageUrl });
          }
        }
      }
    }
    parts.push("\f");
  }
  return { text: parts.join("\n"), questionCrops };
}

function PyqImportPage() {
  const { user, isPending } = useCurrentUserState();
  const [adminOk, setAdminOk] = useState<boolean | null>(null);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState<SubjectId>("maths");
  const [upsert, setUpsert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    bySubject: Record<string, number>;
    needsRepair?: number;
  } | null>(null);
  const [dbChapters, setDbChapters] = useState<
    Array<{ subject: string; chapter: string; n: number; junk: number }>
  >([]);

  async function refreshAdminMeta() {
    try {
      const [s, ch] = await Promise.all([getPyqImportStats(), listPyqDbChapters()]);
      setStats(s);
      setDbChapters(ch);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!user) return;
    checkIsAdmin()
      .then((r) => setAdminOk(r.isAdmin))
      .catch(() => setAdminOk(false));
    void refreshAdminMeta();
  }, [user?.id]);

  const keepCount = useMemo(() => rows.filter((r) => r.keep).length, [rows]);
  const failedCount = useMemo(
    () => rows.filter((r) => !r.questionImageUrl && (r.flags.includes("extraction_failed") || !r.questionText.trim())).length,
    [rows],
  );

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
          PYQ import is restricted to emails listed in the server ADMIN_EMAILS environment variable.
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
      const { text, questionCrops } = await extractTextFromPdf(file);
      const extracted = await extractPyqFromText({
        data: { text, fileName: file.name, subject },
      });
      const cropByQuestion = new Map(
        questionCrops.map((crop) => [`${crop.pageNumber}:${crop.questionNumber}`, crop.imageUrl]),
      );
      const questions = extracted.questions.map((question) => ({
        ...question,
        questionImageUrl:
          question.pageNumber == null || question.questionNumber == null
            ? null
            : cropByQuestion.get(`${question.pageNumber}:${question.questionNumber}`) ?? null,
      }));
      const visualCount = questions.filter((question) => question.questionImageUrl).length;
      setResult({
        ...extracted,
        questions,
        warnings: [
          ...extracted.warnings,
          visualCount < questions.length
            ? `${visualCount} of ${questions.length} questions have a visual PDF capture. Review or skip questions without one.`
            : `All ${visualCount} questions have a visual PDF capture; equations and diagrams are preserved.`,
        ],
      });
      setRows(
        questions.map((q) => ({
          ...q,
          keep:
            Boolean(q.questionImageUrl) ||
            (Boolean(q.questionText.trim()) &&
              !q.flags.includes("extraction_failed") &&
              !q.flags.includes("low_text_quality")),
        })),
      );
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
    let completed = { inserted: 0, updated: 0, skipped: 0 };
    try {
      const batchSize = 6;
      for (let start = 0; start < selected.length; start += batchSize) {
        const payload: ImportQuestionInput[] = selected.slice(start, start + batchSize).map((q) => ({
          externalKey: q.externalKey,
          subject: result.subject,
          chapter: result.chapter,
          topic: q.topic,
          source: q.source,
          questionNumber: q.questionNumber,
          type: q.type,
          questionText: q.questionText,
          options: q.type === "mcq" ? ["A", "B", "C", "D"] : null,
          correctAnswer: q.correctAnswer,
          pageNumber: q.pageNumber,
          needsReview: q.needsReview || q.flags.length > 0 || !q.questionText.trim(),
          sourcePdf: result.sourcePdf,
          questionImageUrl: q.questionImageUrl,
        }));
        const res = await importPyqQuestions({
          data: { questions: payload, mode: upsert ? "upsert" : "insert" },
        });
        completed = {
          inserted: completed.inserted + res.inserted,
          updated: completed.updated + res.updated,
          skipped: completed.skipped + res.skipped,
        };
        setImportMsg(`Imported batch ${Math.min(start + batchSize, selected.length)} of ${selected.length}…`);
      }
      setImportMsg(
        upsert
          ? `Upsert done: ${completed.inserted} new, ${completed.updated} updated, ${completed.skipped} skipped.`
          : `Imported ${completed.inserted} new; skipped ${completed.skipped} existing (insert-only).`,
      );
      await refreshAdminMeta();
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Import failed."} ${completed.inserted + completed.updated + completed.skipped} question(s) were already processed; Upsert is safe to retry.`,
      );
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
            Clean up junk below, then re-import chapters carefully. Answers stay unverified.
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
          {stats.needsRepair ? ` · ${stats.needsRepair} need text repair` : ""}
        </p>
      ) : null}

      <section className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-fg">1. Cleanup bad imports</h2>
        <p className="text-xs text-muted">
          Delete placeholders, very short stems, and bogus chapters like "1/3". Static JSON is
          not touched.
        </p>
        <button
          type="button"
          disabled={busy}
          className="min-h-10 rounded-xl border border-accent/40 bg-accent/10 px-4 text-sm font-semibold text-accent disabled:opacity-40"
          onClick={() => {
            void (async () => {
              if (!confirm("Delete all junk / unreadable imported questions?")) return;
              setBusy(true);
              setError(null);
              try {
                const res = await deletePyqJunk();
                setImportMsg(`Deleted ${res.deleted} junk question(s).`);
                await refreshAdminMeta();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Cleanup failed.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Delete all junk / unreadable
        </button>
        {dbChapters.length ? (
          <ul className="mt-3 space-y-2">
            {dbChapters.map((ch) => (
              <li
                key={`${ch.subject}|${ch.chapter}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm"
              >
                <span className="text-fg">
                  <span className="text-muted">{ch.subject}</span> · {ch.chapter}{" "}
                  <span className="text-xs text-muted">
                    ({ch.n} qs{ch.junk ? ` · ${ch.junk} junk` : ""})
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-accent disabled:opacity-40"
                  onClick={() => {
                    void (async () => {
                      if (!confirm(`Delete entire chapter "${ch.chapter}" (${ch.n} questions)?`))
                        return;
                      setBusy(true);
                      try {
                        const res = await deletePyqChapter({
                          data: { subject: ch.subject as SubjectId, chapter: ch.chapter },
                        });
                        setImportMsg(`Deleted ${res.deleted} from ${res.chapter}.`);
                        await refreshAdminMeta();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Delete failed.");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Delete chapter
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No DB chapters yet.</p>
        )}
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-fg">2. Import chapter PDF</h2>
        <p className="text-sm text-muted">
          Each question is also saved as a visual crop from the PDF, preserving equations and diagrams in the vault.
        </p>
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
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={upsert}
            onChange={(e) => setUpsert(e.target.checked)}
            disabled={busy}
          />
          Upsert on re-import (update by chapter + Q number)
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
                {result.questions.length} extracted · {keepCount} selected · {failedCount} empty/failed
                · {result.questions.filter((q) => q.questionImageUrl).length} visual captures · subject {result.subject}
              </p>
              {result.warnings.length ? (
                <ul className="mt-1 list-disc pl-5 text-xs text-accent">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 rounded-xl border border-line bg-raised px-3 text-sm"
                onClick={() =>
                  setRows((prev) =>
                    prev.map((r) => ({
                      ...r,
                      keep:
                        Boolean(r.questionImageUrl) ||
                        (Boolean(r.questionText.trim()) && !r.flags.includes("low_text_quality")),
                    })),
                  )
                }
              >
                Keep readable
              </button>
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
                {upsert ? "Upsert" : "Import"} {keepCount}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => {
              const failed =
                row.flags.includes("extraction_failed") ||
                row.flags.includes("low_text_quality") ||
                !row.questionText.trim();
              return (
                <article
                  key={row.externalKey}
                  className={`rounded-2xl border p-4 ${
                    row.keep ? "border-line bg-surface" : "border-line/50 bg-bg opacity-60"
                  } ${failed ? "ring-1 ring-accent/40" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
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
                      {failed ? (
                        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          skip / unreadable
                        </span>
                      ) : row.needsReview ? (
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
                  {row.questionImageUrl ? (
                    <div className="mt-3 rounded-xl border border-line bg-white p-2">
                      <img
                        src={row.questionImageUrl}
                        alt={`Original visual capture of question ${row.questionNumber ?? "?"}`}
                        className="mx-auto max-h-[28rem] w-full object-contain"
                      />
                      <details className="mt-2 text-xs text-muted">
                        <summary className="cursor-pointer">Edit searchable text</summary>
                        <textarea
                          className="mt-2 w-full min-h-[72px] rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg"
                          value={row.questionText}
                          onChange={(e) => updateRow(idx, { questionText: e.target.value })}
                        />
                      </details>
                    </div>
                  ) : (
                    <textarea
                      className="mt-2 w-full min-h-[72px] rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg"
                      value={row.questionText}
                      placeholder={
                        failed
                          ? `Unreadable — paste from PDF page ${row.pageNumber ?? "?"} or skip`
                          : undefined
                      }
                      onChange={(e) => updateRow(idx, { questionText: e.target.value })}
                    />
                  )}
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
              );
            })}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-muted">
        Tip: delete the bad Continuity / "1/3" chapters first, then re-import Continuity once.
      </p>
    </main>
  );
}
