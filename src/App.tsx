import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { BootScreen } from "./components/Brand";
import { Icon } from "./components/Icon";
import { TimerBar } from "./components/TimerBar";
import { markBootDone, readBootMode, type BootMode } from "./lib/brand";
import { todayISO } from "./lib/dates";
import { loadActiveProgram } from "./lib/db";
import { setToastVibrate, ToastProvider, useProgram, useSettings, useToday } from "./lib/hooks";
import { applyFxLevel, bootBeam, installTapFx } from "./lib/fx";
import { weekFor } from "./lib/mesocycle";
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

// O treinador carrega o SDK da Anthropic: só baixa quando a tela abre.
const Coach = lazy(() => import("./screens/Coach").then((m) => ({ default: m.Coach })));

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
  const [settings] = useSettings();
  const today = useToday();
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
  useEffect(() => setToastVibrate(settings.vibrate), [settings.vibrate]);
  useEffect(
    () => configure({ sound: settings.sound, vibrate: settings.vibrate, notify: settings.notify }),
    [settings.sound, settings.vibrate, settings.notify, configure],
  );

  return (
    <>
      <ScrollTop />
      <main className={`app${state ? " has-timer" : ""}`}>
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
          <Route
            path="/treinador"
            element={
              <Suspense fallback={null}>
                <Coach />
              </Suspense>
            }
          />
          <Route path="*" element={<Today />} />
        </Routes>
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
          <NavLink to="/exercicios">
            <Icon name="book" />
            <span className="nav-label">Exercícios</span>
          </NavLink>
          <NavLink to="/guia">
            <Icon name="guide" />
            <span className="nav-label">Guia</span>
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
