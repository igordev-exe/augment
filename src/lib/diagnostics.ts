import { dayById, exById, MUSCLE_LABEL, shortName } from "../data/program";
import type { BodyEntry, Session, Settings } from "../data/types";
import { EMPTY_OPERATOR_MEMORY, operatorBrief, operatorState, type OperatorMemory, type OperatorState } from "./core/operator";
import { addDays, mondayOf } from "./dates";
import { bodyAdvice, fatigueAlert, regressingExercises, type NudgeTone } from "./engine";
import { setsFor, weekFor } from "./mesocycle";
import { historyOf, increaseStep, suggestNext } from "./progression";
import { weeklyReport } from "./report";
import { planAhead } from "./schedule";
import { unitFor } from "./sessions";

// Diagnóstico do motor (aba "Motor" do relatório, estilo laudo): o que as regras estão vendo agora, num lugar só.

export interface Diagnostic {
  /** Código curto da área, como num laudo. */
  area: "FADIGA" | "PROGR" | "VOLUME" | "CORPO" | "AJUSTE" | "GÊMEO";
  tone: NudgeTone;
  title: string;
  text: string;
  /** Princípio da base científica. */
  why: string;
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

export function engineDiagnostics(input: {
  sessions: Session[];
  settings: Settings;
  bodyLog: BodyEntry[];
  today: string;
  memory?: OperatorMemory;
  operator?: OperatorState;
}): Diagnostic[] {
  const { sessions, settings, bodyLog, today } = input;
  const done = sessions.filter((s) => s.status === "done");
  const out: Diagnostic[] = [];
  const op = input.operator ?? operatorState(sessions, bodyLog, settings, input.memory ?? EMPTY_OPERATOR_MEMORY, today);
  if (done.length > 0 || op.activeConstraints.length > 0) {
    const brief = operatorBrief(op);
    out.push({
      area: "GÊMEO",
      tone: brief.tone,
      title: brief.headline,
      text: brief.detail,
      why: "feedback-volume",
    });
  }

  // Fadiga: alerta de deload antecipado e queda de reps na mesma carga.
  const fatigue = fatigueAlert(sessions, settings.mesoStart, today, settings.reentryDismissed);
  const regressing = regressingExercises(sessions, today);
  if (fatigue) {
    out.push({
      area: "FADIGA",
      tone: "warn",
      title: `Fadiga acumulada na semana ${fatigue.week}`,
      text: `${fatigue.reasons.join(", ")}. O app propõe antecipar o deload.`,
      why: "volume-cego",
    });
  } else if (regressing.length) {
    out.push({
      area: "FADIGA",
      tone: "warn",
      title: "Reps caindo na mesma carga",
      text: `${list(regressing)}. Um exercício só não dispara o deload; vigie sono e proteína.`,
      why: "volume-cego",
    });
  } else if (done.length) {
    out.push({
      area: "FADIGA",
      tone: "good",
      title: "Sem sinal de fadiga acumulada",
      text: "Nenhum exercício com reps caindo na mesma carga nos últimos 10 dias.",
      why: "volume-cego",
    });
  }

  // Progressão: o que o motor manda no próximo treino.
  const next = planAhead(sessions, today, 7, settings.trainingDays)[0];
  const day = next ? dayById(next.dayId) : undefined;
  if (day && done.length) {
    const week = weekFor(settings.mesoStart, next!.date);
    const up: string[] = [];
    const down: string[] = [];
    let same = 0;
    for (const ex of day.exercises) {
      const alt = settings.swaps?.[ex.id] || undefined;
      const h = historyOf(done, ex.id, alt);
      if (!h.length) continue;
      const unit = unitFor(ex.id, settings, h[h.length - 1].entry);
      const s = suggestNext(
        ex,
        h,
        setsFor(ex, week, settings.setAdjust?.[ex.id]),
        week,
        increaseStep(ex, unit, settings.increments[ex.id]),
        settings.machineWeights?.[ex.id],
      );
      if (s.kind === "up") up.push(shortName(ex));
      else if (s.kind === "down") down.push(shortName(ex));
      else same += 1;
    }
    const parts = [up.length ? `sobe ${list(up)}` : "", down.length ? `baixa ${list(down)}` : "", same ? `mantém ${same}` : ""].filter(
      Boolean,
    );
    out.push({
      area: "PROGR",
      tone: up.length ? "good" : down.length ? "warn" : "info",
      title: `Próximo treino: ${day.name}`,
      text: parts.length ? `${parts.join(" · ")}.` : "Sem histórico dos exercícios desse treino ainda.",
      why: "progressao",
    });
  }

  // Volume e estagnação da semana passada (fechada).
  const lastWeek = addDays(mondayOf(today), -7);
  const r = weeklyReport(sessions, lastWeek, settings.mesoStart, settings.trainingDays, today, settings.setAdjust);
  if (r.done > 0) {
    if (r.belowMinimum.length) {
      out.push({
        area: "VOLUME",
        tone: "warn",
        title: "Abaixo da dose mínima na semana passada",
        text: `${list(r.belowMinimum.map((m) => MUSCLE_LABEL[m]))}: menos de 4 séries fracionadas.`,
        why: "volume-dose",
      });
    } else {
      out.push({
        area: "VOLUME",
        tone: "good",
        title: "Dose mínima cumprida na semana passada",
        text: "Todo músculo com plano passou de 4 séries fracionadas.",
        why: "volume-dose",
      });
    }
    if (r.stalls.length) {
      out.push({
        area: "PROGR",
        tone: "warn",
        title: "Estagnação",
        text: `${list(r.stalls.map((s) => shortName(exById(s.exId))))}: 3 sessões sem 1RM estimado novo. O app baixa ~10% para destravar.`,
        why: "progressao",
      });
    }
  }

  // Corpo: a regra do plano alimentar.
  for (const n of bodyAdvice(bodyLog, settings.bodyGoal, sessions, today)) {
    out.push({ area: "CORPO", tone: n.tone, title: "Peso e dieta", text: n.text, why: n.why });
  }

  // Ajustes ativos de séries.
  const adj = Object.entries(settings.setAdjust ?? {}).filter(([id]) => exById(id));
  if (adj.length) {
    out.push({
      area: "AJUSTE",
      tone: "info",
      title: `${adj.length} ajuste${adj.length > 1 ? "s" : ""} de séries ativo${adj.length > 1 ? "s" : ""}`,
      text: adj.map(([id, n]) => `${shortName(exById(id))} ${n > 0 ? "+" : "−"}${Math.abs(n)}`).join(" · "),
      why: "feedback-volume",
    });
  }
  return out;
}
