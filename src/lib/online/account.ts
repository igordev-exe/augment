// Conta online: cadastro, login, recuperação, perfil e saída. Os dados de treino nunca saem do aparelho ao sair
// da conta: só o vínculo com o servidor é desfeito.
import type {
  AuthResponse,
  FeedItem,
  FriendsResponse,
  Me,
  PublicUser,
  RankRow,
  RecordIn,
  ReportReason,
} from "../../../server/src/protocol";
import { db } from "../db";
import { api, saveToken } from "./client";
import { saveOnline, syncNow } from "./sync";
import { resetWorkoutSync } from "./workouts";

async function signedIn(r: AuthResponse): Promise<AuthResponse> {
  await saveToken(r.token);
  // Conta nova (ou outra conta neste aparelho): tudo sobe de novo.
  await db.kv.put({ key: "online", value: { user: r.user } });
  await resetWorkoutSync();
  void syncNow("manual");
  return r;
}

export async function register(input: {
  username: string;
  password: string;
  displayName: string;
  sharePercentiles: boolean;
  shareActivity: boolean;
}): Promise<AuthResponse> {
  return signedIn(await api<AuthResponse>("POST", "/auth/register", input));
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  return signedIn(await api<AuthResponse>("POST", "/auth/login", { username, password }));
}

export async function recover(username: string, recoveryCode: string, newPassword: string): Promise<AuthResponse> {
  return signedIn(await api<AuthResponse>("POST", "/auth/recover", { username, recoveryCode, newPassword }));
}

export async function logout(): Promise<void> {
  await api("POST", "/auth/logout").catch(() => {});
  await saveToken("");
  await db.kv.put({ key: "online", value: { user: null } });
  await resetWorkoutSync();
}

export async function updateProfile(
  patch: Partial<Pick<Me, "displayName" | "sharePercentiles" | "shareActivity" | "sex" | "bodyweightKg">>,
): Promise<Me> {
  const { user } = await api<{ user: Me }>("PATCH", "/me", patch);
  // Mudou sexo ou peso: a comparação por faixa precisa ser refeita.
  const redo = "sex" in patch || "bodyweightKg" in patch;
  await saveOnline(redo ? { user, percentilesAt: undefined } : { user });
  if (redo) void syncNow("manual");
  return user;
}

/** Código de recuperação novo (o antigo deixa de valer). Pede a senha. */
export async function newRecoveryCode(password: string): Promise<string> {
  const r = await api<{ recoveryCode: string }>("POST", "/me/recovery-code", { password });
  await saveOnline({ recoveryAck: false });
  return r.recoveryCode;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api("POST", "/me/password", { currentPassword, newPassword });
}

export async function deleteAccount(password: string): Promise<void> {
  await api("POST", "/me/delete", { password });
  await saveToken("");
  await db.kv.put({ key: "online", value: { user: null } });
  await resetWorkoutSync();
}

// ---------- amigos ----------

export const getFriends = () => api<FriendsResponse>("GET", "/friends");
export const searchUsers = async (q: string) =>
  (await api<{ users: PublicUser[] }>("GET", `/users/search?q=${encodeURIComponent(q)}`)).users;
export const requestFriend = (username: string) =>
  api<{ status: "pending" | "accepted"; user: PublicUser }>("POST", "/friends/request", { username });
export const acceptFriend = (userId: string) => api("POST", "/friends/accept", { userId });
export const removeFriend = (userId: string) => api("POST", "/friends/remove", { userId });
export const getBlocked = async () => (await api<{ blocked: PublicUser[] }>("GET", "/blocks")).blocked;
export const blockUser = (userId: string) => api("POST", "/users/block", { userId });
export const unblockUser = (userId: string) => api("POST", "/users/unblock", { userId });
export const reportUser = (userId: string, reason: ReportReason, detail: string) => api("POST", "/reports", { userId, reason, detail });
export const getFeed = async () => (await api<{ feed: FeedItem[] }>("GET", "/feed")).feed;
export const friendsRanking = async (lib: string) =>
  (await api<{ ranking: RankRow[] }>("GET", `/records/friends?lib=${encodeURIComponent(lib)}`)).ranking;
export const userRecords = async (userId: string) =>
  (await api<{ records: RecordIn[] }>("GET", `/users/${encodeURIComponent(userId)}/records`)).records;
