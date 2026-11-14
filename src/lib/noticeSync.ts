import { useEffect, useRef, useState } from "react";
import type { Session, Settings } from "../data/types";
import { plannedNotices } from "./core/notices";
import { operatorState } from "./core/operator";
import { loadBodyLog } from "./db";
import { todayISO } from "./dates";
import { useOperatorMemory, useToast } from "./hooks";
import { isNative, notifyGranted, requestNotifyPermission, syncNotices } from "./native";

// Liga a voz do núcleo às notificações locais: reagenda os avisos dos próximos 7 dias ao abrir o app, ao fechar um
// treino (as sessões mudam) e ao mexer em Ajustes. A permissão é pedida pelo balão uma vez, depois do primeiro treino.

const ASKED_KEY = "augment-notice-asked";
const DEBOUNCE_MS = 1_500;

function asked(): boolean {
  try {
    return !!localStorage.getItem(ASKED_KEY);
  } catch {
    return true;
  }
}
function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, todayISO());
  } catch {
    /* sem armazenamento */
  }
}

export function useNoticeSync(sessions: Session[] | undefined, settings: Settings, loaded: boolean, pathname: string) {
  const [memory] = useOperatorMemory();
  const toast = useToast();
  const run = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!sessions || !loaded) return;
    const ticket = ++run.current;
    const id = window.setTimeout(async () => {
      if (!(await notifyGranted())) return;
      const today = todayISO();
      const state = operatorState(sessions, await loadBodyLog(), settings, memory, today);
      if (ticket !== run.current) return;
      await syncNotices(plannedNotices(sessions, settings, memory, state, today, Date.now()), `avatar_${settings.persona ?? "humano"}`);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [sessions, settings, memory, loaded, nonce]);

  // Primeiro treino terminado, no Hoje: o balão explica o que vai chegar e pede a permissão (uma vez só).
  const doneCount = sessions?.filter((s) => s.status === "done").length ?? 0;
  useEffect(() => {
    if (pathname !== "/" || doneCount < 1 || asked()) return;
    if (!isNative && typeof Notification === "undefined") return;
    let cancel = false;
    // Espera a tela de abertura sair.
    const wait = window.setTimeout(
      () =>
        void notifyGranted().then((ok) => {
          if (cancel || ok) return;
          markAsked();
          toast("Posso te avisar fora do app: dia de treino, músculo pronto e o resumo da semana. Nada de propaganda.", "info", undefined, {
            title: "Avisos",
            sticky: true,
            actions: [
              {
                label: "Ativar",
                primary: true,
                onPress: () => {
                  void requestNotifyPermission().then((granted) => {
                    if (granted) setNonce((n) => n + 1);
                    toast(
                      granted
                        ? "Avisos ligados. Ajuste os canais em Ajustes → Avisos."
                        : "Sem permissão: os avisos ficam só dentro do app.",
                      granted ? "ok" : "info",
                    );
                  });
                },
              },
              { label: "Agora não", onPress: () => {} },
            ],
          });
        }),
      5_000,
    );
    return () => {
      cancel = true;
      window.clearTimeout(wait);
    };
  }, [pathname, doneCount, toast]);
}
