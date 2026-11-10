// Formato das mensagens entre o app e o servidor. O app importa este arquivo também (um só contrato).

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
}

/** "" = não informado. */
export type Sex = "" | "m" | "f";

export interface Me extends PublicUser {
  sharePercentiles: boolean;
  shareActivity: boolean;
  createdAt: number;
  /** Opcionais, só para a comparação por faixa. Ninguém mais vê. */
  sex: Sex;
  bodyweightKg: number | null;
}

export interface AuthResponse {
  token: string;
  user: Me;
  /** Só no cadastro e na recuperação: mostrar uma vez e pedir para guardar. */
  recoveryCode?: string;
}

/** Melhor marca da pessoa num exercício da biblioteca, em kg. */
export interface RecordIn {
  lib: string;
  e1rmKg: number;
  loadKg: number;
  reps: number;
  date: string;
}

export interface Percentile {
  lib: string;
  e1rmKg: number;
  loadKg: number;
  /** % dos outros usuários abaixo de você (empate conta metade). null = poucos dados para comparar. */
  pctE1rm: number | null;
  pctLoad: number | null;
  /** Quantos outros usuários têm marca nesse exercício. */
  others: number;
  /** Só para quem informou sexo e/ou peso: a mesma comparação (carga), dentro da própria faixa. */
  group?: { pct: number | null; others: number; sex: Sex; weight: boolean };
  /** Só para quem informou o peso: 1RM estimada ÷ peso corporal, comparada com quem também informou. */
  rel?: { ratio: number; pct: number | null; others: number };
}

export interface RankRow {
  user: PublicUser;
  e1rmKg: number;
  loadKg: number;
  reps: number;
  date: string;
  me: boolean;
}

/** Resumo de um treino concluído. */
export interface ActivityIn {
  id: string;
  date: string;
  title: string;
  sets: number;
  volumeKg: number;
  minutes: number;
  prs: number;
}

export interface FeedItem extends ActivityIn {
  user: PublicUser;
}

export interface Friend extends PublicUser {
  since: number;
}

export interface FriendsResponse {
  friends: Friend[];
  incoming: PublicUser[];
  outgoing: PublicUser[];
}

export interface BackupMeta {
  id: string;
  createdAt: number;
  size: number;
  sessions: number;
  hash: string;
}

/** Um treino na sincronização entre aparelhos. `data` é o JSON da sessão; vazio quando `deleted`. */
export interface WorkoutChange {
  id: string;
  hash: string;
  data: string;
  deleted?: boolean;
}

export interface WorkoutPull {
  changes: WorkoutChange[];
  /** Até onde este lote foi: mande de volta como `since` no próximo pedido. */
  rev: number;
  more: boolean;
}

export const LIMITS = {
  workoutsPerRequest: 100,
  workoutMaxBytes: 300_000,
  /** Mínimo de outros usuários para mostrar a porcentagem (menos que isso, a comparação não diz nada). */
  minOthers: 5,
  /** Backups guardados por pessoa (os mais antigos saem). */
  backupsKept: 5,
  /** Tamanho máximo de um backup (texto JSON). Fotos grandes ficam de fora antes de enviar. */
  backupMaxBytes: 20_000_000,
  backupChunkBytes: 1_500_000,
  recordsPerRequest: 600,
  activityPerRequest: 200,
  /** Marcas acima disso são descartadas (erro de digitação, não recorde). */
  maxKg: 600,
} as const;

export const REPORT_REASONS = ["ofensivo", "spam", "falso", "outro"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
