import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { BandPanel, Gauge, Hex, ListPanel, ListRow, NumBlock, SegBar, Slot, WarnPlate, type HexState } from "../components/Pieces";
import { Ticker } from "../components/Ticker";
import { avatarSrc, DEFAULT_PERSONA } from "../data/personas";
import { shortDate, todayISO } from "../lib/dates";
import { playReward } from "../lib/fx";
import { RECORD_BUZZ, useToast, type ToastTone } from "../lib/hooks";
import { vibrate } from "../lib/native";
import { SECTOR_LABEL, SECTORS, type Sector } from "../lib/sector";
import "./Kit.css";

// Vitrine das peças de jogo (MC0 do docs/plano-refino-visual.md). Só existe no desenvolvimento: o App só registra
// a rota #/kit com import.meta.env.DEV, então ela não entra no build de produção. Números de exemplo, sem dados
// pessoais. Serve para o dono aprovar a cara das peças antes dos módulos M1–M6.

const TOKENS: [string, string][] = [
  ["--t-toque", "90 ms · resposta ao dedo"],
  ["--t-mira", "140 ms · seleção muda"],
  ["--t-ligar", "220 ms + 40 ms por item, até 6"],
  ["--t-leitura", "500 ms · número e barra"],
  ["--t-recompensa", "400 ms · recorde, meta, posto, meso"],
  ["--ease-seco", "cubic-bezier(.2, .8, .2, 1)"],
];

const PICKS = ["Peito", "Costas", "Ombros", "Braços", "Pernas", "Core"];

function SectorMatrix() {
  return (
    <div className="kit-matrix">
      {SECTORS.map((s) => (
        <div key={s} className={`kit-cell sector-${s}`}>
          <div className="band kit-band">
            <span className="band-mark" aria-hidden="true" />
            <span className="band-title">{SECTOR_LABEL[s]}</span>
          </div>
          <div className="kit-cell-row">
            <NumBlock value="-03" />
            <Hex state="on" label="Aceso" value="4" />
          </div>
          <SegBar value={6} max={10} size="s" label={`Barra do setor ${SECTOR_LABEL[s]}`} />
        </div>
      ))}
    </div>
  );
}

/** Uma frase por tom para a vitrine do balão (?balao=<tom> abre já com ele, para fotos). */
const BUBBLE_DEMO: [ToastTone, string][] = [
  ["info", "Pull A hoje: 7 exercícios, perto de 55 min. Costas prontas."],
  ["ok", "Protocolo concluído e salvo."],
  ["warn", "Descanso curto demais para composto: espere pelo menos 2 min."],
  ["danger", "Dor no peito em treino: pare agora e procure atendimento."],
  ["reward", "Recorde no supino: 82,5 kg × 8."],
];

export function Kit() {
  // #/kit?setor=tel&deload=1 abre já num setor (para as fotos de revisão).
  const [params] = useSearchParams();
  const toast = useToast();
  const balao = params.get("balao");
  useEffect(() => {
    const demo = BUBBLE_DEMO.find(([t]) => t === balao);
    if (!demo) return;
    if (params.get("botoes"))
      toast(demo[1], demo[0], undefined, {
        actions: [
          { label: "Aplicar", onPress: () => {}, primary: true },
          { label: "Recusar", onPress: () => {} },
        ],
        sticky: true,
      });
    else toast(demo[1], demo[0], undefined, { sticky: true });
  }, [balao]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sector, setSector] = useState<Sector>(() => SECTORS.find((s) => s === params.get("setor")) ?? "op");
  const [deload, setDeload] = useState(() => params.get("deload") === "1" || document.documentElement.classList.contains("mode-deload"));
  const [run, setRun] = useState(0); // remonta a vitrine: dispara "ligar" e "leitura" de novo
  const [hexSel, setHexSel] = useState(1);
  const [pick, setPick] = useState<string | null>("Costas");
  const rewardRef = useRef<HTMLDivElement>(null);

  // Trocar só o ?setor= não remonta a tela: acompanha a URL.
  const qSector = params.get("setor");
  const qDeload = params.get("deload");
  useEffect(() => {
    const s = SECTORS.find((x) => x === qSector);
    if (s) setSector(s);
    if (qDeload != null) setDeload(qDeload === "1");
  }, [qSector, qDeload]);

  // Deload de mentira só enquanto a vitrine está aberta; ao sair, volta ao que era.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.classList.contains("mode-deload");
    return () => {
      root.classList.toggle("mode-deload", before);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("mode-deload", deload);
  }, [deload]);

  const hexes: { label: string; value: string }[] = [
    { label: "Recruta", value: "I" },
    { label: "Operador", value: "II" },
    { label: "Veterano", value: "III" },
    { label: "Elite", value: "IV" },
  ];
  const hexState = (i: number): HexState => (i === hexSel ? "sel" : i <= 2 ? "on" : "off");

  return (
    <div className="stack-lg">
      <div className="pc-noise" aria-hidden="true" />
      <PageHead code="AUG.OS // KIT DE PEÇAS · DEV" title="Kit" sub="Peças de jogo do refino visual. Só no desenvolvimento." />

      <BandPanel title="Controle" micro={shortDate(todayISO())}>
        <div className="stack">
          <div className="list-label">Setor</div>
          <div className="kit-picks kit-picks-2" role="group" aria-label="Setor da vitrine">
            {SECTORS.map((s) => (
              <button key={s} type="button" className="kit-pick is-mode aim" aria-pressed={sector === s} onClick={() => setSector(s)}>
                {SECTOR_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="list-label">Movimento</div>
          <div className="kit-actions">
            <button type="button" className="kit-pick" onClick={() => setRun((n) => n + 1)}>
              Ligar + leitura
            </button>
            <button
              type="button"
              className="kit-pick"
              onClick={() => {
                vibrate(RECORD_BUZZ);
                playReward(rewardRef.current);
              }}
            >
              Recompensa
            </button>
            <button type="button" className="kit-pick aim" aria-pressed={deload} onClick={() => setDeload((d) => !d)}>
              Deload
            </button>
          </div>
        </div>
      </BandPanel>

      <div key={run} className={`stack-lg fx-ligar sector-${sector}`}>
        <BandPanel title="Painel principal" micro={`${SECTOR_LABEL[sector]} · S03`}>
          <div className="stack">
            <div className="kit-figures">
              <div ref={rewardRef} className="kit-figure">
                <span className="kit-num">
                  <Ticker value={12480} />
                </span>
                <span className="list-label">kg na semana</span>
              </div>
              <div className="kit-figure">
                <span className="kit-num">
                  <Ticker value={4} />
                  <small>/5</small>
                </span>
                <span className="list-label">treinos</span>
              </div>
            </div>
            <Gauge label="Meta da semana" value="4 de 5">
              <SegBar value={4} max={5} segs={5} size="l" label="Meta da semana: 4 de 5 treinos" read />
            </Gauge>
            <p className="small kit-note">
              Faixa cheia na cor do setor, título escuro e microtexto com dado real na ponta. Um ou dois por tela.
            </p>
          </div>
        </BandPanel>

        <ListPanel label="Painel com linhas">
          <ListRow title="Timer de descanso" value="2:30 · som e vibração" onClick={() => {}} />
          <ListRow title="Dias de treino" value="Seg · Ter · Qui · Sex · Sáb" onClick={() => {}} />
          <ListRow title="Efeitos visuais" value="Máximo" onClick={() => {}} />
        </ListPanel>

        <section className="stack">
          <div className="list-label">Slots com cantoneiras</div>
          <div className="kit-slots">
            <Slot label="Avatar">
              <img src={avatarSrc(DEFAULT_PERSONA)} alt="" width={192} height={192} />
            </Slot>
            <Slot label="Foto" onClick={() => {}} />
            <Slot label="Frente" />
            <Slot label="Costas" />
          </div>
        </section>

        <section className="stack">
          <div className="list-label">Hexágonos entalhados · toque para mirar</div>
          <div className="kit-hexes">
            {hexes.map((h, i) => (
              <Hex key={h.label} state={hexState(i)} label={h.label} value={i <= 2 ? h.value : undefined} onClick={() => setHexSel(i)} />
            ))}
          </div>
        </section>

        <section className="stack">
          <div className="list-label">Blocos de número</div>
          <div className="kit-nums">
            <NumBlock value="S03" label="Semana" />
            <NumBlock value="-02" label="Dia" variant="line" />
            <NumBlock value="#4" label="Posição" />
          </div>
        </section>

        <section className="stack">
          <div className="list-label">Placas de aviso</div>
          <WarnPlate title="Zona de perigo">Apagar todos os dados do aparelho. Não dá para desfazer.</WarnPlate>
          <WarnPlate kind="alert" title="Fadiga alta">
            Costas acima de 80%: um dia a mais de descanso ajuda.
          </WarnPlate>
          <WarnPlate kind="deload" title="Semana de deload">
            Metade das séries, mesma carga.
          </WarnPlate>
        </section>

        <section className="stack">
          <div className="list-label">Barras segmentadas · três alturas</div>
          <SegBar value={3} max={10} size="s" label="Barra pequena: 3 de 10" read />
          <SegBar value={7} max={10} size="m" label="Barra média: 7 de 10" read />
          <SegBar value={9} max={12} segs={12} size="l" label="Barra grande: 9 de 12" read />
        </section>

        <section className="stack">
          <div className="list-label">Mira · filtro opcional (toque de novo desliga)</div>
          <div className="kit-picks kit-picks-3" role="group" aria-label="Músculo">
            {PICKS.map((p) => (
              <button
                key={p}
                type="button"
                className="kit-pick aim"
                aria-pressed={pick === p}
                onClick={() => setPick(pick === p ? null : p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="kit-ambient">
            <span className="pc-led fx-ambiente" aria-hidden="true" />
            <span className="small">Ambiente: LED respirando (pausa fora da vista)</span>
          </div>
        </section>

        <ListPanel label="Balão do núcleo · toque para ver">
          {BUBBLE_DEMO.map(([tone, text]) => (
            <ListRow key={tone} title={tone} value={text.slice(0, 24) + "…"} onClick={() => toast(text, tone)} />
          ))}
          <ListRow
            title="Com botões"
            value="Aplicar · Recusar"
            onClick={() =>
              toast("Proteger o ombro por 7 dias? Troco os exercícios que pesam nele.", "info", undefined, {
                title: "proposta",
                actions: [
                  { label: "Aplicar", onPress: () => {}, primary: true },
                  { label: "Recusar", onPress: () => {} },
                ],
              })
            }
          />
        </ListPanel>

        <ListPanel label="Tokens de movimento">
          {TOKENS.map(([k, v]) => (
            <ListRow key={k} title={k} value={v} />
          ))}
        </ListPanel>
      </div>

      <section className="stack">
        <div className="list-label">Os quatro setores lado a lado</div>
        <SectorMatrix />
      </section>
    </div>
  );
}
