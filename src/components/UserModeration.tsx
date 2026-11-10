import { useState } from "react";
import type { PublicUser, ReportReason } from "../../server/src/protocol";
import { useToast } from "../lib/hooks";
import { blockUser, reportUser } from "../lib/online/account";
import { onlineErrorText } from "../lib/online/client";
import { HoldButton } from "./HoldButton";

// Bloquear e denunciar uma pessoa (amigo ou quem mandou pedido). Fica recolhido: é raro precisar.

const REASONS: [ReportReason, string][] = [
  ["ofensivo", "Nome ofensivo"],
  ["spam", "Spam"],
  ["falso", "Marcas falsas"],
  ["outro", "Outro"],
];

export function UserModeration({ user, onDone }: { user: PublicUser; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [sent, setSent] = useState(false);
  const base = `mod-${user.id}`;

  return (
    <details className="mod">
      <summary>Bloquear ou denunciar</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Bloquear desfaz a amizade e impede {user.displayName} de te achar ou mandar pedido. A pessoa não é avisada.
        </p>
        <HoldButton
          className="btn btn-sm"
          label={`Bloquear ${user.displayName}`}
          ms={1000}
          onConfirm={async () => {
            try {
              await blockUser(user.id);
              toast(`${user.displayName} foi bloqueado.`, "ok");
              onDone();
            } catch (err) {
              toast(onlineErrorText(err), "warn");
            }
          }}
        >
          Segure para bloquear
        </HoldButton>

        <div className="divider" />
        {sent ? (
          <p className="small" role="status" style={{ margin: 0 }}>
            Denúncia enviada. Obrigado por avisar.
          </p>
        ) : (
          <>
            <span className="label" id={`${base}-why`}>
              Denunciar: qual o motivo?
            </span>
            <div className="row-wrap" role="group" aria-labelledby={`${base}-why`}>
              {REASONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="toggle-chip"
                  aria-pressed={reason === id}
                  onClick={() => setReason(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {reason && (
              <>
                <label className="label" htmlFor={`${base}-detail`}>
                  Quer contar o que houve? (opcional)
                </label>
                <textarea
                  id={`${base}-detail`}
                  className="input"
                  rows={2}
                  maxLength={500}
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm"
                  onClick={async () => {
                    try {
                      await reportUser(user.id, reason, detail.trim());
                      setSent(true);
                    } catch (err) {
                      toast(onlineErrorText(err), "warn");
                    }
                  }}
                >
                  Enviar denúncia
                </button>
              </>
            )}
          </>
        )}
      </div>
    </details>
  );
}
