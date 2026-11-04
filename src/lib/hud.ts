import type { Session } from "../data/types";

// HUD do treino (Fase 1 do design): segmentos de séries do dia e o log de fim de treino.
// Funções puras; a tela só desenha.

export interface HudSegment {
  exId: string;
  setId: string;
  state: "done" | "next" | "todo";
  /** Série com −15%. */
  drop: boolean;
  /** Primeira série de um exercício (a barra abre um espaço antes). */
  first: boolean;
}

/** Uma casa por série de trabalho do treino, na ordem da ficha. "next" = a primeira que falta. */
export function hudSegments(session: Session): HudSegment[] {
  const out: HudSegment[] = [];
  let nextMarked = false;
  for (const e of session.exercises) {
    let first = true;
    for (const s of e.sets) {
      if (s.kind === "warmup") continue;
      let state: HudSegment["state"] = s.done ? "done" : "todo";
      if (!s.done && !nextMarked) {
        state = "next";
        nextMarked = true;
      }
      out.push({ exId: e.exId, setId: s.id, state, drop: s.kind === "drop", first });
      first = false;
    }
  }
  return out;
}

export interface FinishLogInput {
  dayCode: string;
  dayName: string;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  minutes: number;
  prs: number;
  /** Nomes dos exercícios que sobem de carga na próxima sessão. */
  up: string[];
  same: number;
  down: number;
  /** Data do último backup (AAAA-MM-DD) ou undefined. */
  backupAt?: string;
  today: string;
}

const WIDTH = 22;

/** "//SÉRIES" + pontos até a coluna de valor. */
function row(label: string, value: string): string {
  const head = `//${label}`;
  return `${head}${".".repeat(Math.max(2, WIDTH - head.length))} ${value}`;
}

/** Linhas do log de fim de treino, no formato de terminal. */
export function finishLogLines(i: FinishLogInput): string[] {
  const t = (i.volumeKg / 1000).toFixed(1).replace(".", ",");
  const lines = [
    `//PROTOCOLO_${i.dayCode} :: ${i.dayName.toUpperCase()}`,
    row("SÉRIES", `${i.setsDone}/${i.setsPlanned} ${i.setsDone >= i.setsPlanned ? "COMPLETO" : "PARCIAL"}`),
    row("VOLUME", `${t} t`),
    row("DURAÇÃO", `${i.minutes} min`),
    row("RECORDES", i.prs ? `${i.prs} NOVO${i.prs > 1 ? "S" : ""}` : "0"),
    row("PRÓXIMA_SESSÃO", i.up.length ? `SOBE ${i.up.length}` : "MANTÉM CARGAS"),
  ];
  for (const name of i.up.slice(0, 3)) lines.push(`//  ↑ ${name}`);
  if (i.up.length > 3) lines.push(`//  ↑ +${i.up.length - 3}`);
  if (i.same || i.down) lines.push(row("MANTÉM/BAIXA", `${i.same}/${i.down}`));
  lines.push(
    row("BACKUP", i.backupAt === i.today ? "OK" : i.backupAt ? `ÚLTIMO ${i.backupAt.split("-").reverse().join("/")}` : "PENDENTE"),
  );
  lines.push("//UPLOAD_COMPLETO");
  return lines;
}
