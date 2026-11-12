import { Link } from "react-router-dom";
import { apiUrl } from "../lib/online/client";
import { useOnline } from "../lib/online/sync";
import { shortDate } from "../lib/dates";

/**
 * Texto do status no topo da tela inicial. O celular é a fonte da verdade, então o padrão é sempre "Local / ativo"
 * (com ou sem conta). Só muda quando a cópia na nuvem ficou para trás, para a pessoa saber.
 */
export function useOnlineStatus(): { text: string; tone: "ok" | "warn" } {
  const online = useOnline();
  if (online?.user && apiUrl() && online.lastError) return { text: "Local / nuvem pendente", tone: "warn" };
  return { text: "Local / ativo", tone: "ok" };
}

/** Na tela inicial: atalho para os amigos (com pedidos e o último treino deles) ou convite discreto para a conta. */
export function OnlineStrip({ hasHistory }: { hasHistory: boolean }) {
  const online = useOnline();
  if (!apiUrl() || online === undefined) return null;

  if (!online.user) {
    if (!hasHistory) return null;
    return (
      <Link to="/online" className="tap small faint" style={{ alignSelf: "flex-start" }}>
        Backup na nuvem e treino com amigos: criar conta (opcional) &gt;
      </Link>
    );
  }

  const incoming = online.social?.friends.incoming.length ?? 0;
  const last = online.social?.feed[0];
  return (
    <Link to="/amigos" data-augmented-ui="tl-clip br-clip border" className="card stack pg-entry" style={{ gap: 4 }}>
      <span className="label">Amigos</span>
      <span className="spread">
        <strong>
          {incoming
            ? `${incoming} pedido${incoming > 1 ? "s" : ""} de amizade`
            : last
              ? `${last.user.displayName}: ${last.title}`
              : "Ver amigos e treinos"}
        </strong>
        <span className="arrow">&gt;</span>
      </span>
      <span className="tiny faint">
        {last && !incoming ? `${shortDate(last.date)} · ${last.sets} séries` : "Recordes, ranking e treinos da turma"}
      </span>
    </Link>
  );
}
