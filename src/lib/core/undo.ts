import type { BodyEntry, Session, Settings } from "../../data/types";
import type { CommandAction, CommandProposal } from "./commands";
import type { IntentProposal } from "./intents";
import type { OperatorMemory, OperatorNote } from "./operator";

// AUG.CORE — bloco B do chat potente: aplicar e desfazer o que o chat propõe. Puro: recebe o estado e devolve o
// estado novo; a tela grava as partes que mudaram. Cada aplicação guarda o "antes" das partes que tocou, e desfazer
// devolve exatamente esse antes. Valem as 5 últimas, por 10 minutos, só na conversa aberta.

/** Lembrança que o chat propõe guardar (bloco D). */
export interface NoteProposal {
  note?: OperatorNote;
  /** "Esquece que…": id da lembrança a tirar. */
  forgetNoteId?: string;
  confirmLabel: string;
}

/** Proposta que a tela mostra com Aplicar/Recusar. */
export type CoreProposal =
  | ({ source: "intent" } & IntentProposal)
  | ({ source: "command" } & CommandProposal)
  | ({ source: "note" } & NoteProposal)
  | { source: "batch"; items: CoreProposal[]; then?: CommandAction[]; confirmLabel: string }
  | { source: "undo"; confirmLabel: string };

export interface ChatState {
  /** Só as sessões que podem mudar (em andamento). */
  sessions: Session[];
  bodyLog: BodyEntry[];
  settings: Settings;
  memory: OperatorMemory;
}

export type UndoStep =
  | { kind: "session"; before: Session }
  | { kind: "body"; before: BodyEntry[] }
  | { kind: "settings"; before: Partial<Settings> }
  | { kind: "memory"; before: Pick<OperatorMemory, "constraints" | "absences" | "notes"> };

export interface UndoRecord {
  label: string;
  at: number;
  steps: UndoStep[];
}

export const UNDO_MAX = 5;
export const UNDO_TTL = 10 * 60_000;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const sortBody = (l: BodyEntry[]) => [...l].sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

/** Aplica a proposta no estado (sem gravar). `newId` cria o id de um registro novo. */
export function applyPure(s: ChatState, p: CoreProposal, newId: () => string): ChatState {
  switch (p.source) {
    case "batch":
      return p.items.reduce((st, it) => applyPure(st, it, newId), s);
    case "undo":
      return s;
    case "intent": {
      let memory = s.memory;
      if (p.constraint) {
        const c = p.constraint;
        memory = { ...memory, constraints: [...memory.constraints.filter((x) => x.id !== c.id && x.kind !== c.kind), c] };
      }
      if (p.absence) memory = { ...memory, absences: [...(memory.absences ?? []), p.absence] };
      return { ...s, memory };
    }
    case "note": {
      let notes = s.memory.notes ?? [];
      if (p.forgetNoteId) notes = notes.filter((n) => n.id !== p.forgetNoteId);
      if (p.note) {
        const n = p.note;
        // A mesma coisa dita de novo troca a anterior ("não gosto de agachamento" duas vezes não duplica).
        notes = [...notes.filter((x) => !(x.kind === n.kind && x.target && x.target === n.target)), n];
      }
      return { ...s, memory: { ...s.memory, notes } };
    }
    case "command": {
      if (p.kind === "settings") return { ...s, settings: { ...s.settings, ...p.patch } };
      if (p.kind === "body-weight") {
        const same = s.bodyLog.find((b) => b.date === p.date);
        const entry: BodyEntry = { ...(same ?? { id: newId(), date: p.date }), weightKg: p.weightKg };
        return { ...s, bodyLog: sortBody([entry, ...s.bodyLog.filter((b) => b.id !== entry.id)]) };
      }
      const idx = s.sessions.findIndex((x) => x.id === p.sessionId);
      const cur = s.sessions[idx];
      if (!cur || cur.status !== "active") return s;
      const next = clone(cur);
      const e = next.exercises.find((x) => x.exId === p.exId);
      if (!e) return s;
      if (p.kind === "log-set") {
        const set = e.sets.find((x) => x.id === p.setId);
        if (!set) return s;
        Object.assign(set, { weight: p.weight, reps: p.reps, done: true, doneAt: Date.now() });
        delete set.suggested;
      } else {
        e.alt = p.alt;
        // Carga da alternativa é outra: limpa as sugestões pendentes (o treino sugere de novo ao abrir a série).
        for (const x of e.sets)
          if (x.kind === "work" && !x.done) {
            x.weight = null;
            delete x.suggested;
          }
      }
      const sessions = [...s.sessions];
      sessions[idx] = next;
      return { ...s, sessions };
    }
  }
}

/** O "antes" das partes que a proposta toca (para desfazer). Null quando não há nada a desfazer. */
export function undoFor(s: ChatState, p: CoreProposal, label: string, now: number): UndoRecord | null {
  const steps: UndoStep[] = [];
  const seen = new Set<string>();
  const add = (key: string, step: () => UndoStep | null) => {
    if (seen.has(key)) return;
    seen.add(key);
    const st = step();
    if (st) steps.push(st);
  };
  const walk = (q: CoreProposal) => {
    if (q.source === "batch") return q.items.forEach(walk);
    if (q.source === "undo") return;
    if (q.source === "intent" || q.source === "note")
      return add("memory", () => ({
        kind: "memory",
        before: clone({ constraints: s.memory.constraints, absences: s.memory.absences, notes: s.memory.notes }),
      }));
    if (q.kind === "settings")
      return add(`settings:${Object.keys(q.patch).join(",")}`, () => ({
        kind: "settings",
        before: clone(Object.fromEntries(Object.keys(q.patch).map((k) => [k, s.settings[k as keyof Settings]]))) as Partial<Settings>,
      }));
    if (q.kind === "body-weight") return add("body", () => ({ kind: "body", before: clone(s.bodyLog) }));
    add(`session:${q.sessionId}`, () => {
      const cur = s.sessions.find((x) => x.id === q.sessionId);
      return cur ? { kind: "session", before: clone(cur) } : null;
    });
  };
  walk(p);
  return steps.length ? { label, at: now, steps } : null;
}

/** Devolve o estado de antes. */
export function revertPure(s: ChatState, rec: UndoRecord): ChatState {
  let out = s;
  for (const st of rec.steps) {
    if (st.kind === "session") out = { ...out, sessions: out.sessions.map((x) => (x.id === st.before.id ? clone(st.before) : x)) };
    else if (st.kind === "body") out = { ...out, bodyLog: clone(st.before) };
    else if (st.kind === "settings") out = { ...out, settings: { ...out.settings, ...clone(st.before) } };
    else {
      const m = { ...out.memory, constraints: clone(st.before.constraints) };
      if (st.before.absences) m.absences = clone(st.before.absences);
      else delete m.absences;
      if (st.before.notes) m.notes = clone(st.before.notes);
      else delete m.notes;
      out = { ...out, memory: m };
    }
  }
  return out;
}

/** Pilha de desfazer: entra no topo, até 5, e só as dos últimos 10 minutos. */
export function pushUndo(stack: UndoRecord[], rec: UndoRecord | null, now: number): UndoRecord[] {
  const live = stack.filter((r) => now - r.at <= UNDO_TTL);
  return rec ? [rec, ...live].slice(0, UNDO_MAX) : live;
}

/** A mais recente ainda válida. */
export function latestUndo(stack: UndoRecord[], now: number): UndoRecord | undefined {
  return stack.find((r) => now - r.at <= UNDO_TTL);
}
