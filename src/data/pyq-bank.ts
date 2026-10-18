{/* LEVEL 1: SUBJECT SELECTOR + CHAPTER LIST */}
{!selectedChapter && (
  <div>
    <div className="flex items-center justify-between border-b border-line pb-4">
      <div>
        <h2 className="text-lg font-semibold text-fg">PYQ Vault</h2>
        <p className="text-xs text-muted">Select a subject and chapter to start practice.</p>
      </div>
      <span className="rounded-lg bg-raised px-2.5 py-1 text-xs font-medium text-accent">Official Archive</span>
    </div>

    {/* Subject Switcher */}
    <div className="mt-4 flex gap-2">
      {(["physics", "chemistry", "maths"] as SubjectId[]).map((subj) => (
        <button
          key={subj}
          type="button"
          onClick={() => setSelectedSubject(subj)}
          className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition ${
            selectedSubject === subj
              ? "bg-accent text-accent-ink"
              : "border border-line bg-bg text-muted hover:border-muted hover:text-fg"
          }`}
        >
          {subj}
        </button>
      ))}
    </div>

    {/* Filtered Chapter Cards */}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {PYQ_DATABASE.filter((ch) => ch.subject === selectedSubject).map((ch) => {
        const solvedCount = ch.questions.filter((q) => solvedIds.includes(q.id)).length;
        return (
          <button
            key={ch.chapter}
            type="button"
            onClick={() => {
              setSelectedChapter(ch.chapter);
              setActiveQuestionIdx(null);
              resetQuestionState();
            }}
            className="flex items-center justify-between rounded-xl border border-line bg-bg p-4 text-left transition hover:border-accent hover:bg-raised/40"
          >
            <div>
              <p className="font-semibold text-fg text-sm">{ch.chapter}</p>
              <p className="text-xs text-muted mt-0.5">{ch.questions.length} Questions</p>
            </div>
            <span className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-accent">
              {solvedCount}/{ch.questions.length} Solved
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}
