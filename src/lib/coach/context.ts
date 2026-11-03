import { LIB_BY_ID } from "../../data/library";
import { DAY_BY_ID, EXERCISE_BY_ID, PROGRAM, shortName } from "../../data/program";
import type { Session, SessionExercise, Settings } from "../../data/types";
import { addDays, daysBetween, mondayOf, weekdayName } from "../dates";
import { reentryFor, rirRange, setsFor, stopFor, weekFor, WEEK_RULES } from "../mesocycle";
import { formatWeight, historyOf, increaseStep, recordsOf, suggest, workSets } from "../progression";
import { weeklyReport } from "../report";
import { planAhead } from "../schedule";
import { unitFor } from "../sessions";

// Contexto do treinador (LLM): o prompt fixo e as ferramentas que leem os registros.
// Usado pelo app (Fase 3) e pelo script `npm run coach` (Fase 0). Nada aqui chama a API.

export interface CoachData {
  sessions: Session[];
  settings: Settings;
  today: string;
}

/** A ficha inteira em texto, com os ids que as ferramentas aceitam. Determinístico (bom para cache). */
export function programText(): string {
  const lines: string[] = [];
  for (const d of PROGRAM) {
    lines.push(`### ${d.name} (id do dia: ${d.id}) — ${d.focus}`);
    for (const n of d.notes) lines.push(`Obs.: ${n}`);
    for (const ex of d.exercises) {
      const lib = LIB_BY_ID[ex.lib];
      const tags = [
        ex.compound ? "composto" : "isolado",
        ex.iso ? "−1 série na semana 1" : "",
        ex.up ? "▲ +1 série nas semanas 4–6" : "",
        ex.superset ? `superset ${ex.superset.order === 1 ? "A1" : "A2"}` : "",
        ex.perSide ? "por lado" : "",
      ].filter(Boolean);
      lines.push(
        `- ${ex.id}: ${ex.name}. ${ex.muscleLabel}. ${ex.sets}×${ex.reps[0]}–${ex.reps[1]}, descanso ${ex.restLabel}, ` +
          `até onde: ${ex.stop === "F" ? "falha (isolado)" : ex.stop === "T" ? "falha técnica" : "sobra 2"}. ` +
          `Incremento ${ex.increment} kg. ${tags.join(", ")}.` +
          (ex.intensifier ? ` Intensificador: ${ex.intensifier}.` : "") +
          (ex.tempo ? ` Cadência: ${ex.tempo}.` : "") +
          (ex.cues.length ? ` Dicas: ${ex.cues.join(" ")}` : "") +
          (lib?.alternatives?.length ? ` Alternativas: ${lib.alternatives.join("; ")}.` : ""),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function weekRulesText(): string {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((w) => {
      const r = WEEK_RULES[w];
      return `- ${r.label}: ${r.summary} Compostos: ${r.compounds}. Isolados: ${r.isolations}. Intensificadores: ${r.intensifierLabel}.`;
    })
    .join("\n");
}

/** Prompt de sistema fixo. Não pode ter data, hora ou nada que mude entre pedidos (quebraria o cache). */
export function coachSystem(name = "Igor"): string {
  return `Você é o treinador de ${name} dentro do AUGMENT, o app de treino dele. Ele segue um programa de hipertrofia fixo (abaixo) num mesociclo de 6 semanas + deload, 5 treinos por semana.

## Como você trabalha
- Responda em português do Brasil, direto e curto, como um treinador experiente falando no celular entre séries. Use listas curtas quando ajudar. Nada de enrolação nem elogio vazio.
- Números vêm das ferramentas, nunca da memória ou de chute. Antes de falar de cargas, reps, frequência ou recordes, consulte as ferramentas. Se a ferramenta não tem o dado, diga que não tem.
- As cargas da próxima sessão são decididas pelo motor de regras do app (dupla progressão, abaixo). Você explica, contextualiza e aponta o que fazer, mas não inventa outra carga: se discordar, explique por quê e deixe a decisão com ele.
- Mudanças no app (incremento de carga de um exercício, recomeçar o mesociclo, repetir a semana) só por \`propor_ajuste\`: ele vê um cartão e decide. Nunca diga que algo foi aplicado.
- Leve a sério dor e articulação: sugira reduzir amplitude, trocar pela alternativa da biblioteca ou parar, e procurar avaliação profissional quando a dor persistir ou for forte. Você não diagnostica lesão.
- Leia as anotações e o check-in dele: sono, energia, cardio, academia cheia explicam muita coisa.
- Priorize: um foco claro vale mais que dez observações.

## Regras do programa
- Dupla progressão com carga fixa: todas as séries de trabalho com a mesma carga. Quando TODAS baterem o topo da faixa, sobe o incremento. Se a 1ª série ficar abaixo do piso, baixa ~10%. Dentro da faixa, mantém e busca +1 rep por série.
- Se o salto de carga for maior que 7,5% e a previsão de reps (Epley invertido) na carga nova ficar abaixo do piso, o app mantém a carga e pede reps acima do topo antes de subir.
- −15% na última série: se uma série cair abaixo do piso, a última vai com 15% a menos.
- Séries de rampa não contam como trabalho; quando as cargas de trabalho variam mais de 20%, o app usa a mais pesada como referência.
- "Sobra" = reps que sobraram (RIR) marcadas depois de cada série; 4 significa 4 ou mais.
- A agenda segue a sequência Push A → Pull A → Lower A → Upper B → Lower B e nunca pula treino: dia perdido empurra a sequência.
- Após 10+ dias parado, recomeça o mesociclo na semana 1; com menos da metade dos treinos numa semana, repete a semana.
- Deload (semana 7): metade das séries, mesma carga, ~4 reps sobrando; depois troque 2–3 acessórios (bons candidatos: os estagnados).

## Semanas do mesociclo
${weekRulesText()}

## Programa (ids entre parênteses e antes dos dois-pontos são os aceitos pelas ferramentas)
${programText()}`;
}

// ---------- Resumos para as ferramentas ----------

function setsLine(e: SessionExercise): string {
  return e.sets
    .filter((s) => s.done && s.kind !== "warmup")
    .map(
      (s) =>
        `${formatWeight(s.weight)}×${s.reps}${s.kind === "drop" ? " (−15%)" : ""}${s.rir != null ? ` sobra ${s.rir >= 4 ? "4+" : s.rir}` : ""}`,
    )
    .join(", ");
}

function sessionSummary(s: Session) {
  const minutes = s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null;
  return {
    data: s.date,
    dia_semana: weekdayName(s.date),
    treino: DAY_BY_ID[s.dayId]?.name ?? s.dayId,
    semana_meso: s.week,
    duracao_min: minutes,
    checkin: s.checkin && !s.checkin.skipped ? s.checkin : undefined,
    anotacoes: s.notes || undefined,
    exercicios: s.exercises.map((e) => ({
      id: e.exId,
      nome: shortName(EXERCISE_BY_ID[e.exId]),
      series: setsLine(e) || "não feito",
      unidade: e.unit,
      como_bateu: e.feedback && !e.feedback.skipped ? e.feedback : undefined,
      anotacao: e.notes || undefined,
    })),
  };
}

function done(data: CoachData): Session[] {
  return data.sessions.filter((s) => s.status === "done");
}

function isISO(x: unknown): x is string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

/** Erro de entrada: vira tool_result com is_error. */
export class ToolInputError extends Error {}

export function toolPlan(data: CoachData) {
  const { settings, today } = data;
  const week = weekFor(settings.mesoStart, today);
  const all = done(data);
  const plan = planAhead(data.sessions, today, 7, settings.trainingDays);
  const next = plan[0];
  const nextDay = next ? DAY_BY_ID[next.dayId] : undefined;
  const last = [...all].sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1))[0];
  const reentry = reentryFor(
    all.map((s) => s.date),
    settings.mesoStart,
    today,
    settings.trainingDays,
    settings.reentryDismissed,
  );
  return {
    hoje: today,
    dia_semana: weekdayName(today),
    semana_meso: week,
    regra_da_semana: WEEK_RULES[week],
    inicio_mesociclo: settings.mesoStart,
    dias_de_treino: settings.trainingDays,
    ultimo_treino: last ? { data: last.date, treino: DAY_BY_ID[last.dayId]?.name, dias_atras: daysBetween(last.date, today) } : null,
    aviso_retomada: reentry,
    agenda_7_dias: plan.map((p) => ({ data: p.date, dia_semana: weekdayName(p.date), treino: DAY_BY_ID[p.dayId].name })),
    proximo_treino: nextDay
      ? {
          data: next!.date,
          treino: nextDay.name,
          exercicios: nextDay.exercises.map((ex) => {
            const h = historyOf(all, ex.id);
            const lastItem = h[h.length - 1];
            const unit = unitFor(ex.id, settings, lastItem?.entry);
            const sug = suggest(
              ex,
              lastItem?.entry,
              setsFor(ex, week),
              week,
              increaseStep(ex, unit, settings.increments[ex.id]),
              lastItem?.session.week,
            );
            return {
              id: ex.id,
              nome: shortName(ex),
              series: setsFor(ex, week),
              faixa: `${ex.reps[0]}–${ex.reps[1]}`,
              ate_onde: stopFor(ex.stop, week).label,
              sobra_meta: rirRange(ex.stop, week),
              sugestao: `${sug.title}. ${sug.detail}`,
              observacoes: sug.notes.length ? sug.notes : undefined,
            };
          }),
        }
      : null,
  };
}

export function toolWeekReport(data: CoachData, input: { semana?: unknown }) {
  const start = input.semana == null ? addDays(mondayOf(data.today), -7) : isISO(input.semana) ? mondayOf(input.semana) : null;
  if (!start) throw new ToolInputError("semana deve ser uma data AAAA-MM-DD.");
  const r = weeklyReport(data.sessions, start, data.settings.mesoStart, data.settings.trainingDays);
  const name = (id: string) => shortName(EXERCISE_BY_ID[id]);
  return {
    semana: `${start} a ${addDays(start, 6)}`,
    em_andamento: start === mondayOf(data.today),
    semana_meso: r.mesoWeek,
    treinos_feitos: r.done,
    treinos_planejados: r.planned,
    treinos: r.sessions.map((s) => `${s.date} ${DAY_BY_ID[s.dayId]?.name}`),
    nao_feitos: r.missingDays.map((d) => DAY_BY_ID[d].name),
    series_faltando: r.shortfalls.map((s) => ({ data: s.date, exercicio: name(s.exId), feitas: s.done, planejadas: s.planned })),
    volume_por_musculo: r.volume.map((v) => ({ musculo: v.muscle, feitas: v.done, meta: v.planned })),
    sobra: {
      series_marcadas: r.rir.logged,
      na_meta: r.rir.inTarget,
      mais_perto_da_falha_que_a_meta: r.rir.harder.map((m) => ({ exercicio: name(m.exId), data: m.date, sobra: m.rir, meta: m.target })),
      sobrou_demais: r.rir.easier.map((m) => ({ exercicio: name(m.exId), data: m.date, sobra: m.rir, meta: m.target })),
    },
    estagnados: r.stalls.map((s) => ({ exercicio: name(s.exId), ultimas: s.trail })),
    recordes: r.prs.map((p) => ({ data: p.date, exercicio: name(p.exId), texto: p.text })),
    sinais: r.signals,
    articulacao: r.joints.map((j) => ({ exercicio: name(j.exId), vezes_3_semanas: j.times, alternativas: j.alternatives })),
    foco_calculado: r.focus,
  };
}

export function toolExerciseHistory(data: CoachData, input: { exercicio?: unknown }) {
  const ex = typeof input.exercicio === "string" ? EXERCISE_BY_ID[input.exercicio] : undefined;
  if (!ex) throw new ToolInputError("exercicio deve ser um id do programa, ex.: pull-a.puxada-aberta.");
  const h = historyOf(done(data), ex.id);
  const rec = recordsOf(h);
  const week = weekFor(data.settings.mesoStart, data.today);
  const lastItem = h[h.length - 1];
  const unit = unitFor(ex.id, data.settings, lastItem?.entry);
  const sug = suggest(
    ex,
    lastItem?.entry,
    setsFor(ex, week),
    week,
    increaseStep(ex, unit, data.settings.increments[ex.id]),
    lastItem?.session.week,
  );
  return {
    id: ex.id,
    nome: shortName(ex),
    faixa: `${ex.reps[0]}–${ex.reps[1]}`,
    incremento: increaseStep(ex, unit, data.settings.increments[ex.id]),
    sessoes: h.slice(-8).map(({ session, entry }) => ({
      data: session.date,
      semana_meso: session.week,
      series: setsLine(entry),
      como_bateu: entry.feedback && !entry.feedback.skipped ? entry.feedback : undefined,
      anotacao: entry.notes || undefined,
      series_de_trabalho: workSets(entry).length,
    })),
    total_sessoes: h.length,
    recordes: {
      carga_maxima: rec.heaviest ? `${formatWeight(rec.heaviest.weight)}×${rec.heaviest.reps} em ${rec.heaviest.date}` : null,
      e1rm: rec.bestE1rm
        ? `${Math.round(rec.bestE1rm.value)} kg (${formatWeight(rec.bestE1rm.weight)}×${rec.bestE1rm.reps}, ${rec.bestE1rm.date})`
        : null,
    },
    sugestao_proxima: { titulo: sug.title, detalhe: sug.detail, observacoes: sug.notes },
  };
}

export function toolSessions(data: CoachData, input: { de?: unknown; ate?: unknown }) {
  const ate = input.ate == null ? data.today : isISO(input.ate) ? input.ate : null;
  const de = input.de == null ? addDays(ate ?? data.today, -27) : isISO(input.de) ? input.de : null;
  if (!de || !ate) throw new ToolInputError("de e ate devem ser datas AAAA-MM-DD.");
  if (daysBetween(de, ate) > 62) throw new ToolInputError("Intervalo máximo: 62 dias.");
  return done(data)
    .filter((s) => s.date >= de && s.date <= ate)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(sessionSummary);
}

export type Proposal =
  | { tipo: "incremento"; exercicio: string; valor: number; motivo: string }
  | { tipo: "recomecar_mesociclo"; motivo: string }
  | { tipo: "repetir_semana"; motivo: string };

export function parseProposal(input: Record<string, unknown>): Proposal {
  const motivo = typeof input.motivo === "string" ? input.motivo.trim() : "";
  if (!motivo) throw new ToolInputError("motivo é obrigatório.");
  if (input.tipo === "incremento") {
    const ex = typeof input.exercicio === "string" ? EXERCISE_BY_ID[input.exercicio] : undefined;
    const valor = typeof input.valor === "number" ? input.valor : NaN;
    if (!ex) throw new ToolInputError("exercicio deve ser um id do programa.");
    if (!(valor > 0 && valor <= 10)) throw new ToolInputError("valor deve ser um incremento em kg entre 0 e 10.");
    return { tipo: "incremento", exercicio: ex.id, valor, motivo };
  }
  if (input.tipo === "recomecar_mesociclo" || input.tipo === "repetir_semana") return { tipo: input.tipo, motivo };
  throw new ToolInputError("tipo deve ser incremento, recomecar_mesociclo ou repetir_semana.");
}

/** O que o cartão da proposta diz. */
export function describeProposal(p: Proposal, settings: Settings, today: string): string {
  if (p.tipo === "incremento") {
    const ex = EXERCISE_BY_ID[p.exercicio];
    const cur = settings.increments[p.exercicio] ?? ex.increment;
    return `${shortName(ex)}: incremento de ${formatWeight(cur)} → ${formatWeight(p.valor)} kg`;
  }
  const week = weekFor(settings.mesoStart, today);
  if (p.tipo === "recomecar_mesociclo") return `Recomeçar o mesociclo na semana 1 (hoje: semana ${week})`;
  return `Repetir a semana ${Math.max(1, week - 1)} (hoje: semana ${week})`;
}

/** Mudança nos ajustes que a proposta aplica. */
export function proposalPatch(p: Proposal, settings: Settings, today: string): Partial<Settings> {
  if (p.tipo === "incremento") return { increments: { ...settings.increments, [p.exercicio]: p.valor } };
  if (p.tipo === "recomecar_mesociclo") return { mesoStart: mondayOf(today), reentryDismissed: mondayOf(today) };
  return weekFor(settings.mesoStart, today) > 1 ? { mesoStart: addDays(settings.mesoStart, 7), reentryDismissed: mondayOf(today) } : {};
}

/** Executa uma ferramenta do treinador. Lança ToolInputError para entrada inválida. */
export function runCoachTool(name: string, input: Record<string, unknown>, data: CoachData): unknown {
  switch (name) {
    case "plano_atual":
      return toolPlan(data);
    case "relatorio_semana":
      return toolWeekReport(data, input);
    case "historico_exercicio":
      return toolExerciseHistory(data, input);
    case "treinos":
      return toolSessions(data, input);
    case "propor_ajuste": {
      const p = parseProposal(input);
      return {
        status: "mostrado",
        proposta: describeProposal(p, data.settings, data.today),
        aviso: "Ele vê um cartão com Aplicar/Recusar. Não diga que foi aplicado; diga que ele pode aplicar no cartão.",
      };
    }
    default:
      throw new ToolInputError(`Ferramenta desconhecida: ${name}`);
  }
}

/** Linha de contexto que vai na frente de cada mensagem dele (data muda; por isso fica fora do sistema). */
export function turnContext(data: CoachData): string {
  const week = weekFor(data.settings.mesoStart, data.today);
  return `[Hoje: ${data.today}, ${weekdayName(data.today)}. ${WEEK_RULES[week].label} do mesociclo.]`;
}
