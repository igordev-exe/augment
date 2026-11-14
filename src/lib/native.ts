import { Capacitor } from "@capacitor/core";
import { CHANNEL_INFO, type Notice } from "./core/notices";

// Ponte entre o app web e o APK (Capacitor). No navegador tudo segue com as APIs web de sempre; no Android, os
// plugins nativos fazem o que o navegador não faz bem: alarme do descanso com a tela bloqueada, vibração, tela acesa,
// compartilhar arquivos e guardar a chave da Anthropic no armazenamento seguro.
// Os plugins só são carregados no Android (import dinâmico), então a PWA não baixa código nativo.

export const isNative = Capacitor.isNativePlatform();

// ---------- Vibração ----------

/** Padrão no formato do navigator.vibrate: [vibra, pausa, vibra, ...] em ms. */
export function vibrate(pattern: number | number[]): void {
  if (!isNative) {
    navigator.vibrate?.(pattern);
    return;
  }
  const steps = Array.isArray(pattern) ? pattern : [pattern];
  import("@capacitor/haptics")
    .then(({ Haptics }) => {
      let at = 0;
      steps.forEach((ms, i) => {
        if (i % 2 === 0) window.setTimeout(() => Haptics.vibrate({ duration: ms }).catch(() => {}), at);
        at += ms;
      });
    })
    .catch(() => {});
}

// ---------- Tela acesa ----------

export async function keepAwake(on: boolean): Promise<void> {
  const { KeepAwake } = await import("@capacitor-community/keep-awake");
  if (on) await KeepAwake.keepAwake();
  else await KeepAwake.allowSleep();
}

// ---------- Alarme do descanso (notificação agendada pelo Android) ----------

const TIMER_NOTIFICATION = 7001;
const TIMER_CHANNEL = "descanso";

let channelReady: Promise<void> | null = null;
let askedPermission = false;
async function notifications() {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  channelReady ??= LocalNotifications.createChannel({
    id: TIMER_CHANNEL,
    name: "Descanso entre séries",
    description: "Avisa quando o descanso acaba, mesmo com a tela bloqueada.",
    importance: 5,
    vibration: true,
    visibility: 1,
  }).catch(() => {});
  await channelReady;
  return LocalNotifications;
}

/** Pede permissão de notificação. Devolve se ficou liberada. */
export async function requestNotifyPermission(): Promise<boolean> {
  if (!isNative) {
    if (typeof Notification === "undefined") return false;
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    return perm === "granted";
  }
  const ln = await notifications();
  const cur = await ln.checkPermissions();
  if (cur.display === "granted") return true;
  return (await ln.requestPermissions()).display === "granted";
}

/** Agenda (ou reagenda) o aviso de fim do descanso. No navegador não faz nada: lá o aviso sai do próprio timer. */
export async function scheduleRestAlarm(endAt: number, label: string): Promise<void> {
  if (!isNative) return;
  try {
    const ln = await notifications();
    await ln.cancel({ notifications: [{ id: TIMER_NOTIFICATION }] });
    if (endAt <= Date.now() + 500) return;
    // Android 13+: a permissão é pedida no primeiro descanso, uma vez por abertura do app.
    if ((await ln.checkPermissions()).display !== "granted") {
      if (askedPermission) return;
      askedPermission = true;
      if ((await ln.requestPermissions()).display !== "granted") return;
    }
    await ln.schedule({
      notifications: [
        {
          id: TIMER_NOTIFICATION,
          title: "Descanso acabou",
          body: label.replace(/\n/g, " · "),
          channelId: TIMER_CHANNEL,
          schedule: { at: new Date(endAt), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    /* sem permissão: o timer na tela continua funcionando */
  }
}

export async function cancelRestAlarm(): Promise<void> {
  if (!isNative) return;
  try {
    const ln = await notifications();
    await ln.cancel({ notifications: [{ id: TIMER_NOTIFICATION }] });
  } catch {
    /* nada agendado */
  }
}

// ---------- Avisos fora do app (notificações locais agendadas, sem servidor) ----------

const NOTICE_RANGE = [7100, 7199] as const;
const NOTICE_ACTIONS = "aviso";
const SKIP_KEY = "augment-notice-skip";
/** "Hoje não": o canal daquele dia não volta a ser agendado. */
function skipped(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SKIP_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(-30) : [];
  } catch {
    return [];
  }
}
function skip(key: string) {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...skipped(), key].slice(-30)));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

let noticeSetup: Promise<void> | null = null;
let webTimers: number[] = [];

async function setupNotices() {
  const ln = await notifications();
  noticeSetup ??= (async () => {
    for (const [id, c] of Object.entries(CHANNEL_INFO)) {
      await ln
        .createChannel({ id: `aviso-${id}`, name: c.name, description: c.description, importance: 3, vibration: true, visibility: 1 })
        .catch(() => {});
    }
    await ln
      .registerActionTypes({
        types: [
          {
            id: NOTICE_ACTIONS,
            actions: [
              { id: "abrir", title: "Abrir", foreground: true },
              { id: "hoje-nao", title: "Hoje não", destructive: true },
            ],
          },
        ],
      })
      .catch(() => {});
    // Tocar no aviso (ou em "Abrir") leva à rota dele; "Hoje não" não agenda mais aquele canal naquele dia.
    await ln.addListener("localNotificationActionPerformed", (e) => {
      const extra = (e.notification.extra ?? {}) as { route?: string; key?: string };
      if (e.actionId === "hoje-nao") {
        if (extra.key) skip(extra.key);
        return;
      }
      if (extra.route) location.hash = `#${extra.route}`;
    });
  })().catch(() => {});
  await noticeSetup;
  return ln;
}

/** Se a pessoa já liberou as notificações (sem perguntar). */
export async function notifyGranted(): Promise<boolean> {
  try {
    if (!isNative) return typeof Notification !== "undefined" && Notification.permission === "granted";
    return (await (await notifications()).checkPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/**
 * Troca os avisos agendados pelos novos (ids 7100–7199). Não pede permissão: sem ela, não faz nada.
 * No navegador, só enquanto a aba existe (service worker mostra o aviso); sem Web Push.
 */
export async function syncNotices(list: Notice[], avatar?: string): Promise<void> {
  const skip = new Set(skipped());
  const todo = list.filter((n) => !skip.has(`${n.channel}|${n.date}`));
  if (!isNative) {
    webTimers.forEach((t) => window.clearTimeout(t));
    webTimers = [];
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    for (const n of todo) {
      const ms = n.at - Date.now();
      if (ms <= 0 || ms > 2 ** 31 - 1) continue;
      webTimers.push(
        window.setTimeout(() => {
          const opts = { body: n.text, tag: `aviso-${n.channel}`, data: { route: n.route } };
          if (reg) void reg.showNotification(`AUG.CORE · ${n.title}`, opts).catch(() => {});
          else new Notification(`AUG.CORE · ${n.title}`, opts);
        }, ms),
      );
    }
    return;
  }
  try {
    const ln = await setupNotices();
    const pending = await ln.getPending();
    const mine = pending.notifications.filter((p) => p.id >= NOTICE_RANGE[0] && p.id <= NOTICE_RANGE[1]);
    if (mine.length) await ln.cancel({ notifications: mine.map((p) => ({ id: p.id })) });
    if ((await ln.checkPermissions()).display !== "granted" || !todo.length) return;
    await ln.schedule({
      notifications: todo.map((n) => ({
        id: n.id,
        title: `AUG.CORE · ${n.title}`,
        body: n.text,
        largeBody: n.text,
        channelId: `aviso-${n.channel}`,
        actionTypeId: NOTICE_ACTIONS,
        smallIcon: "ic_stat_augment",
        iconColor: "#ef302c",
        ...(avatar ? { largeIcon: avatar } : {}),
        extra: { route: n.route, key: `${n.channel}|${n.date}` },
        schedule: { at: new Date(n.at), allowWhileIdle: true },
      })),
    });
  } catch {
    /* lembrete, não regra: o app funciona sem ele */
  }
}

// ---------- Compartilhar arquivos ----------

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Grava o arquivo no cache do app e abre a folha de compartilhar do Android (salvar no Drive, mandar no WhatsApp…). */
export async function shareFileNative(name: string, data: Blob | string, title = name): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const written =
    typeof data === "string"
      ? await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 })
      : await Filesystem.writeFile({ path: name, data: toBase64(new Uint8Array(await data.arrayBuffer())), directory: Directory.Cache });
  await Share.share({ title, files: [written.uri], dialogTitle: title });
}

// ---------- Chave da Anthropic ----------

const KEY_NAME = "anthropic-api-key";

/** No Android a chave fica no armazenamento seguro (Keystore), fora do IndexedDB. */
export async function readSecretKey(name = KEY_NAME): Promise<string> {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return (await SecureStorage.getItem(name)) ?? "";
}

export async function writeSecretKey(value: string, name = KEY_NAME): Promise<void> {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  if (value) await SecureStorage.setItem(name, value);
  else await SecureStorage.removeItem(name);
}

// ---------- Botão voltar do Android ----------

/** Voltar do Android navega para trás no app; na tela inicial, fecha. */
export function setupBackButton(): void {
  if (!isNative) return;
  import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("backButton", () => {
        const atHome = location.hash === "" || location.hash === "#/" || location.hash === "#";
        if (atHome) App.exitApp();
        else history.back();
      }),
    )
    .catch(() => {});
}
