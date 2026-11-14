import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BootScreen } from "./components/Brand";
import { Icon } from "./components/Icon";
import { TimerBar } from "./components/TimerBar";
import { markBootDone, readBootMode, type BootMode } from "./lib/brand";
import { todayISO } from "./lib/dates";
import { loadActiveProgram } from "./lib/db";
import { setToastVibrate, ToastProvider, useProgram, useSessions, useSettings, useToday } from "./lib/hooks";
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
import { avatarSrc } from "./data/personas";
import { useOnline } from "./lib/online/sync";

// O treinador carrega o SDK da Anthropic: só baixa quando a tela abre.
const Coach = lazy(() => import("./screens/Coach").then((m) => ({ default: m.Coach })));
// Vitrine das peças de jogo (#/kit): só no desenvolvimento. Em produção o Vite troca DEV por false e o chunk some.
const Kit = import.meta.env.DEV ? lazy(() => import("./screens/Kit").then((m) => ({ default: m.Kit }))) : null;

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const { state, configure } = useTimer();
  // Re-renderiza o app inteiro quando o programa ativo muda.
  useProgram();
  const [settings, , settingsLoaded] = useSettings();
  const sessions = useSessions();
  const today = useToday();
  const online = useOnline();
  /** Pedidos de amizade esperando: LED violeta no avatar da aba Perfil. */
  const pending = online?.social?.friends.incoming.length ?? 0;
  const inProfile = /^\/(perfil|online|amigos|privacidade)/.test(pathname);
  // Semana de deload: paleta mais calma no app inteiro (o vermelho de ação vira um azul-aço).
  const deload = weekFor(settings.mesoStart, today) === 7;
  useEffect(() => {
    document.documentElement.classList.toggle("mode-deload", deload);
  }, [deload]);
  useEffect(() => {
    const off = installTapFx();
    bootBeam();
    return off;
  }, []);
  useEffect(() => applyFxLevel(settings.fx, pathname.startsWith("/treino/")), [settings.fx, pathname]);
  // Setor da rota (Operação, Telemetria, Rede, Treinador): troca o --sector das peças de jogo.
  useEffect(() => applySector(sectorFor(pathname)), [pathname]);
  useEffect(() => setToastVibrate(settings.vibrate), [settings.vibrate]);
  useEffect(
    () => configure({ sound: settings.sound, vibrate: settings.vibrate, notify: settings.notify }),
    [settings.sound, settings.vibrate, settings.notify, configure],
  );

  // Instalação nova (sem treinos e sem ter passado pelo assistente): primeiro uso no lugar das telas.
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

  return (
    <>
      <ScrollTop />
      <main className={`app${state ? " has-timer" : ""}`}>
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
              <img src={avatarSrc(settings.persona)} alt="" width={26} height={26} />
              {pending > 0 && <i className="nav-led" />}
            </span>
            <span className="nav-label">Perfil</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
}

export default function App() {
  // O programa vem do banco: as telas só montam depois que ele carrega (é rápido, IndexedDB local).
  const [ready, setReady] = useState(false);
  // Boot do sistema por cima de tudo enquanto o app carrega por baixo: completo na 1ª abertura do dia, curto nas outras.
  const [boot, setBoot] = useState<BootMode>(() => readBootMode(todayISO()));
  useEffect(() => {
    loadActiveProgram()
      .catch(() => {
        /* banco indisponível: segue com o modelo PPL que o registro já tem */
      })
      .finally(() => setReady(true));
  }, []);
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
