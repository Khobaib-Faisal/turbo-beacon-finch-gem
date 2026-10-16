export type SubjectId = "physics" | "chemistry" | "maths";

export type Bucket = {
  id: string;
  subject: SubjectId;
  label: string;
  remaining: number;
  completed: number;
  avgHours: number;
};

export type QuestionDay = {
  day: string;
  physics: number;
  chemistry: number;
  maths: number;
};

export type WeakTopic = {
  id: string;
  subject: SubjectId;
  name: string;
  cleared: boolean;
};

export type TodoItem = {
  id: string;
  body: string;
  done: boolean;
};

export type DeskSettings = {
  targetDate: string;
  janDate: string;
  aprilDate: string | null;
  advancedDate: string | null;
};

export type Desk = {
  today: string;
  buckets: Bucket[];
  todayQuestions: Record<SubjectId, number>;
  history: QuestionDay[];
  streak: number;
  streakAliveToday: boolean;
  xp: number;
  lecturesLeft: number;
  hoursLeft: number;
  hoursDone: number;
  studyDays: number;
  requiredHoursPerDay: number | null;
  paceHoursPerDay: number | null;
  projectedDate: string | null;
  daysApart: number | null;
  settings: DeskSettings;
  weakTopics: WeakTopic[];
  todos: TodoItem[];
  lastLecture: { subject: SubjectId; label: string } | null;
  todayLectures: number;
};

export type Reward = { xp: number; label: string } | null;

export type DeskResult = { desk: Desk; reward: Reward };
