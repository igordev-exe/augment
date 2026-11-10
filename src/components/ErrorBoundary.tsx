import { Component, type ErrorInfo, type ReactNode } from "react";
import { todayISO } from "../lib/dates";
import { exportBackup } from "../lib/db";
import { describeError, reportError } from "../lib/errors";
import { shareOrDownload } from "../lib/files";

// Se uma tela quebrar, em vez de tela branca: aviso claro, os dados continuam salvos, e três saídas simples.
// `resetKey` (a rota) muda → tenta desenhar de novo, então trocar de aba já recupera.

interface Props {
  resetKey: string;
  children: ReactNode;
}
interface State {
  error: unknown;
  key: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    void reportError(error, (info.componentStack ?? "").trim().split("\n")[0]?.trim().slice(0, 60) || "tela");
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const { message } = describeError(this.state.error);
    return (
      <div className="stack-lg crash" role="alert">
        <div className="eyebrow">AUG.OS // FALHA DE MÓDULO</div>
        <h1 className="h-page">Algo deu errado nesta tela</h1>
        <p>
          <strong>Seus treinos continuam salvos neste aparelho.</strong> Foi só esta tela que não abriu.
        </p>
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn btn-primary"
          onClick={() => this.setState({ error: null })}
        >
          Tentar de novo
        </button>
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn"
          onClick={() => {
            location.hash = "#/";
            this.setState({ error: null });
          }}
        >
          Voltar ao início
        </button>
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn"
          onClick={async () => {
            const today = todayISO();
            const b = await exportBackup();
            await shareOrDownload(`augment-backup-${today}.json`, JSON.stringify(b, null, 2), `AUGMENT Backup (${today})`);
          }}
        >
          Exportar backup por segurança
        </button>
        <details className="small muted">
          <summary>Detalhe técnico</summary>
          <p className="mono" style={{ overflowWrap: "anywhere" }}>
            {message}
          </p>
        </details>
      </div>
    );
  }
}
