import { useEffect, useMemo, useRef, useState } from "react";
import { DAY_BY_ID, EXERCISE_BY_ID, MUSCLE_LABEL, shortName } from "../data/program";
import type { MuscleId, Session } from "../data/types";
import { shortDate } from "../lib/dates";
import { useToast } from "../lib/hooks";
import { WEEK_RULES } from "../lib/mesocycle";
import { e1rm, formatWeight, toKg, workSets, type PR } from "../lib/progression";
import { sessionStats } from "../lib/sessions";
import { Icon } from "./Icon";

interface ExerciseLine {
  exId: string;
  name: string;
  setsCount: number;
  bestSet: string;
  hasPr: boolean;
}

function buildWorkoutSummary(session: Session, prs: PR[], operator?: string) {
  const day = DAY_BY_ID[session.dayId];
  const stats = sessionStats(session);
  const prExIds = new Set(prs.map((p) => p.exId));
  const muscleSets = new Map<MuscleId, number>();
  const lines: ExerciseLine[] = [];

  for (const entry of session.exercises) {
    const ex = EXERCISE_BY_ID[entry.exId];
    const ws = workSets(entry);
    if (!ex || !ws.length) continue;
    for (const m of ex.muscles) {
      muscleSets.set(m, (muscleSets.get(m) ?? 0) + ws.length);
    }
    const best = ws.reduce((a, b) => (e1rm(toKg(b.weight!, entry.unit), b.reps!) > e1rm(toKg(a.weight!, entry.unit), a.reps!) ? b : a));
    const u = entry.unit === "lb" ? "lb" : "kg";
    lines.push({
      exId: entry.exId,
      name: entry.alt ? `${shortName(ex)} (${entry.alt})` : shortName(ex),
      setsCount: ws.length,
      bestSet: `${formatWeight(best.weight)} ${u} × ${best.reps}`,
      hasPr: prExIds.has(entry.exId),
    });
  }

  const muscles = [...muscleSets.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => ({ id: m, label: MUSCLE_LABEL[m], sets: n }));

  const durationMin = Math.max(1, Math.round(stats.duration / 60000));
  const volumeStr =
    stats.volumeKg >= 1000
      ? `${(stats.volumeKg / 1000).toFixed(1).replace(".", ",")} t`
      : `${Math.round(stats.volumeKg).toLocaleString("pt-BR")} kg`;

  return {
    code: day?.code ?? "EX",
    dayName: day?.name ?? session.dayId,
    focus: day?.focus ?? "",
    dateStr: shortDate(session.date),
    weekLabel: WEEK_RULES[session.week]?.label ?? `Semana ${session.week}`,
    operator: operator?.trim() || "OPERADOR",
    sets: stats.sets,
    durationMin,
    volumeStr,
    prsCount: prs.length,
    muscles,
    lines,
  };
}

function drawClippedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tl = 18, br = 18) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  ctx.lineTo(x + w - br, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  ctx.closePath();
}

function dataUrlToFile(dataUrl: string, fileName: string, fallbackMime = "image/jpeg"): File | null {
  if (!dataUrl || !dataUrl.includes(",")) return null;
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? fallbackMime;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime, lastModified: Date.now() });
}

function triggerDownload(dataUrl: string, fileName: string) {
  const file = dataUrlToFile(dataUrl, fileName);
  const url = file ? URL.createObjectURL(file) : dataUrl;
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (file) setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function ShareWorkoutCard({
  session,
  prs,
  operator,
  onClose,
}: {
  session: Session;
  prs: PR[];
  operator?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [bgPhoto, setBgPhoto] = useState<HTMLImageElement | null>(null);
  const summary = useMemo(() => buildWorkoutSummary(session, prs, operator), [session, prs, operator]);

  const fileName = `augment-${session.dayId}-${session.date}.jpg`;

  const textSummary = useMemo(() => {
    const textLines = [
      `${summary.dayName} — AUGMENT (${summary.dateStr})`,
      `${summary.sets} séries · ${summary.durationMin} min · ${summary.volumeStr}${summary.prsCount ? ` · ${summary.prsCount} PR(s)` : ""}`,
      "",
      ...summary.lines.map((l) => `• ${l.setsCount}× ${l.name} — ${l.bestSet}${l.hasPr ? " ★ PR" : ""}`),
    ];
    return textLines.join("\n");
  }, [summary]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const maxLines = Math.min(summary.lines.length, 9);
    const H = Math.max(1350, 690 + maxLines * 74);
    canvas.width = W;
    canvas.height = H;

    if (bgPhoto) {
      // Desenha a foto do usuário preenchendo em modo "cover" (estilo Liftoff / GymRats)
      const imgRatio = bgPhoto.width / bgPhoto.height;
      const canvasRatio = W / H;
      let drawW = W;
      let drawH = H;
      let offsetX = 0;
      let offsetY = 0;
      if (imgRatio > canvasRatio) {
        drawW = H * imgRatio;
        offsetX = (W - drawW) / 2;
      } else {
        drawH = W / imgRatio;
        offsetY = (H - drawH) / 2;
      }
      ctx.drawImage(bgPhoto, offsetX, offsetY, drawW, drawH);

      // Vinheta escura semi-transparente para leitura perfeita do HUD por cima da foto
      const overlayGrad = ctx.createLinearGradient(0, 0, 0, H);
      overlayGrad.addColorStop(0, "rgba(9, 11, 15, 0.78)");
      overlayGrad.addColorStop(0.35, "rgba(9, 11, 15, 0.45)");
      overlayGrad.addColorStop(0.65, "rgba(9, 11, 15, 0.72)");
      overlayGrad.addColorStop(1, "rgba(9, 11, 15, 0.92)");
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Fundo escuro cyberpunk com grade sutil
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#0b0d11");
      bgGrad.addColorStop(0.55, "#11151c");
      bgGrad.addColorStop(1, "#090b0e");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Grade tática
      ctx.strokeStyle = "rgba(63, 216, 224, 0.045)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Brilho superior vermelho e inferior ciano
      const topGlow = ctx.createRadialGradient(W * 0.82, 140, 20, W * 0.82, 140, 520);
      topGlow.addColorStop(0, "rgba(239, 48, 44, 0.24)");
      topGlow.addColorStop(1, "rgba(239, 48, 44, 0)");
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, W, 640);

      const botGlow = ctx.createRadialGradient(W * 0.18, H - 140, 20, W * 0.18, H - 140, 520);
      botGlow.addColorStop(0, "rgba(63, 216, 224, 0.16)");
      botGlow.addColorStop(1, "rgba(63, 216, 224, 0)");
      ctx.fillStyle = botGlow;
      ctx.fillRect(0, H - 640, W, 640);
    }

    // Moldura externa HUD
    drawClippedRect(ctx, 44, 44, W - 88, H - 88, 28, 28);
    ctx.strokeStyle = bgPhoto ? "rgba(255, 255, 255, 0.24)" : "#2b313b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Barra de destaque vermelha no topo
    ctx.fillStyle = "#ef302c";
    ctx.fillRect(72, 43, 140, 5);

    // Marca AUGMENT.
    ctx.fillStyle = "#ef302c";
    drawClippedRect(ctx, 84, 88, 44, 48, 0, 10);
    ctx.fill();
    ctx.fillStyle = "#0b0d11";
    ctx.font = "900 30px Orbitron, sans-serif";
    ctx.fillText("A", 95, 123);

    ctx.fillStyle = "#f3f4f6";
    ctx.font = "900 34px Orbitron, sans-serif";
    ctx.fillText("AUGMENT", 144, 124);
    const brandW = ctx.measureText("AUGMENT").width;
    ctx.fillStyle = "#ef302c";
    ctx.fillText(".", 144 + brandW + 2, 124);

    // Código de telemetria à direita
    ctx.textAlign = "right";
    ctx.fillStyle = "#3fd8e0";
    ctx.font = "600 21px 'Share Tech Mono', monospace";
    ctx.fillText(`PROTOCOLO ${summary.code} // ${summary.dateStr.toUpperCase()}`, W - 84, 108);
    ctx.fillStyle = "#c3cad5";
    ctx.font = "400 19px 'Share Tech Mono', monospace";
    ctx.fillText(`${summary.operator.toUpperCase()} · ${summary.weekLabel.toUpperCase()}`, W - 84, 136);
    ctx.textAlign = "left";

    // Título principal do treino
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 78px Orbitron, sans-serif";
    ctx.fillText(summary.dayName.toUpperCase(), 84, 240);

    if (summary.focus) {
      ctx.fillStyle = "#ff6b60";
      ctx.font = "600 24px 'Share Tech Mono', monospace";
      ctx.fillText(`// ${summary.focus.toUpperCase()}`, 84, 280);
    }

    // 4 Blocos de métricas (Séries, Duração, Volume, PRs)
    const metrics = [
      { label: "SÉRIES", value: String(summary.sets), accent: "#ef302c" },
      { label: "DURAÇÃO", value: `${summary.durationMin} min`, accent: "#3fd8e0" },
      { label: "VOLUME", value: summary.volumeStr, accent: "#c084fc" },
      { label: "RECORDES", value: String(summary.prsCount), accent: summary.prsCount > 0 ? "#f5b83d" : "#8e96a4" },
    ];
    const tileW = (W - 168 - 36) / 4;
    const tileY = 316;
    const tileH = 132;

    metrics.forEach((m, i) => {
      const tx = 84 + i * (tileW + 12);
      drawClippedRect(ctx, tx, tileY, tileW, tileH, 14, 14);
      ctx.fillStyle = bgPhoto ? "rgba(15, 19, 26, 0.78)" : "#141820";
      ctx.fill();
      ctx.strokeStyle = bgPhoto ? "rgba(255, 255, 255, 0.2)" : "#2c333f";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#abb3bf";
      ctx.font = "400 18px 'Share Tech Mono', monospace";
      ctx.fillText(m.label, tx + 20, tileY + 38);

      ctx.fillStyle = m.accent;
      ctx.font = "900 42px Orbitron, sans-serif";
      ctx.fillText(m.value, tx + 20, tileY + 98);
    });

    // Chips de músculos trabalhados
    let chipX = 84;
    const chipY = 476;
    ctx.font = "600 19px 'Share Tech Mono', monospace";
    for (const m of summary.muscles.slice(0, 5)) {
      const text = `${m.label.toUpperCase()} · ${m.sets}S`;
      const tw = ctx.measureText(text).width + 28;
      if (chipX + tw > W - 84) break;
      drawClippedRect(ctx, chipX, chipY, tw, 40, 6, 8);
      ctx.fillStyle = bgPhoto ? "rgba(12, 16, 22, 0.78)" : "rgba(63, 216, 224, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(63, 216, 224, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#3fd8e0";
      ctx.fillText(text, chipX + 14, chipY + 26);
      chipX += tw + 10;
    }

    // Cabeçalho da lista de exercícios
    const listStartY = 556;
    ctx.fillStyle = "#b5bdc9";
    ctx.font = "600 19px 'Share Tech Mono', monospace";
    ctx.fillText("EXERCÍCIOS EXECUTADOS", 84, listStartY);
    ctx.textAlign = "right";
    ctx.fillText("MELHOR SÉRIE", W - 84, listStartY);
    ctx.textAlign = "left";

    ctx.strokeStyle = bgPhoto ? "rgba(255, 255, 255, 0.22)" : "#252b35";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(84, listStartY + 16);
    ctx.lineTo(W - 84, listStartY + 16);
    ctx.stroke();

    // Linhas de exercícios (estilo Liftoff)
    const visibleLines = summary.lines.slice(0, maxLines);
    visibleLines.forEach((line, idx) => {
      const rowY = listStartY + 34 + idx * 72;
      drawClippedRect(ctx, 84, rowY, W - 168, 60, 10, 10);
      ctx.fillStyle = bgPhoto ? "rgba(14, 18, 25, 0.8)" : idx % 2 === 0 ? "#13171f" : "#10131a";
      ctx.fill();
      ctx.strokeStyle = line.hasPr ? "rgba(245, 184, 61, 0.65)" : bgPhoto ? "rgba(255, 255, 255, 0.16)" : "#202630";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Número + badge de séries
      ctx.fillStyle = "#ef302c";
      ctx.font = "800 22px Orbitron, sans-serif";
      ctx.fillText(`${line.setsCount}×`, 104, rowY + 38);

      // Nome do exercício
      ctx.fillStyle = "#f3f4f6";
      ctx.font = "600 24px 'Exo 2', sans-serif";
      const maxNameW = W - 470;
      let name = line.name;
      while (ctx.measureText(name).width > maxNameW && name.length > 10) {
        name = name.slice(0, -2) + "…";
      }
      ctx.fillText(name, 162, rowY + 38);

      // Selo PR + Melhor série à direita
      ctx.textAlign = "right";
      ctx.fillStyle = line.hasPr ? "#f5b83d" : "#3fd8e0";
      ctx.font = "700 23px 'Share Tech Mono', monospace";
      const rightLabel = line.hasPr ? `★ PR · ${line.bestSet}` : line.bestSet;
      ctx.fillText(rightLabel, W - 104, rowY + 38);
      ctx.textAlign = "left";
    });

    // Rodapé
    ctx.fillStyle = "#8e96a4";
    ctx.font = "400 18px 'Share Tech Mono', monospace";
    ctx.fillText("AUGMENT // TELEMETRIA DE FORÇA E HIPERTROFIA", 84, H - 72);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ef302c";
    ctx.fillText("BEYOND LIMITS.", W - 84, H - 72);
    ctx.textAlign = "left";

    setDataUrl(canvas.toDataURL("image/jpeg", 0.95));
  }, [summary, bgPhoto]);

  function onSelectPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setBgPhoto(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function shareImage() {
    const file = dataUrlToFile(dataUrl, fileName);
    if (!file) {
      toast("Não foi possível gerar a imagem.");
      return;
    }
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        const canShareFiles = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;
        if (canShareFiles) {
          // Envia somente { files } sem title/text para máxima compatibilidade com apps de imagem no Android/iOS
          await navigator.share({ files: [file] });
          toast("Card de treino compartilhado.");
          return;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    triggerDownload(dataUrl, fileName);
    toast("Foto do treino salva (.jpg).");
  }

  function downloadImage() {
    if (!dataUrl) return;
    triggerDownload(dataUrl, fileName);
    toast("Foto salva na galeria/downloads (.jpg).");
  }

  async function shareToGymRats() {
    if (!dataUrl) return;
    // 1. Copia o título + resumo para o usuário colar no check-in do GymRats
    try {
      await navigator.clipboard.writeText(textSummary);
    } catch {
      // ignora se o navegador bloquear clipboard
    }
    // 2. Baixa a foto em .jpg para aparecer no topo da Galeria quando o GymRats pedir a foto
    triggerDownload(dataUrl, fileName);
    toast("Foto (.jpg) salva e resumo copiado! Abrindo GymRats…");

    // 3. Abre o app do GymRats diretamente no Android ou iOS
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua)) {
      window.setTimeout(() => {
        window.location.href =
          "intent://#Intent;package=com.gymrats.app;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.gymrats.app;end";
      }, 350);
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      window.setTimeout(() => {
        window.location.href = "gymrats://";
      }, 350);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(textSummary);
      toast("Resumo do treino copiado.");
    } catch {
      toast("Não foi possível copiar automaticamente.");
    }
  }

  return (
    <div data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 12 }}>
      <div className="spread">
        <div>
          <span className="label">Card de treino // Estilo Liftoff &amp; GymRats</span>
          <h3 className="h-sec" style={{ marginTop: 2 }}>
            Compartilhar protocolo
          </h3>
        </div>
        <button type="button" className="link-btn" onClick={onClose}>
          Fechar
        </button>
      </div>

      <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={onSelectPhoto} />

      <div className="row-wrap">
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className={`btn btn-sm grow ${!bgPhoto ? "btn-primary" : ""}`}
          onClick={() => setBgPhoto(null)}
        >
          Fundo Cyberpunk
        </button>
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className={`btn btn-sm grow ${bgPhoto ? "btn-primary" : ""}`}
          onClick={() => photoInputRef.current?.click()}
        >
          {bgPhoto ? "Trocar foto de fundo" : "Usar foto da academia + Overlay"}
        </button>
      </div>

      <canvas ref={canvasRef} hidden />

      {dataUrl && (
        <img
          src={dataUrl}
          alt={`Resumo do treino ${summary.dayName}`}
          style={{
            width: "100%",
            maxWidth: 380,
            height: "auto",
            marginInline: "auto",
            display: "block",
            border: "1px solid var(--line)",
          }}
        />
      )}

      <div className="stack" style={{ gap: 8 }}>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" onClick={shareToGymRats}>
          <Icon name="trophy" size={18} /> Postar no GymRats (baixa foto + copia resumo + abre app)
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          O app do GymRats não aparece no menu "Compartilhar" do Android/iOS porque exige criar o check-in por dentro: o botão acima já
          salva a imagem <strong>.jpg</strong> na galeria, copia as séries e abre o GymRats para você tocar em <strong>+</strong>.
        </p>
      </div>

      <div className="row-wrap">
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={downloadImage}>
          Salvar foto (.jpg)
        </button>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={shareImage}>
          <Icon name="share" size={18} /> Outros apps
        </button>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={copyText}>
          Copiar texto
        </button>
      </div>
    </div>
  );
}
