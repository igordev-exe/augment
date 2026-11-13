import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";

// Peças de jogo (docs/plano-refino-visual.md, seção 3A). Cada uma tem UM papel; o estilo fica em styles/15-pecas.css.
//
//   BandPanel   painel com faixa cheia    o bloco principal da tela (1 ou 2 por tela)
//   ListPanel   painel simples com linhas listas (é a lista "Módulos do protocolo" do Hoje: .list + .list-item)
//   Slot        slot com cantoneiras      coisa a preencher ou moldura de imagem (vazio: hachura e "+")
//   Hex         hexágono entalhado        coisa que se conquista ou evolui (posto, atributo, conquista, sigla)
//   NumBlock    bloco de número cheio     contagem ou código curto (semana, dia, total, posição)
//   WarnPlate   placa de aviso            perigo, deload, alerta
//   SegBar      barra segmentada          progresso com trilho, enchimento e ponta clara
//
// A cor vem do setor (`--sector`), nunca de uma cor fixa. Microtexto só com dado verdadeiro (R9).

/** Painel com faixa cheia: título curto em texto escuro sobre a cor do setor e microtexto real na ponta. */
export function BandPanel({
  title,
  micro,
  children,
  className,
}: {
  title: ReactNode;
  /** Dado real e curto (semana, data, contagem). Nada de código falso. */
  micro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`band-panel${className ? ` ${className}` : ""}`}>
      <div className="band-box" data-augmented-ui="br-clip border">
        <header className="band">
          <span className="band-mark" aria-hidden="true" />
          <h2 className="band-title">{title}</h2>
          {micro != null && <span className="band-micro">{micro}</span>}
        </header>
        <div className="band-body">{children}</div>
      </div>
    </section>
  );
}

/** Painel simples com linhas: UM contêiner, filete de 1 px entre as linhas, rótulo mono acima. */
export function ListPanel({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className="list-panel">
      {label != null && <div className="list-label">{label}</div>}
      <ul className="list" data-augmented-ui="tl-clip br-clip border">
        {children}
      </ul>
    </div>
  );
}

/** Linha do ListPanel: título em Exo 2, valor atual embaixo em mono apagado, seta à direita quando leva a algum lugar. */
export function ListRow({
  title,
  value,
  num,
  to,
  onClick,
  end,
}: {
  title: ReactNode;
  value?: ReactNode;
  /** Número de ordem: só em lista ordenada de verdade (R9). */
  num?: string;
  to?: string;
  onClick?: () => void;
  end?: ReactNode;
}) {
  const inner = (
    <>
      {num && <span className="idx">{num}</span>}
      <span className="li-text">
        <span className="li-title">{title}</span>
        {value != null && <span className="li-value">{value}</span>}
      </span>
      {end ??
        ((to || onClick) && (
          <span className="chev" aria-hidden="true">
            <Icon name="chev" size={16} />
          </span>
        ))}
    </>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className="list-item">
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" className="list-item" onClick={onClick}>
          {inner}
        </button>
      ) : (
        <div className="list-item">{inner}</div>
      )}
    </li>
  );
}

/** Slot com cantoneiras em L. Vazio: hachura e "+". Com conteúdo: moldura (foto, avatar). */
export function Slot({
  label,
  children,
  onClick,
  className,
}: {
  /** Nome do slot: aparece embaixo e vai para o leitor de tela. */
  label: string;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const empty = children == null;
  const cls = `slot${empty ? " is-empty" : ""}${className ? ` ${className}` : ""}`;
  const face = (
    <>
      <span className="slot-face">{empty ? <span className="slot-plus" aria-hidden="true" /> : children}</span>
      <span className="slot-label">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={empty ? `${label}: vazio, adicionar` : label}>
      {face}
    </button>
  ) : (
    <div className={cls} role="group" aria-label={empty ? `${label}: vazio` : label}>
      {face}
    </div>
  );
}

export type HexState = "off" | "on" | "sel";
const HEX_STATE_TEXT: Record<HexState, string> = { off: "travado", on: "conquistado", sel: "conquistado, selecionado" };

/**
 * Hexágono entalhado. "off" = travado (hachura, apagado), "on" = aceso na cor do setor, "sel" = aceso + mira ciano.
 * O estado não depende só da cor: travado tem hachura e o texto do estado vai para o leitor de tela.
 */
export function Hex({ state, label, value, onClick }: { state: HexState; label: string; value?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="hex-face" aria-hidden="true">
        <span className="hex-in">{value ?? (state === "off" ? "—" : <Icon name="check" size={16} />)}</span>
      </span>
      <span className="hex-label">{label}</span>
      <span className="sr-only">, {HEX_STATE_TEXT[state]}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="hex aim" data-state={state} aria-pressed={state === "sel"} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="hex" data-state={state}>
      {body}
    </div>
  );
}

/** Bloco de número cheio ("-03"): contagem ou código curto. "line" é a versão de contorno, para o vizinho apagado. */
export function NumBlock({ value, label, variant = "fill" }: { value: ReactNode; label?: string; variant?: "fill" | "line" }) {
  return (
    <span className="num-block" data-variant={variant}>
      <b>{value}</b>
      {label && <span className="num-label">{label}</span>}
    </span>
  );
}

/** Placa de aviso: listras diagonais e triângulo. Perigo é sempre vermelho; deload é azul-aço; alerta é âmbar. */
export function WarnPlate({
  kind = "danger",
  title,
  children,
}: {
  kind?: "danger" | "alert" | "deload";
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="warn-plate" data-kind={kind} role={kind === "danger" ? "alert" : "status"}>
      <span className="wp-stripes" aria-hidden="true" />
      <span className="wp-tri" aria-hidden="true">
        <b>!</b>
      </span>
      <div className="wp-text">
        <div className="wp-title">{title}</div>
        {children && <div className="wp-body">{children}</div>}
      </div>
    </div>
  );
}

/** Moldura assimétrica (HUD Pack) para a barra grande: barra em cima, rótulo e valor embaixo. */
export function Gauge({ label, value, children }: { label: ReactNode; value: ReactNode; children: ReactNode }) {
  return (
    <div className="gauge" data-augmented-ui="tr-clip bl-clip border">
      {children}
      <div className="gauge-row">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value">{value}</span>
      </div>
    </div>
  );
}

/** Marca quando o elemento aparece na tela pela primeira vez (para a família "leitura" não rodar fora da vista). */
function useSeenOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

/**
 * Barra segmentada (HUD Pack): trilho, enchimento em segmentos e ponta mais clara no último aceso.
 * O valor é arredondado para o segmento mais próximo; o número exato vai no rótulo e no leitor de tela.
 * `read` liga a família "leitura": enche segmento por segmento na primeira vez que aparece.
 */
export function SegBar({
  value,
  max,
  segs = 10,
  size = "m",
  label,
  read = false,
}: {
  value: number;
  max: number;
  segs?: number;
  size?: "s" | "m" | "l";
  label: string;
  read?: boolean;
}) {
  const [ref, seen] = useSeenOnce<HTMLDivElement>();
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const on = Math.round(ratio * segs);
  const style = { "--segs": segs, "--on": on } as CSSProperties;
  const cls = `seg-bar${read ? " fx-leitura" : ""}${read && seen ? " is-seen" : ""}`;
  return (
    <div
      ref={ref}
      className={cls}
      data-size={size}
      style={style}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      {on > 0 && (
        <div className="seg-fill">
          <div className="seg-pat" />
        </div>
      )}
    </div>
  );
}

// ---------- Lista agrupada (M1): um painel, linhas com filete, uma seta só (R1, R2, R6, R10) ----------

/** Painel de linhas com rótulo mono acima. Dentro: FoldRow, LinkRow e SwitchRow, sem borda própria. */
export function GroupPanel({ label, children, className }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`group-panel${className ? ` ${className}` : ""}`}>
      {label != null && <h2 className="list-label group-label">{label}</h2>}
      <div className="group-box" data-augmented-ui="tl-clip br-clip border">
        {children}
      </div>
    </section>
  );
}

function RowText({ title, value }: { title: ReactNode; value?: ReactNode }) {
  return (
    <span className="row-text">
      <span className="row-title">{title}</span>
      {value != null && value !== "" && <span className="row-value">{value}</span>}
    </span>
  );
}

/** Linha que abre para mexer. O resumo sempre mostra o valor atual. Nunca coloque um FoldRow dentro de outro. */
export function FoldRow({
  title,
  value,
  icon,
  children,
  open,
  id,
}: {
  title: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  open?: boolean;
  id?: string;
}) {
  return (
    <details className="fold-row" open={open} id={id}>
      <summary>
        {icon && <span className="row-icon">{icon}</span>}
        <RowText title={title} value={value} />
        <span className="fold-chev" aria-hidden="true" />
      </summary>
      <div className="fold-body stack">{children}</div>
    </details>
  );
}

/** Linha que leva a outra tela: mesma linha, seta para a direita. */
export function LinkRow({ to, title, value, icon }: { to: string; title: ReactNode; value?: ReactNode; icon?: ReactNode }) {
  return (
    <Link to={to} className="link-row">
      {icon && <span className="row-icon">{icon}</span>}
      <RowText title={title} value={value} />
      <span className="fold-chev is-link" aria-hidden="true" />
    </Link>
  );
}

/** Interruptor (liga/desliga). Ligado = ciano, nunca vermelho (R4, R6). A linha inteira é o alvo de toque. */
export function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <RowText title={label} value={hint} />
      <span className="switch" aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  );
}
