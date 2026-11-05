export type Space = "personal" | "profesional";
export type Scope = Space | "todos";
export type Priority = "alta" | "media" | "baja";

export type Task = {
  id: string;
  title: string;
  description: string;
  space: Space;
  projectId: string | null;
  due: string | null;
  priority: Priority;
  done: boolean;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  space: Space;
  description: string;
  createdAt: string;
};

export type MemoryNote = {
  id: string;
  text: string;
  space: Space;
  createdAt: string;
};

export type Proposal =
  | { type: "create_task"; title: string; description?: string; space?: Space; due?: string | null; priority?: Priority; project?: string }
  | { type: "create_project"; name: string; description?: string; space?: Space }
  | { type: "add_note"; text: string; space?: Space }
  | { type: "complete_task"; taskId: string };

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  proposals?: Proposal[];
  applied?: boolean;
};

export type AppData = {
  tasks: Task[];
  projects: Project[];
  memories: MemoryNote[];
  messages: Message[];
};

export const emptyData = (): AppData => ({
  tasks: [],
  projects: [],
  memories: [],
  messages: []
});

export const uid = () => crypto.randomUUID();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function toDateLocal(iso: string): Date {
  const parts = iso.slice(0, 10).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
