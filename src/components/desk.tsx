function ExamCard({
  kicker,
  title,
  note,
  today,
  date,
  disabled,
  onDate,
}: {
  kicker: string;
  title: string;
  note: string;
  today: string;
  date: string | null;
  disabled: boolean;
  onDate: (date: string | null) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{kicker}</p>
      <p className="mt-1 font-serif text-3xl leading-none tabular-nums text-fg">
        {countdownLabel(today, date)}
      </p>
      <h2 className="mt-2 text-sm font-semibold text-fg">{title}</h2>
      <p className="mt-1 text-xs text-muted">{note}</p>
      <label className="mt-3 block text-xs text-muted">
        Exam day
        <input
          className={field}
          type="date"
          disabled={disabled}
          value={date ?? ""}
          onChange={(event) => onDate(event.target.value || null)}
        />
      </label>
    </section>
  );
}

function Plan({
  desk,
  busy,
  onSave,
}: {
  desk: Desk;
  busy: boolean;
  onSave: (settings: DeskSettings) => void;
}) {
  const late = desk.daysApart !== null && desk.daysApart > 0;
  const early = desk.daysApart !== null && desk.daysApart < 0;
  const parts = SUBJECTS.map((subject) => {
    const left = desk.buckets
      .filter((bucket) => bucket.subject === subject.id)
      .reduce((sum, bucket) => sum + bucket.remaining, 0);
    return `${subject.name} ${left}`;
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs text-muted">Remaining syllabus</p>
      <p className="mt-2 font-serif text-5xl leading-none tabular-nums text-fg">
        {formatHours(desk.hoursLeft)}
      </p>
      <p className="mt-1 text-xs text-muted">approximate hours still left</p>
      <p className="mt-3 text-xs text-fg tabular-nums">
        {desk.lecturesLeft} lectures left · {parts.join(" · ")}
      </p>
      <div className="mt-4 border-t border-line pt-3">
        <label className="block text-xs text-muted">
          Target completion date
          <input
            className={field}
            type="date"
            disabled={busy}
            value={desk.settings.targetDate}
            onChange={(event) => {
              if (event.target.value) onSave({ ...desk.settings, targetDate: event.target.value });
            }}
          />
        </label>
        {desk.studyDays > 0 && desk.requiredHoursPerDay !== null ? (
          <p className="mt-2 text-xs text-fg">
            {desk.studyDays} {desk.studyDays === 1 ? "day" : "days"} remaining counting today. Daily requirement:{" "}
            <span className="font-semibold tabular-nums">{formatHours(desk.requiredHoursPerDay)}</span> hours/day
            to finish on {formatLong(desk.settings.targetDate)}.
          </p>
        ) : (
          <p className="mt-2 text-xs text-fg">
            {desk.hoursLeft <= 0
              ? "Nothing left on the lecture count."
              : "That finish date is already past. Pick a later day."}
          </p>
        )}

        {desk.projectedDate && desk.paceHoursPerDay !== null ? (
          <p className="mt-2 text-xs text-fg">
            At the pace you have actually kept ({formatHours(desk.paceHoursPerDay)} hours a day since you
            started logging), the remaining syllabus ends{" "}
            <span className="font-semibold text-accent">{formatLong(desk.projectedDate)}</span>
            {late && desk.daysApart !== null
              ? `, ${desk.daysApart} ${desk.daysApart === 1 ? "day" : "days"} after your target.`
              : early && desk.daysApart !== null
                ? `, ${Math.abs(desk.daysApart)} ${Math.abs(desk.daysApart) === 1 ? "day" : "days"} before your target.`
                : "."}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Finish one lecture and this will also show the date your real pace lands on.
          </p>
        )}
      </div>
    </section>
  );
}

function SubjectCard({
  name,
  note,
  subject,
  buckets,
  todayCount,
  trackedCount,
  busy,
  onFinish,
  onRemaining,
  onQuestions,
}: {
  name: string;
  note: string;
  subject: SubjectId;
  buckets: Bucket[];
  todayCount: number;
  trackedCount: number;
  busy: boolean;
  onFinish: (bucketId: string) => void;
  onRemaining: (bucketId: string, remaining: number) => void;
  onQuestions: (count: number) => void;
}) {
  const left = buckets.reduce((sum, bucket) => sum + bucket.remaining, 0);
  const done = buckets.reduce((sum, bucket) => sum + bucket.completed, 0);
  const hours = buckets.reduce((sum, bucket) => sum + bucket.remaining * bucket.avgHours, 0);
  const total = left + done;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">{name}</h2>
      <p className="mt-2 font-serif text-4xl leading-none tabular-nums text-fg">{left}</p>
      <p className="mt-1 text-xs text-muted">lectures left · {formatHours(hours)} h</p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div
          className="h-full bg-accent"
          style={{ width: `${total <= 0 ? 100 : Math.max(0, Math.min(100, (done / total) * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted tabular-nums">{done} finished since start</p>
      <div className="mt-3 space-y-2">
        {buckets.map((bucket) => (
          <BucketRow
            key={bucket.id}
            bucket={bucket}
            busy={busy}
            onFinish={onFinish}
            onRemaining={onRemaining}
          />
        ))}
      </div>
      <QuestionBox
        subject={subject}
        name={name}
        todayCount={todayCount}
        trackedCount={trackedCount}
        busy={busy}
        onQuestions={onQuestions}
      />
    </section>
  );
}

function BucketRow({
  bucket,
  busy,
  onFinish,
  onRemaining,
}: {
  bucket: Bucket;
  busy: boolean;
  onFinish: (bucketId: string) => void;
  onRemaining: (bucketId: string, remaining: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(bucket.remaining));

  return (
    <div className="rounded-xl bg-bg p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-fg">{bucket.label}</p>
        <p className="text-xs tabular-nums text-muted">{bucket.remaining} left</p>
      </div>
      <button
        type="button"
        className={`${primary} mt-2 w-full text-xs min-h-9`}
        disabled={busy || bucket.remaining <= 0}
        onClick={() => onFinish(bucket.id)}
      >
        {bucket.remaining <= 0 ? "None left" : "Finished one · 10 XP"}
      </button>
      <button
        type="button"
        className="mt-1 text-xs text-muted underline-offset-4 hover:underline"
        onClick={() => {
          setDraft(String(bucket.remaining));
          setOpen((value) => !value);
        }}
      >
        Correct count
      </button>
      {open ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const remaining = Number(draft);
            if (!Number.isInteger(remaining) || remaining < 0 || remaining > 500) return;
            onRemaining(bucket.id, remaining);
            setOpen(false);
          }}
        >
          <input
            className={`${field} min-w-0 min-h-8 text-xs`}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
          />
          <button type="submit" className={`${quiet} min-h-8 text-xs`} disabled={busy}>
            Save
          </button>
        </form>
      ) : null}
    </div>
  );
}

function QuestionBox({
  name,
  todayCount,
  trackedCount,
  busy,
  onQuestions,
}: {
  subject: SubjectId;
  name: string;
  todayCount: number;
  trackedCount: number;
  busy: boolean;
  onQuestions: (count: number) => void;
}) {
  const [text, setText] = useState(String(todayCount));
  useEffect(() => {
    setText(String(todayCount));
  }, [todayCount]);

  function commit(next: number) {
    if (!Number.isInteger(next) || next < 0 || next > 2000 || next === todayCount) return;
    onQuestions(next);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <label className="block text-xs text-muted">
        {name} questions today
        <input
          className={`${field} min-h-9 text-xs`}
          inputMode="numeric"
          disabled={busy}
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(Number(text || "0"))}
        />
      </label>
      <div className="mt-1.5 flex gap-1.5">
        <button type="button" className={`${quiet} min-h-8 text-xs px-2.5`} disabled={busy} onClick={() => commit(todayCount + 1)}>
          +1
        </button>
        <button type="button" className={`${quiet} min-h-8 text-xs px-2.5`} disabled={busy} onClick={() => commit(todayCount + 10)}>
          +10
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted tabular-nums">{trackedCount} total tracked</p>
    </div>
  );
}

function WeakList({
  desk,
  busy,
  run,
}: {
  desk: Desk;
  busy: boolean;
  run: (action: () => Promise<DeskResult>) => void;
}) {
  const [subject, setSubject] = useState<SubjectId>("physics");
  const [name, setName] = useState("");
  const open = desk.weakTopics.filter((topic) => !topic.cleared);
  const cleared = desk.weakTopics.filter((topic) => topic.cleared);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Weak topics</h2>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const topic = name.trim();
          if (!topic) return;
          setName("");
          void run(() => addWeakTopic({ data: { subject, name: topic } }));
        }}
      >
        <div className="flex gap-2">
          <select
            className={`${field} min-h-9 text-xs w-1/3`}
            value={subject}
            onChange={(event) => setSubject(event.target.value as SubjectId)}
          >
            {SUBJECTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className={`${field} min-h-9 text-xs flex-1`}
            value={name}
            placeholder="e.g. Current in RC circuits"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <button type="submit" className={`${primary} min-h-9 text-xs w-full`} disabled={busy || !name.trim()}>
          Add weak topic
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {open.length === 0 ? <li className="text-xs text-muted">No open weak topics.</li> : null}
        {open.map((topic) => (
          <li key={topic.id} className="flex items-center justify-between gap-2 rounded-xl bg-bg p-2.5">
            <div>
              <p className="text-xs font-medium text-fg">{topic.name}</p>
              <p className="text-[11px] text-muted">{SUBJECTS.find((item) => item.id === topic.subject)?.name}</p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={`${quiet} min-h-8 text-xs px-2`}
                disabled={busy}
                onClick={() => void run(() => setWeakCleared({ data: { id: topic.id, cleared: true } }))}
              >
                Cleared
              </button>
              <button
                type="button"
                className="text-xs text-muted px-1.5"
                disabled={busy}
                onClick={() => void run(() => deleteWeakTopic({ data: { id: topic.id } }))}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodoList({
  desk,
  busy,
  run,
}: {
  desk: Desk;
  busy: boolean;
  run: (action: () => Promise<DeskResult>) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">To-do list</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (!text) return;
          setBody("");
          void run(() => addTodo({ data: { body: text } }));
        }}
      >
        <input
          className={`${field} min-h-9 text-xs`}
          value={body}
          placeholder="New task..."
          maxLength={200}
          onChange={(event) => setBody(event.target.value)}
        />
        <button type="submit" className={`${primary} min-h-9 text-xs`} disabled={busy || !body.trim()}>
          Add
        </button>
      </form>
      <ul className="mt-3 space-y-2">
        {desk.todos.length === 0 ? <li className="text-xs text-muted">Nothing on the list.</li> : null}
        {desk.todos.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2 rounded-xl bg-bg px-2.5 py-1.5">
            <input
              type="checkbox"
              className="size-4"
              checked={todo.done}
              disabled={busy}
              onChange={() => void run(() => setTodoDone({ data: { id: todo.id, done: !todo.done } }))}
            />
            <span className={todo.done ? "flex-1 text-xs text-muted line-through" : "flex-1 text-xs text-fg"}>
              {todo.body}
            </span>
            <button
              type="button"
              className="text-xs text-muted px-1"
              disabled={busy}
              onClick={() => void run(() => deleteTodo({ data: { id: todo.id } }))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ history, today }: { history: QuestionDay[]; today: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Daily question log</h2>
      {history.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Nothing logged yet.</p>
      ) : (
        <div className="mt-3 max-h-60 overflow-auto">
          <table className="w-full min-w-[24rem] text-left text-xs">
            <thead className="text-muted border-b border-line pb-1">
              <tr>
                <th className="py-1.5 pr-2 font-medium">Day</th>
                <th className="py-1.5 pr-2 font-medium">Physics</th>
                <th className="py-1.5 pr-2 font-medium">Chemistry</th>
                <th className="py-1.5 pr-2 font-medium">Maths</th>
                <th className="py-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map((day) => (
                <tr key={day.day} className={day.day === today ? "text-fg font-medium" : "text-muted"}>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {formatLong(day.day)}
                    {day.day === today ? " · today" : ""}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.physics}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.chemistry}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{day.maths}</td>
                  <td className="py-1.5 tabular-nums">{day.physics + day.chemistry + day.maths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
