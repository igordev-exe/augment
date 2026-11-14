import { useEffect } from "react";
import { useToast, type ToastOpts, type ToastTone } from "../lib/hooks";

// O núcleo anuncia pelo balão, uma vez por dia por assunto, o que a tela já mostra (retomada, relatório, recado do
// núcleo). A tela continua com o módulo; o balão só chama a atenção para ele.

export interface Announcement {
  key: string;
  text: string;
  tone: ToastTone;
  opts?: ToastOpts;
}

const KEY = "augment-bubble-day";
/** Espera a tela de abertura sair antes de falar. */
const DELAY_MS = 4_500;

function spoken(today: string): string[] {
  try {
    const [day, list] = (localStorage.getItem(KEY) ?? "").split("|");
    return day === today && list ? list.split(",") : [];
  } catch {
    return [];
  }
}

function remember(today: string, keys: string[]) {
  try {
    localStorage.setItem(KEY, `${today}|${keys.join(",")}`);
  } catch {
    /* sem armazenamento: pode repetir */
  }
}

export function CoreAnnounce({ items, today }: { items: Announcement[]; today: string }) {
  const toast = useToast();
  const sig = items.map((i) => i.key).join(",");
  useEffect(() => {
    if (!items.length) return;
    const id = window.setTimeout(() => {
      const done = spoken(today);
      const fresh = items.filter((i) => !done.includes(i.key));
      if (!fresh.length) return;
      remember(today, [...done, ...fresh.map((i) => i.key)]);
      for (const i of fresh) toast(i.text, i.tone, undefined, i.opts);
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, [sig, today]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
