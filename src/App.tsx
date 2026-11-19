import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BootScreen } from "./components/Brand";
import { Icon } from "./components/Icon";
import { TimerBar } from "./components/TimerBar";
import { markBootDone, readBootMode, type BootMode } from "./lib/brand";
import { todayISO } from "./lib/dates";
import { bodyLogCell, loadActiveProgram, memoryCell, sessionsCell, settingsCell, startLocalData } from "./lib/db";
import { warmDerived } from "./lib/derived";
import { EMPTY_OPERATOR_MEMORY } from "./lib/core/operator";
import { listRestorePoints, restorePointsCell } from "./lib/restore";
import { useNoticeSync } from "./lib/noticeSync";
import { enterRoute, markRouteSeen } from "./lib/seen";
import { setBubblePersona, setToastVibrate, ToastProvider, useProgram, useSessions, useSettings, useToday } from "./lib/hooks";
import { Onboarding } from "./screens/Onboarding";
import { PrivacyPolicy } from "./screens/PrivacyPolicy";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyFxLevel, bootBeam, installTapFx } from "./lib/fx";
import { weekFor } from "./lib/mesocycle";
import { applySector, sectorFor } from "./lib/sector";
import { TimerProvider, useTimer } from "./lib/timer";
import { ExerciseDetail } from "./screens/ExerciseDetail";
import { Exercises } from "./screens/Exercises";
import { Guide } from "./screens/Guide";
import { History } from "./screens/History";
import { Progress } from "./screens/Progress";
import { Report } from "./screens/Report";
import { SessionScreen } from "./screens/SessionScreen";
import { ProgramEditor } from "./screens/ProgramEditor";
import { Programs } from "./screens/Programs";
import { SettingsScreen } from "./screens/SettingsScreen";
import { Today } from "./screens/Today";
import { Online } from "./screens/Online";
import { Friends } from "./screens/Friends";
import { avatarSrc, PERSONAS } from "./data/personas";
import { decodePersona } from "./lib/images";
import { listCloudBackups, onlineCell, rememberNet, useOnline, watchOnline } from "./lib/online/sync";
import { refreshSocial } from "./lib/online/account";
import { apiUrl } from "./lib/online/client";

// O treinador carrega o SDK da Anthropic: só baixa quando a tela abre.
const Coach = lazy(() => import("./screens/Coach").then((m) => ({ default: m.Coach })));
// Vitrine das peças de jogo (#/kit): só no desenvolvimento. Em produção o Vite troca DEV por false e o chunk some.
const Kit = import.meta.env.DEV ? lazy(() => import("./screens/Kit").then((m) => ({ default: m.Kit }))) : null;

/**
 * Carrega todas as fontes empacotadas (11 faces, no aparelho). Sem isso cada peso só baixa quando uma tela o usa
 * pela 1ª vez, e o texto troca de fonte na frente da pessoa (font-display: swap).
 */
function loadFonts(): Promise<unknown> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts) return Promise.resolve();
  const all: Promise<unknown>[] = [];
  fonts.forEach((f) => all.push(f.status === "unloaded" ? f.load() : f.loaded));
  return Promise.allSettled(all);
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
/** Roda em tempo ocioso (ou num timeout curto onde não há requestIdleCallback, como no Safari). */
function whenIdle(fn: () => void, timeout: number): () => void {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, Math.min(timeout, 200));
  return () => window.clearTimeout(id);
}

/**
 * Pré-montagem das abas (Fase 2b de docs/prompt-fluidez.md): depois do Hoje pintar, em tempo ocioso e ainda sob o
 * boot quando couber, monta uma vez cada uma das outras 4 abas fora da tela (invisível, sem animação) e desmonta. Aquece o
 * código, o estilo e o cache de contas (lib/derived.ts): a 1ª visita custa o mesmo que a 2ª. Uma por vez, para não
 * criar uma tarefa longa só.
 */
const ProfileTab = () => <Online asTab />;
function Prewarm() {
  // O Perfil só sem conta: com conta ele busca os backups da nuvem ao abrir, e a pré-montagem não pode ir à rede.
  const [screens] = useState(() =>
    apiUrl() && onlineCell.get()?.user ? [Progress, History, Exercises] : [Progress, History, Exercises, ProfileTab],
  );
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (step >= screens.length) return;
    return whenIdle(() => setStep((i) => i + 1), step < 0 ? 600 : 300);
  }, [step, screens.length]);
  if (step < 0 || step >= screens.length) return null;
  const Screen = screens[step];
  return (
    <div className="prewarm" aria-hidden="true">
      <ErrorBoundary resetKey={`prewarm-${step}`}>
        <Screen />
      </ErrorBoundary>
    </div>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const { state, configure } = useTimer();
  // Re-renderiza o app inteiro quando o programa ativo muda.
  useProgram();
  // O Shell não assina os treinos: gravar uma série não pode re-renderizar a rota inteira e a barra de abas (F2/F8).
  // Quem precisa deles (avisos fora do app, assistente de primeiro uso) mora em componentes próprios abaixo.
  const [settings] = useSettings();
  const today = useToday();
  // Tela já vista nesta abertura: sem cascata de entrada (F7). Marcada como vista depois de pintar.
  // Decide uma vez por troca de rota (não a cada re-render do Shell, senão um ajuste salvo faria a tela "voltar").
  const entry = useRef({ path: "", seen: false });
  if (entry.current.path !== pathname) entry.current = { path: pathname, seen: enterRoute(pathname) };
  const seenRoute = entry.current.seen;
  useEffect(() => markRouteSeen(pathname), [pathname]);
  // Semana de deload: paleta mais calma no app inteiro (o vermelho de ação vira um azul-aço).
  const deload = weekFor(settings.mesoStart, today) === 7;
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("mode-deload", deload);
  }, [deload]);
  useEffect(() => {
    const off = installTapFx();
    bootBeam();
    return off;
  }, []);
  useLayoutEffect(() => applyFxLevel(settings.fx, pathname.startsWith("/treino/")), [settings.fx, pathname]);
  // Setor da rota (Operação, Telemetria, Rede, Treinador): troca o --sector das peças de jogo.
  useLayoutEffect(() => applySector(sectorFor(pathname)), [pathname]);
  useLayoutEffect(() => setToastVibrate(settings.vibrate), [settings.vibrate]);
  useLayoutEffect(() => setBubblePersona(settings.persona), [settings.persona]);
  useEffect(
    () => configure({ sound: settings.sound, vibrate: settings.vibrate, notify: settings.notify }),
    [settings.sound, settings.vibrate, settings.notify, configure],
  );

  return (
    <FirstUseGate pathname={pathname}>
      <ScrollTop />
      <NoticeSync pathname={pathname} />
      <main className={`app${state ? " has-timer" : ""}${seenRoute ? " rota-vista" : ""}`}>
        <ErrorBoundary resetKey={pathname}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/treino/:id" element={<SessionScreen />} />
            <Route path="/historico" element={<History />} />
            <Route path="/progresso" element={<Progress />} />
            <Route path="/relatorio" element={<Report />} />
            <Route path="/relatorio/:week" element={<Report />} />
            <Route path="/exercicios" element={<Exercises />} />
            <Route path="/exercicios/:libId" element={<ExerciseDetail />} />
            <Route path="/guia" element={<Guide />} />
            <Route path="/ajustes" element={<SettingsScreen />} />
            <Route path="/programas" element={<Programs />} />
            <Route path="/programas/:id" element={<ProgramEditor />} />
            <Route path="/online" element={<Online />} />
            <Route path="/perfil" element={<Online asTab />} />
            <Route path="/primeiro-uso" element={<Onboarding inApp />} />
            <Route path="/privacidade" element={<PrivacyPolicy />} />
            <Route path="/amigos" element={<Friends />} />
            <Route
              path="/treinador"
              element={
                <Suspense fallback={null}>
                  <Coach />
                </Suspense>
              }
            />
            {Kit && (
              <Route
                path="/kit"
                element={
                  <Suspense fallback={null}>
                    <Kit />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<Today />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <TimerBar />
      <NavBar pathname={pathname} />
      <Prewarm />
    </FirstUseGate>
  );
}

/** Avisos fora do app: reagenda a cada mudança de treino ou ajuste; o balão pede a permissão depois do 1º treino. */
function NoticeSync({ pathname }: { pathname: string }) {
  const [settings, , settingsLoaded] = useSettings();
  const sessions = useSessions();
  useNoticeSync(sessions, settings, settingsLoaded, pathname);
  return null;
}

/** Instalação nova (sem treinos e sem ter passado pelo assistente): primeiro uso no lugar das telas. */
function FirstUseGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [settings, , settingsLoaded] = useSettings();
  const sessions = useSessions();
  if (
    settingsLoaded &&
    sessions &&
    sessions.length === 0 &&
    !settings.onboarded &&
    !/^\/(online|perfil|ajustes|privacidade|kit)/.test(pathname)
  ) {
    return (
      <ErrorBoundary resetKey="primeiro-uso">
        <Onboarding />
      </ErrorBoundary>
    );
  }
  return <>{children}</>;
}

/** Barra de abas: re-renderiza só com a rota, a persona e os pedidos de amizade (não com cada treino gravado). */
const NavBar = memo(function NavBar({ pathname }: { pathname: string }) {
  const [settings] = useSettings();
  const online = useOnline();
  /** Pedidos de amizade esperando: LED violeta no avatar da aba Perfil. */
  const pending = online?.social?.friends.incoming.length ?? 0;
  const inProfile = /^\/(perfil|online|amigos|privacidade)/.test(pathname);
  return (
    <nav className="nav" aria-label="Seções">
      <div className="nav-inner">
        <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith("/treino") ? "active" : "")}>
          <Icon name="barbell" />
          <span className="nav-label">Treino</span>
        </NavLink>
        <NavLink to="/historico">
          <Icon name="calendar" />
          <span className="nav-label">Histórico</span>
        </NavLink>
        <NavLink to="/progresso">
          <Icon name="chart" />
          <span className="nav-label">Progresso</span>
        </NavLink>
        {/* O Guia mora junto de Exercícios (botão holográfico na biblioteca): a aba acende nos dois. */}
        <NavLink to="/exercicios" className={({ isActive }) => (isActive || pathname.startsWith("/guia") ? "active" : "")}>
          <Icon name="book" />
          <span className="nav-label">Exercícios</span>
        </NavLink>
        {/* Perfil na ponta direita, como nos apps de treino: o avatar da persona, com LED quando há pedido de amizade. */}
        <NavLink
          to="/perfil"
          className={inProfile ? "active nav-me" : "nav-me"}
          aria-label={pending ? `Perfil, ${pending} pedido${pending > 1 ? "s" : ""} de amizade` : undefined}
        >
          <span className="nav-avatar" aria-hidden="true">
            <img src={avatarSrc(settings.persona)} alt="" width={26} height={26} decoding="sync" />
            {pending > 0 && <i className="nav-led" />}
          </span>
          <span className="nav-label">Perfil</span>
        </NavLink>
      </div>
    </nav>
  );
});

export default function App() {
  // Hidrata todo o estado local em paralelo antes de montar as telas para o Frame 0 já sair completo e sem flash.
  const [ready, setReady] = useState(false);
  // Boot do sistema por cima de tudo enquanto o app carrega por baixo: completo na 1ª abertura do dia, curto nas outras.
  const [boot, setBoot] = useState<BootMode>(() => readBootMode(todayISO()));
  useEffect(() => {
    let alive = true;
    (async () => {
      // O programa ativo primeiro (garante ajustes e o modelo PPL numa instalação nova); depois, uma assinatura
      // por dado (lib/store.ts), todas em paralelo.
      await loadActiveProgram().catch(() => undefined);
      await Promise.all([startLocalData(), watchOnline(), restorePointsCell.watch(listRestorePoints)]).catch(() => undefined);
      const settings = settingsCell.get();
      // Avatar da barra e herói da persona ativa decodificados e as fontes carregadas antes de montar as telas, com
      // teto curto (o boot cobre a espera; nunca segura o app fechado). As outras personas seguem em segundo plano,
      // para a troca em Ajustes não piscar.
      const media = decodePersona(settings?.persona, 600);
      PERSONAS.filter((p) => p.id !== (settings?.persona ?? PERSONAS[0].id)).forEach((p) => void decodePersona(p.id));
      await Promise.race([Promise.all([media, loadFonts()]), new Promise<void>((r) => window.setTimeout(r, 600))]);
    })().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Depois que o Hoje monta: as contas das abas (lib/derived.ts), o pedaço do treinador e o histórico dele, em tempo
  // ocioso, para tocar numa aba achar tudo pronto.
  useEffect(() => {
    if (!ready) return;
    return whenIdle(() => {
      const sessions = sessionsCell.get();
      const settings = settingsCell.get();
      if (sessions && settings)
        warmDerived(sessions, bodyLogCell.get() ?? [], settings, memoryCell.get() ?? EMPTY_OPERATOR_MEMORY, todayISO());
      void import("./screens/Coach");
      void import("./lib/coach/chat").then((m) => Promise.allSettled([m.loadCoachConfig(), m.loadCoachChat(), m.loadCoachArchive()]));
      // Com conta: amigos, feed e backups da nuvem guardados antes da 1ª visita (F4). A tela mostra na hora e atualiza.
      if (apiUrl() && onlineCell.get()?.user) {
        refreshSocial().catch(() => {});
        listCloudBackups()
          .then((list) => rememberNet("backups", list))
          .catch(() => {});
      }
    }, 1200);
  }, [ready]);
  return (
    <>
      {ready && (
        <HashRouter>
          <ToastProvider>
            <TimerProvider>
              <Shell />
            </TimerProvider>
          </ToastProvider>
        </HashRouter>
      )}
      {boot !== "none" && (
        <BootScreen
          mode={boot}
          onDone={() => {
            markBootDone(todayISO());
            setBoot("none");
          }}
        />
      )}
    </>
  );
}
