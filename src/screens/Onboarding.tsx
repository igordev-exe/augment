import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark, Wordmark } from "../components/Brand";
import { apiUrl } from "../lib/online/client";
import { applyOnboarding, recommendTemplate, skipOnboarding, type Focus, type Level } from "../lib/onboarding";
import { heroSrc } from "../data/personas";
import { TEMPLATES } from "../data/templates";

// Assistente de primeiro uso: uma pergunta por tela, respostas de um toque, e no fim o programa sugerido.
// Aparece só em instalação nova (sem treinos). Dá para pular em qualquer passo.

const STEPS = 4;

function Choice({ title, hint, onClick }: { title: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" data-augmented-ui="tl-clip br-clip border" className="ob-choice" onClick={onClick}>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </button>
  );
}

/** `inApp`: aberto pelo próprio app (Programas), para quem já usa: sem boas-vindas e sem mexer no mesociclo. */
export function Onboarding({ inApp = false }: { inApp?: boolean }) {
  const navigate = useNavigate();
  const first = inApp ? 1 : 0;
  const [step, setStep] = useState(first);
  const [name, setName] = useState("");
  const [days, setDays] = useState(4);
  const [level, setLevel] = useState<Level>("iniciante");
  const [focus, setFocus] = useState<Focus>("geral");
  const [pickId, setPickId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rec = recommendTemplate({ days, level, focus });
  const chosen = TEMPLATES.find((t) => t.id === pickId) ?? rec.template;
  const next = () => setStep((s) => s + 1);

  async function finish() {
    setBusy(true);
    await applyOnboarding(chosen.id, inApp ? undefined : name);
    navigate(inApp ? "/programas" : "/", { replace: true });
  }

  async function skip(to = "/") {
    if (!inApp) await skipOnboarding();
    navigate(inApp ? "/programas" : to, { replace: true });
  }

  return (
    <div className="ob">
      <header className="ob-head">
        <span className="brand">
          <BrandMark />
          <Wordmark />
        </span>
        <button type="button" className="ob-skip" onClick={() => skip()}>
          {inApp ? "Fechar" : "Pular"}
        </button>
      </header>

      {step < STEPS && (
        <div className="ob-progress" role="img" aria-label={`Passo ${step + 1} de ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <i key={i} className={i <= step ? "on" : ""} />
          ))}
        </div>
      )}

      {step === 0 && (
        <section className="stack ob-step">
          <div className="ob-hero" aria-hidden="true">
            <img src={heroSrc(undefined)} alt="" width={720} height={720} decoding="async" />
            <span className="scan-line" />
            <span className="ob-hero-tag">BIO-LINK // OPERADOR</span>
          </div>
          <div className="eyebrow">Iniciando sistema</div>
          <h1 className="h-page">Bem-vindo ao Augment</h1>
          <p className="muted">Três perguntas rápidas e o app monta o seu programa de treino. Dá para mudar tudo depois.</p>
          <label className="label" htmlFor="ob-name">
            Como o app te chama? (opcional)
          </label>
          <input
            id="ob-name"
            className="input"
            maxLength={24}
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary btn-big" onClick={next}>
            Começar
          </button>
          <button type="button" className="ob-link" onClick={() => skip(apiUrl() ? "/online" : "/ajustes")}>
            Já uso o Augment: restaurar meus dados
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="stack ob-step">
          <h1 className="h-page">Quantos dias por semana você consegue treinar?</h1>
          <p className="muted">Escolha o que cabe na sua rotina de verdade. Menos dias bem feitos valem mais que muitos dias faltando.</p>
          {[3, 4, 5, 6].map((n) => (
            <Choice
              key={n}
              title={`${n} dias`}
              hint={
                n === 3
                  ? "Bom para começar ou para semana corrida"
                  : n === 4
                    ? "O equilíbrio mais comum"
                    : n === 5
                      ? "Quase todo dia"
                      : "Todo dia, um de descanso"
              }
              onClick={() => {
                setDays(n);
                next();
              }}
            />
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="stack ob-step">
          <h1 className="h-page">Há quanto tempo você treina musculação?</h1>
          <Choice
            title="Estou começando"
            hint="Menos de 6 meses, ou voltando depois de muito tempo"
            onClick={() => {
              setLevel("iniciante");
              next();
            }}
          />
          <Choice
            title="Já treino há um tempo"
            hint="De 6 meses a 2 anos, com alguma regularidade"
            onClick={() => {
              setLevel("intermediario");
              next();
            }}
          />
          <Choice
            title="Treino há anos"
            hint="Mais de 2 anos, conheço bem os exercícios"
            onClick={() => {
              setLevel("avancado");
              next();
            }}
          />
        </section>
      )}

      {step === 3 && (
        <section className="stack ob-step">
          <h1 className="h-page">O que você quer priorizar?</h1>
          <Choice
            title="Corpo todo por igual"
            hint="Volume equilibrado entre todos os músculos"
            onClick={() => {
              setFocus("geral");
              next();
            }}
          />
          <Choice
            title="Glúteos e pernas"
            hint="Mais séries para glúteos e pernas, sem abandonar o resto"
            onClick={() => {
              setFocus("gluteo");
              next();
            }}
          />
        </section>
      )}

      {step === STEPS && (
        <section className="stack ob-step">
          <div className="eyebrow">Programa sugerido</div>
          <h1 className="h-page">{chosen.name}</h1>
          <p>{chosen.pitch}</p>
          {rec.note && chosen.id === rec.template.id && <p className="strong-note small">{rec.note}</p>}
          <p className="small muted">
            O app organiza as semanas sozinho: a 1ª semana calibra o seu perfil individual de recuperação e cargas, sobe aos poucos até a
            semana 6 e fecha com uma semana de descanso ativo.
          </p>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-primary btn-big"
            onClick={finish}
            disabled={busy}
          >
            {busy ? "Montando…" : "Começar com este"}
          </button>
          <details className="ob-others">
            <summary>Ver os outros programas</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              {TEMPLATES.filter((t) => t.id !== chosen.id).map((t) => (
                <Choice key={t.id} title={t.name} hint={`${t.level}. ${t.pitch}`} onClick={() => setPickId(t.id)} />
              ))}
            </div>
          </details>
          <button type="button" className="ob-link" onClick={() => setStep(1)}>
            Responder de novo
          </button>
        </section>
      )}

      {step > first && step < STEPS && (
        <button type="button" className="ob-link" onClick={() => setStep((s) => s - 1)}>
          &lt; Voltar
        </button>
      )}
    </div>
  );
}
