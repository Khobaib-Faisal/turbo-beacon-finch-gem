# Desk.tsx patch (PYQ Vault DB merge)

In `src/components/desk.tsx`:

1. After the `@/lib/jee/api` import block, add:

```ts
import { listPyqChapters } from "@/lib/pyq/api";
import { mergeVaultChapters } from "@/lib/pyq/merge-chapters";
```

2. Replace the PYQ `useEffect` that only fetches `/data/${selectedSubject}.json` with:

```ts
  useEffect(() => {
    let cancelled = false;
    setLoadingQuestions(true);
    const staticPromise = fetch(`/data/${selectedSubject}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Not loaded");
        return res.json() as Promise<ChapterPYQ[]>;
      })
      .catch(() => [] as ChapterPYQ[]);
    const dbPromise = listPyqChapters({ data: { subject: selectedSubject } }).catch(
      () => [] as ChapterPYQ[],
    );
    Promise.all([staticPromise, dbPromise])
      .then(([staticChapters, dbChapters]) => {
        if (cancelled) return;
        setPyqChapters(mergeVaultChapters(staticChapters, dbChapters) as ChapterPYQ[]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);
```

This keeps existing static `/public/data/*.json` content and merges imported DB questions without duplicates by `id`.
