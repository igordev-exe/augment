import { useDelayedFlag } from "../lib/delayedFlag";

/**
 * Lugar de um painel que espera o servidor e ainda não tem valor guardado (regras F3 e F4 de docs/prompt-fluidez.md).
 * A linha já nasce com a altura dela, então a resposta não empurra nada. O texto só aparece se a espera passar de
 * 200 ms (e fica pelo menos 300 ms): resposta rápida não pisca "buscando".
 */
export function NetWait({ text }: { text: string }) {
  const show = useDelayedFlag(true);
  return (
    <p className="small faint net-wait-line" role="status" aria-live="polite">
      {show ? text : " "}
    </p>
  );
}
