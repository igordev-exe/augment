import { Capacitor } from "@capacitor/core";

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
