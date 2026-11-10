// Primeiro uso: três respostas simples escolhem um dos modelos prontos. Sem isso, quem instala cairia no PPL 5 dias,
// que é um programa avançado.
import { TEMPLATES, type TemplateInfo } from "../data/templates";
import { PPL_PROGRAM_ID } from "../data/templates/ppl";
import type { Program } from "../data/types";
import { mondayOf, todayISO } from "./dates";
import { activateProgram, db, saveProgram, saveSettings } from "./db";
import { fromTemplate } from "./program-edit";

export type Level = "iniciante" | "intermediario" | "avancado";
export type Focus = "geral" | "gluteo";

export interface OnboardingAnswers {
  /** Quantos dias por semana a pessoa consegue treinar (3 a 6). */
  days: number;
  level: Level;
  focus: Focus;
}

export interface Recommendation {
  template: TemplateInfo;
  /** Por que este, em uma frase. Vazio quando a escolha é direta. */
  note: string;
}

const byId = (id: string): TemplateInfo => TEMPLATES.find((t) => t.id === id)!;

/**
 * Escolhe o modelo. Regras:
 * - iniciante nunca passa de 4 dias (mais dias não rende mais no começo e aumenta a chance de desistir);
 * - 3 dias = corpo todo; 4 = superior/inferior; 5 = PPL 5 dias; 6 = PPL 6 dias;
 * - foco em glúteos usa a variante de cada divisão.
 */
export function recommendTemplate(a: OnboardingAnswers): Recommendation {
  const days = Math.max(3, Math.min(6, Math.round(a.days)));
  const capped = a.level === "iniciante" && days > 4;
  const d = capped ? 4 : days;
  const note = capped
    ? "No começo, 4 treinos bem feitos rendem tanto quanto 6 e sobra recuperação. Dá para trocar de programa quando quiser."
    : "";
  if (a.focus === "gluteo") {
    // A linha de glúteos não tem modelo de 5 dias: quem pede 5 fica no de 4 (melhor sobrar um dia que faltar).
    const id = d <= 3 ? "fb-3-gluteo" : d <= 5 ? "ul-4-gluteo" : "ppl-6-gluteo";
    return {
      template: byId(id),
      note: note || (d === 5 ? "Para foco em glúteos, o modelo de 4 dias já entrega o volume. O quinto dia fica livre." : ""),
    };
  }
  if (d <= 3) return { template: byId("fb-3"), note };
  if (d === 4) return { template: byId(a.level === "avancado" ? "ul-forca" : "ul-4"), note };
  if (d === 5) return { template: byId("ppl-v2"), note };
  return { template: byId("ppl-6"), note };
}

/**
 * Aplica a escolha: cria o programa, põe em uso e ajusta os dias de treino.
 * No primeiro uso (`operator` informado) também grava o nome, começa o mesociclo nesta semana e tira da lista o PPL
 * criado por padrão, se não foi o escolhido. Por dentro do app (Programas → "me ajude a escolher"), o mesociclo e o
 * nome ficam como estão.
 */
export async function applyOnboarding(templateId: string, operator?: string): Promise<Program> {
  const t = byId(templateId);
  let program: Program;
  if (t.id === PPL_PROGRAM_ID) {
    program = (await db.programs.get(PPL_PROGRAM_ID)) ?? t.make();
  } else {
    program = fromTemplate(t.make());
  }
  await saveProgram(program);
  await activateProgram(program.id);
  if (operator === undefined) {
    await saveSettings({ trainingDays: t.trainingDays, onboarded: true });
    return program;
  }
  await saveSettings({ operator: operator.trim(), trainingDays: t.trainingDays, mesoStart: mondayOf(todayISO()), onboarded: true });
  if (program.id !== PPL_PROGRAM_ID && (await db.sessions.count()) === 0) await db.programs.delete(PPL_PROGRAM_ID);
  return program;
}

/** Pular o assistente: fica o programa que já estava e não pergunta de novo. */
export async function skipOnboarding(): Promise<void> {
  await saveSettings({ onboarded: true });
}
