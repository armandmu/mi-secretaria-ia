import { AppData, Priority, Proposal, Space, Task, uid, toDateLocal } from "./types";

export function spaceName(space: Space) {
  return space === "personal" ? "Personal" : "Profesional";
}
export function isSpace(value: unknown): value is Space {
  return value === "personal" || value === "profesional";
}
export function isPriority(value: unknown): value is Priority {
  return value === "alta" || value === "media" || value === "baja";
}
export function visible<T extends {space: Space}>(items: T[], scope: string): T[] {
  return scope === "todos" ? items : items.filter((x) => x.space === scope);
}
export function dayOffset(n: number) {
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + n);
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}
export function detectDue(text: string): string | null {
  if (/\bpasado mañana\b/i.test(text)) return dayOffset(2);
  if (/\bmañana\b/i.test(text)) return dayOffset(1);
  if (/\bhoy\b/i.test(text)) return dayOffset(0);
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
  if (match) {
    const yyyy = Number(match[3] || new Date().getFullYear());
    const mm = Number(match[2]);
    const dd = Number(match[1]);
    const date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
      return [yyyy, String(mm).padStart(2, "0"), String(dd).padStart(2, "0")].join("-");
    }
  }
  return null;
}
export function brief(data: AppData, scope: string) {
  const tasks = visible(data.tasks, scope).filter((x) => !x.done);
  const now = dayOffset(0);
  const soon = dayOffset(7);
  const overdue = tasks.filter((x) => x.due && x.due < now);
  const upcoming = tasks.filter((x) => x.due && x.due >= now && x.due <= soon);
  const high = tasks.filter((x) => x.priority === "alta");
  return { tasks, overdue, upcoming, high, total: tasks.length };
}
export function prioritise(a: Task, b: Task) {
  if (a.done !== b.done) return Number(a.done) - Number(b.done);
  const weight: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
  const first = (a.due || "9999-12-31");
  const second = (b.due || "9999-12-31");
  return first.localeCompare(second) || weight[a.priority] - weight[b.priority];
}
export function proposeLocally(text: string, space: Space, data: AppData): {reply:string; proposals:Proposal[]} {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  if (/^(hola|buenos días|buenas|qué tengo|que tengo|resumen|prioridades|qué es urgente|que es urgente)/i.test(lower)) {
    const b = brief(data, space);
    const items = [...b.overdue, ...b.high.filter(x => !b.overdue.includes(x))].slice(0, 3).map(x => "• " + x.title);
    return { reply: "Tienes " + b.total + " tareas pendientes, " + b.overdue.length + " vencidas y " + b.upcoming.length + " con fecha en los próximos 7 días." + (items.length ? "\n\nPara empezar:\n" + items.join("\n") : "\n\nTu lista está al día."), proposals: [] };
  }
  const project = raw.match(/^(?:crea|crear|abre|abrir)\s+(?:un\s+)?proyecto(?:\s+(?:llamado|de|para))?\s+(.+)$/i);
  if (project) return {reply:"He preparado el proyecto. Confírmalo para guardarlo.", proposals:[{type:"create_project", name:project[1].trim(), space}]};
  const note = raw.match(/^(?:anota|guarda|recuerda que|nota:)\s+(.+)/i);
  if (note) return {reply:"He preparado una nota para tu memoria. Confirma si quieres guardarla.",proposals:[{type:"add_note",text:note[1].trim(),space}]};
  const task = raw.match(/^(?:recuérdame(?:\s+que)?|tengo que|apunta(?:\s+que)?|añade(?:\s+una)?\s+tarea(?:\s+para)?|necesito)\s+(.+)/i);
  if (task) return {reply:"He identificado una tarea y la he dejado pendiente de tu aprobación.",proposals:[{type:"create_task", title:task[1].trim(), space, due:detectDue(raw), priority:/urgente|importante/i.test(raw)?"alta":"media"}]};
  return {reply:"Puedo organizar tareas, proyectos y notas. Prueba con «Recuérdame revisar la propuesta mañana» o «Crea un proyecto llamado Web». En el modo conectado, la IA podrá comprender peticiones más complejas.",proposals:[]};
}
export function applyProposals(data: AppData, proposals: Proposal[], fallback: Space): AppData {
  const next: AppData = {
    tasks: [...data.tasks],
    projects: [...data.projects],
    memories: [...data.memories],
    messages: [...data.messages]
  };
  for (const p of proposals) {
    const space = ("space" in p && isSpace(p.space)) ? p.space : fallback;
    if (p.type === "create_project" && p.name?.trim()) {
      next.projects.push({id:uid(),name:p.name.trim().slice(0,140),description:(p.description || "").slice(0,400),space,createdAt:new Date().toISOString()});
    }
    if (p.type === "add_note" && p.text?.trim()) {
      next.memories.push({id:uid(),text:p.text.trim().slice(0,1200),space,createdAt:new Date().toISOString()});
    }
    if (p.type === "create_task" && p.title?.trim()) {
      let projectId: string | null = null;
      if (p.project) projectId = next.projects.find(x => x.space === space && x.name.toLowerCase() === p.project?.toLowerCase())?.id || null;
      next.tasks.push({id:uid(),title:p.title.trim().slice(0,220),description:(p.description || "").slice(0,800),space,projectId,due:p.due && /^\d{4}-\d{2}-\d{2}$/.test(p.due) ? p.due : null,priority:isPriority(p.priority)?p.priority:"media",done:false,createdAt:new Date().toISOString()});
    }
    if (p.type === "complete_task" && p.taskId) {
      next.tasks = next.tasks.map(t => t.id === p.taskId ? {...t,done:true} : t);
    }
  }
  return next;
}
export function googleCalendarUrl(task: Task) {
  const iso = task.due || dayOffset(0);
  const end = new Date(toDateLocal(iso));
  end.setDate(end.getDate() + 1);
  const format = (d: Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("");
  const params = new URLSearchParams({
    action:"TEMPLATE",
    text:task.title,
    dates:iso.replaceAll("-","") + "/" + format(end),
    details:task.description || "Evento propuesto por Mi Secretaria IA. Confirma su creación en Google Calendar."
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
