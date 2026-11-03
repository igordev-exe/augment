import { lazy, Suspense, useEffect } from "react";
import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Icon } from "./components/Icon";
import { TimerBar } from "./components/TimerBar";
import { ToastProvider, useSettings } from "./lib/hooks";
import { TimerProvider, useTimer } from "./lib/timer";
import { ExerciseDetail } from "./screens/ExerciseDetail";
import { Exercises } from "./screens/Exercises";
import { Guide } from "./screens/Guide";
import { History } from "./screens/History";
import { Progress } from "./screens/Progress";
import { Report } from "./screens/Report";
import { SessionScreen } from "./screens/SessionScreen";
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
  const [settings] = useSettings();
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
            Treino
          </NavLink>
          <NavLink to="/historico">
            <Icon name="calendar" />
            Histórico
          </NavLink>
          <NavLink to="/progresso">
            <Icon name="chart" />
            Progresso
          </NavLink>
          <NavLink to="/exercicios">
            <Icon name="book" />
            Exercícios
          </NavLink>
          <NavLink to="/guia">
            <Icon name="guide" />
            Guia
          </NavLink>
        </div>
      </nav>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <TimerProvider>
          <Shell />
        </TimerProvider>
      </ToastProvider>
    </HashRouter>
  );
}
