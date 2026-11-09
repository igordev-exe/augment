// Mede o aumento de letra do sistema (Android "Tamanho da fonte", zoom de texto do navegador) e expõe em --text-zoom.
// O CSS usa isso só onde o crescimento quebraria o layout (nomes das abas da barra de baixo).

export function measureTextZoom(): number {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;line-height:1";
  probe.textContent = "M";
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize) || 100;
  probe.remove();
  return Math.max(1, Math.min(3, px / 100));
}

export function applyTextZoom(): void {
  const k = measureTextZoom();
  document.documentElement.style.setProperty("--text-zoom", k > 1.02 ? k.toFixed(3) : "1");
}
