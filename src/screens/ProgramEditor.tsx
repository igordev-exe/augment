import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { LIBRARY, LIB_MUSCLES } from "../data/library";
import { EQUIP_LABEL, EXTENDED } from "../data/library-extended";
import { MUSCLE_LABEL, MUSCLE_ORDER } from "../data/program";
import { SCIENCE } from "../data/science";
import type { MuscleId, Program, ProgramDay, ProgramExercise, StopKind } from "../data/types";
import { activateProgram, db, saveProgram } from "../lib/db";
import { useProgram, useSettings, useToast } from "../lib/hooks";
import {
  addDay,
  addExercise,
  customExercise,
  exerciseFromLibrary,
  moveDay,
  moveExercise,
  programIssues,
  removeDay,
  removeExercise,
  renameProgram,
  setPeriodization,
  toggleSupersetWithNext,
  updateDay,
  updateExercise,
  type ExercisePatch,
} from "../lib/program-edit";
import { plannedVolume } from "../lib/sessions";

// Montador de treino: dias em ordem de rotação, exercícios de cada dia e os campos que o motor usa.
// Tudo salva sozinho (300 ms depois da última mudança). O histórico não muda: cada treino guarda o retrato dos
// exercícios como eram no dia.

const STOPS: { id: StopKind; label: string; hint: string }[] = [
  { id: "F", label: "Falha", hint: "isolados e máquinas" },
  { id: "T", label: "Falha técnica", hint: "compostos" },
  { id: "R", label: "Sobra 2", hint: "nunca à falha" },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function NumField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => setText(String(value).replace(".", ",")), [value]);
  return (
    <label className="pe-num" htmlFor={id}>
      <span className="label">{label}</span>
      <span className="pe-num-row">
        <button type="button" aria-label={`Menos em ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = Number(text.replace(",", "."));
            if (Number.isFinite(n)) onChange(n);
            else setText(String(value));
          }}
        />
        <button type="button" aria-label={`Mais em ${label}`} onClick={() => onChange(value + step)}>
          +
        </button>
      </span>
      {suffix && <span className="tiny faint">{suffix}</span>}
    </label>
  );
}

function MusclePicker({
  value,
  onChange,
  label = "Músculos (série direta)",
}: {
  value: MuscleId[];
  onChange: (m: MuscleId[]) => void;
  label?: string;
}) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label">{label}</span>
      <div className="row-wrap pe-chips" role="group" aria-label={label}>
        {MUSCLE_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            className="pe-chip"
            aria-pressed={value.includes(m)}
            onClick={() => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])}
          >
            {MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExerciseForm({
  ex,
  onPatch,
  canSuperset,
  onSuperset,
}: {
  ex: ProgramExercise;
  onPatch: (p: ExercisePatch) => void;
  canSuperset: boolean;
  onSuperset: () => void;
}) {
  const base = ex.id.replace(/[^a-z0-9]/gi, "-");
  return (
    <div className="pe-form stack">
      <label className="stack" style={{ gap: 4 }} htmlFor={`${base}-name`}>
        <span className="label">Nome</span>
        <input id={`${base}-name`} className="input" defaultValue={ex.name} onBlur={(e) => onPatch({ name: e.target.value })} />
      </label>
      <div className="pe-grid">
        <NumField id={`${base}-sets`} label="Séries" value={ex.sets} min={1} onChange={(n) => onPatch({ sets: n })} />
        <NumField
          id={`${base}-r0`}
          label="Reps mín."
          value={ex.reps[0]}
          min={1}
          onChange={(n) => onPatch({ reps: [n, Math.max(n, ex.reps[1])] })}
        />
        <NumField
          id={`${base}-r1`}
          label="Reps máx."
          value={ex.reps[1]}
          min={1}
          onChange={(n) => onPatch({ reps: [Math.min(ex.reps[0], n), n] })}
        />
        <NumField
          id={`${base}-s0`}
          label="Descanso mín."
          value={ex.rest[0]}
          step={15}
          onChange={(n) => onPatch({ rest: [n, Math.max(n, ex.rest[1])] })}
          suffix="segundos"
        />
        <NumField
          id={`${base}-s1`}
          label="Descanso máx."
          value={ex.rest[1]}
          step={15}
          onChange={(n) => onPatch({ rest: [Math.min(ex.rest[0], n), n] })}
          suffix={ex.restLabel}
        />
        <NumField
          id={`${base}-inc`}
          label="Incremento"
          value={ex.increment}
          step={0.5}
          min={0.5}
          onChange={(n) => onPatch({ increment: n })}
          suffix="kg por subida"
        />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="label">Até onde ir</span>
        <div className="row-wrap" role="group" aria-label="Até onde ir">
          {STOPS.map((s) => (
            <button key={s.id} type="button" className="pe-chip" aria-pressed={ex.stop === s.id} onClick={() => onPatch({ stop: s.id })}>
              {s.label}
              <small>{s.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="row-wrap" role="group" aria-label="Tipo e regras do mesociclo">
        <button type="button" className="pe-chip" aria-pressed={ex.compound} onClick={() => onPatch({ compound: !ex.compound })}>
          Composto
          <small>{ex.compound ? "progressão por carga" : "isolado"}</small>
        </button>
        <button type="button" className="pe-chip" aria-pressed={!!ex.iso} onClick={() => onPatch({ iso: !ex.iso || undefined })}>
          −1 série na semana 1
        </button>
        <button type="button" className="pe-chip" aria-pressed={!!ex.up} onClick={() => onPatch({ up: !ex.up || undefined })}>
          ▲ +1 série nas semanas 4–6
        </button>
        <button
          type="button"
          className="pe-chip"
          aria-pressed={!!ex.perSide}
          onClick={() => onPatch({ perSide: !ex.perSide || undefined })}
        >
          Por lado
        </button>
        {canSuperset && (
          <button type="button" className="pe-chip" aria-pressed={ex.superset?.order === 1} onClick={onSuperset}>
            Superset com o próximo
          </button>
        )}
      </div>

      <label className="stack" style={{ gap: 4 }} htmlFor={`${base}-int`}>
        <span className="label">Intensificador da última série (opcional)</span>
        <input
          id={`${base}-int`}
          className="input"
          placeholder="ex.: Drop-set −25%, rest-pause"
          defaultValue={ex.intensifier ?? ""}
          onBlur={(e) => onPatch({ intensifier: e.target.value })}
        />
      </label>

      <MusclePicker value={ex.muscles} onChange={(m) => onPatch({ muscles: m })} />
    </div>
  );
}

function AddExercise({
  onAdd,
  onClose,
}: {
  onAdd: (make: (taken: Set<string>, dayId: string) => ProgramExercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [muscles, setMuscles] = useState<MuscleId[]>([]);
  const [compound, setCompound] = useState(false);
  const [full, setFull] = useState(false);
  const query = norm(q.trim());
  // Curada primeiro (português, com execução); com "Completa", a ampliada (inglês) entra depois.
  const all = [
    ...LIBRARY.map((l) => ({ id: l.id, name: l.name, muscles: LIB_MUSCLES[l.id] ?? [], equip: l.equipment, extra: l.primary })),
    ...(full
      ? EXTENDED.map((e) => ({ id: e.id, name: e.name, muscles: e.muscles, equip: EQUIP_LABEL[e.equip] ?? "Outro", extra: "" }))
      : []),
  ];
  const matches = all.filter(
    (l) => !query || norm(`${l.name} ${l.extra} ${l.equip} ${l.muscles.map((m) => MUSCLE_LABEL[m]).join(" ")}`).includes(query),
  );
  const items = matches.slice(0, 60);

  return (
    <div data-augmented-ui="tl-clip br-clip border" className="card flat stack pe-add">
      <div className="spread">
        <span className="label">Adicionar exercício</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="ws-switch" role="group" aria-label="Origem do exercício">
        <button type="button" aria-pressed={!custom} onClick={() => setCustom(false)}>
          Biblioteca
        </button>
        <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>
          Personalizado
        </button>
      </div>
      {!custom ? (
        <>
          <input
            className="input"
            type="search"
            placeholder="Buscar por nome, músculo ou aparelho"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar exercício"
          />
          <div className="ws-switch" role="group" aria-label="Biblioteca">
            <button type="button" aria-pressed={!full} onClick={() => setFull(false)}>
              Curada · {LIBRARY.length}
            </button>
            <button type="button" aria-pressed={full} onClick={() => setFull(true)}>
              Completa · {LIBRARY.length + EXTENDED.length}
            </button>
          </div>
          <ul className="pe-lib">
            {items.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onAdd((taken, dayId) => exerciseFromLibrary(l.id, dayId, taken))}>
                  <strong>{l.name}</strong>
                  <span className="tiny faint">
                    {l.muscles.map((m) => MUSCLE_LABEL[m]).join(", ")} · {l.equip}
                  </span>
                  <span className="pe-plus" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="small muted">
                {full
                  ? "Nada com esse nome. Use “Personalizado”."
                  : "Nada na curada. Tente “Completa” (nomes em inglês) ou “Personalizado”."}
              </li>
            )}
            {matches.length > items.length && <li className="tiny faint">Mostrando 60 de {matches.length}. Refine a busca.</li>}
          </ul>
        </>
      ) : (
        <div className="stack">
          <label className="stack" style={{ gap: 4 }} htmlFor="pe-custom-name">
            <span className="label">Nome</span>
            <input
              id="pe-custom-name"
              className="input"
              placeholder="ex.: Remada cavalinho"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <MusclePicker value={muscles} onChange={setMuscles} />
          <button
            type="button"
            className="pe-chip"
            aria-pressed={compound}
            onClick={() => setCompound((v) => !v)}
            style={{ alignSelf: "flex-start" }}
          >
            Composto
            <small>{compound ? "progressão por carga" : "isolado"}</small>
          </button>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-primary"
            disabled={!name.trim() || !muscles.length}
            onClick={() => {
              onAdd((taken, dayId) => customExercise(name, muscles, dayId, taken, { compound }));
              setName("");
              setMuscles([]);
            }}
          >
            Adicionar
          </button>
          <span className="tiny faint">
            Exercício personalizado não tem foto nem passo a passo; o resto (cargas, recordes, volume) funciona igual.
          </span>
        </div>
      )}
    </div>
  );
}

function stopLabel(s: StopKind) {
  return STOPS.find((x) => x.id === s)!.label;
}

function DayCard({
  day,
  index,
  total,
  apply,
}: {
  day: ProgramDay;
  index: number;
  total: number;
  apply: (fn: (p: Program) => Program) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <article data-augmented-ui="tl-clip br-clip border" className="card stack pe-day">
      <div className="pe-day-head">
        <span className="pe-day-idx">{String(index + 1).padStart(2, "0")}</span>
        <input
          className="input pe-day-name"
          aria-label={`Nome do dia ${index + 1}`}
          defaultValue={day.name}
          onBlur={(e) => e.target.value.trim() && apply((p) => updateDay(p, day.id, { name: e.target.value.trim() }))}
        />
        <input
          className="input pe-day-code"
          aria-label={`Sigla do dia ${index + 1}`}
          defaultValue={day.code}
          maxLength={3}
          key={day.code}
          onBlur={(e) => e.target.value.trim() && apply((p) => updateDay(p, day.id, { code: e.target.value.trim() }))}
        />
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={index === 0}
          onClick={() => apply((p) => moveDay(p, day.id, -1))}
          aria-label="Mover dia para cima"
        >
          ↑
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={index === total - 1}
          onClick={() => apply((p) => moveDay(p, day.id, 1))}
          aria-label="Mover dia para baixo"
        >
          ↓
        </button>
        <span className="tiny faint grow">{day.exercises.length} exercícios</span>
      </div>

      <ol className="pe-exs">
        {day.exercises.map((ex, i) => {
          const open = editing === ex.id;
          return (
            <li key={ex.id} className={`pe-ex${open ? " open" : ""}`}>
              <div className="pe-ex-row">
                <span className="pe-ex-idx">{ex.superset ? (ex.superset.order === 1 ? "A1" : "A2") : String(i + 1).padStart(2, "0")}</span>
                <button type="button" className="pe-ex-main" aria-expanded={open} onClick={() => setEditing(open ? null : ex.id)}>
                  <strong>{ex.name}</strong>
                  <span className="tiny faint">
                    {ex.sets} × {ex.reps[0]}–{ex.reps[1]} · {stopLabel(ex.stop)} · {ex.restLabel} · {ex.muscleLabel}
                  </span>
                </button>
                <span className="pe-ex-tools">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => apply((p) => moveExercise(p, ex.id, -1))}
                    aria-label={`Subir ${ex.name}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === day.exercises.length - 1}
                    onClick={() => apply((p) => moveExercise(p, ex.id, 1))}
                    aria-label={`Descer ${ex.name}`}
                  >
                    ↓
                  </button>
                </span>
              </div>
              {open && (
                <>
                  <ExerciseForm
                    ex={ex}
                    onPatch={(patch) => apply((p) => updateExercise(p, ex.id, patch))}
                    canSuperset={i < day.exercises.length - 1 || ex.superset?.order === 1}
                    onSuperset={() => apply((p) => toggleSupersetWithNext(p, ex.id))}
                  />
                  <HoldButton
                    className="btn-danger btn-sm"
                    label={`Remover ${ex.name}`}
                    onConfirm={() => apply((p) => removeExercise(p, ex.id))}
                  >
                    Remover do dia
                  </HoldButton>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {adding ? (
        <AddExercise
          onClose={() => setAdding(false)}
          onAdd={(make) => {
            apply((p) => addExercise(p, day.id, (taken) => make(taken, day.id)));
          }}
        />
      ) : (
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm" onClick={() => setAdding(true)}>
          + Exercício
        </button>
      )}
      {total > 1 && (
        <HoldButton className="btn-danger btn-sm" label={`Remover ${day.name}`} onConfirm={() => apply((p) => removeDay(p, day.id))}>
          Remover dia
        </HoldButton>
      )}
    </article>
  );
}

function PlanVolume({ program, adjust }: { program: Program; adjust?: Record<string, number> }) {
  const week = program.periodization === "fixed" ? 0 : 2;
  const vol = plannedVolume(week, true, adjust, program.days);
  const min = SCIENCE.volume.minEffective;
  const eff = SCIENCE.volume.efficient[0];
  const max = Math.max(20, ...MUSCLE_ORDER.map((m) => vol[m]));
  return (
    <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
      <div className="spread">
        <h2 className="h-sec">Séries por semana</h2>
        <span className="tiny faint">{week === 0 ? "programa fixo" : "semana base (2)"}</span>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>
        Séries fracionadas (1 por série direta, 0,5 por sinergista). Abaixo de {min} é pouco para crescer; {eff}+ é a faixa de melhor
        estímulo. {week === 0 ? "" : "Nas semanas 4–6, os ▲ ganham +1 série."}
      </p>
      <div className="pv-list">
        {MUSCLE_ORDER.map((m) => {
          const v = vol[m];
          const tone = v < min ? "warn" : v >= eff ? "ok" : "";
          return (
            <div key={m} className={`pv-row ${tone}`}>
              <span>{MUSCLE_LABEL[m]}</span>
              <span className="pv-track" aria-hidden="true">
                <i style={{ width: `${(v / max) * 100}%` }} />
                <u style={{ left: `${(min / max) * 100}%` }} />
                <u className="eff" style={{ left: `${(eff / max) * 100}%` }} />
              </span>
              <b>{String(Math.round(v * 10) / 10).replace(".", ",")}</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ProgramEditor() {
  const { id } = useParams();
  const stored = useLiveQuery(() => (id ? db.programs.get(id) : undefined), [id]);
  const active = useProgram();
  const [settings] = useSettings();
  const toast = useToast();
  const [draft, setDraft] = useState<Program | null>(null);
  const timer = useRef<number>();
  const latest = useRef<Program | null>(null);

  // Rascunho começa no que está salvo; daí em diante a tela é a fonte (o banco recebe depois de 300 ms).
  useEffect(() => {
    if (stored && !draft) setDraft(stored);
  }, [stored, draft]);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (latest.current) saveProgram(latest.current).catch(() => {});
    },
    [],
  );

  const issues = useMemo(() => (draft ? programIssues(draft) : []), [draft]);

  if (stored === undefined && !draft) return null;
  if (!draft) {
    return (
      <div className="stack-lg">
        <PageHead back="/programas" title="Programa não encontrado" />
        <Link to="/programas" className="btn">
          Ver programas
        </Link>
      </div>
    );
  }

  function apply(fn: (p: Program) => Program) {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      latest.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        saveProgram(next)
          .then(() => (latest.current = null))
          .catch(() => toast("Não deu para salvar o programa.", "warn"));
      }, 300);
      return next;
    });
  }

  const isActive = draft.id === active.id;
  const nEx = draft.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <div className="stack-lg">
      <PageHead
        back="/programas"
        code="AUG.OS // MONTADOR"
        title={draft.name}
        sub={`${draft.days.length} dias em rotação · ${nEx} exercícios. Salva sozinho; os treinos já feitos não mudam.`}
      />

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <label className="stack" style={{ gap: 4 }} htmlFor="pe-name">
          <span className="label">Nome do programa</span>
          <input
            id="pe-name"
            className="input"
            defaultValue={draft.name}
            onBlur={(e) => e.target.value.trim() && apply((p) => renameProgram(p, e.target.value.trim()))}
          />
        </label>
        <div className="stack" style={{ gap: 6 }}>
          <span className="label">Periodização</span>
          <div className="row-wrap" role="group" aria-label="Periodização">
            <button
              type="button"
              className="pe-chip"
              aria-pressed={draft.periodization !== "fixed"}
              onClick={() => apply((p) => setPeriodization(p, "meso"))}
            >
              Mesociclo 6 + 1<small>sobe o esforço por semana, deload na 7ª</small>
            </button>
            <button
              type="button"
              className="pe-chip"
              aria-pressed={draft.periodization === "fixed"}
              onClick={() => apply((p) => setPeriodization(p, "fixed"))}
            >
              Fixo
              <small>mesmas séries toda semana</small>
            </button>
          </div>
        </div>
        {isActive ? (
          <span className="pg-tag" style={{ alignSelf: "flex-start" }}>
            EM USO
          </span>
        ) : (
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-primary"
            disabled={issues.length > 0}
            onClick={async () => {
              window.clearTimeout(timer.current);
              await saveProgram(draft);
              latest.current = null;
              await activateProgram(draft.id);
              toast(`${draft.name} em uso.`, "ok");
            }}
          >
            Usar este programa
          </button>
        )}
        {issues.map((i) => (
          <div key={i.text} className="callout warn">
            {i.text}
          </div>
        ))}
      </section>

      <PlanVolume program={draft} adjust={settings.setAdjust} />

      <section className="stack">
        <div className="spread">
          <h2 className="h-sec">Dias (em rotação)</h2>
          <span className="tiny faint">a agenda segue esta ordem</span>
        </div>
        {draft.days.map((d, i) => (
          <DayCard key={d.id} day={d} index={i} total={draft.days.length} apply={apply} />
        ))}
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={() => apply((p) => addDay(p))}>
          + Dia
        </button>
      </section>
    </div>
  );
}
