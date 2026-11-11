// Aparência do operador: cada persona é um par herói (banner do Hoje, boas-vindas) + avatar (topo, Ajustes).
// Os arquivos ficam em public/. Para adicionar uma persona: gere os dois arquivos no mesmo enquadramento dos
// atuais (herói 720×720 com fundo transparente, avatar quadrado com recorte circular), inclua aqui e rode o
// tagcheck com TAG_PERSONA=<id> (a folga entre a etiqueta do banner e o herói é medida em pixels).

export interface Persona {
  id: string;
  name: string;
  /** Uma linha, para quem está escolhendo. */
  hint: string;
  hero: string;
  avatar: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "humano",
    name: "Humano aumentado",
    hint: "Implante neural, lente e circuitos sob a pele",
    hero: "hero-humano.webp",
    avatar: "avatar-humano.png",
  },
  { id: "robo", name: "Exo-piloto", hint: "Capacete integral de combate", hero: "hero-robo.webp", avatar: "avatar-robo.png" },
];

export const DEFAULT_PERSONA = PERSONAS[0].id;

export function personaOf(id: string | undefined): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

const base = () => import.meta.env.BASE_URL;

export const heroSrc = (id: string | undefined) => `${base()}${personaOf(id).hero}`;
export const avatarSrc = (id: string | undefined) => `${base()}${personaOf(id).avatar}`;
