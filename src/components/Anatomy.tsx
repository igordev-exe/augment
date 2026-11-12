import { useId, type CSSProperties, type ReactNode } from "react";
import type { MuscleId } from "../data/types";
import { fatigueColor, type FatigueLevel } from "../lib/visual";

// Corpo anatômico do mapa de fadiga (design do Figma "Visualizador de Fadiga Cyberpunk").
// Cada forma é da metade esquerda e é espelhada. As formas ficam agrupadas por região anatômica
// e OWNERS diz qual músculo da ficha é dono de cada parte em cada vista (null = neutro, ex.: antebraço).

export type View = "front" | "back";

export interface AnatomyZone {
  id: MuscleId;
  name: string;
  fatigue: number;
  level: FatigueLevel;
}

type Group =
  | "shoulders"
  | "chest"
  | "core"
  | "quads"
  | "calves"
  | "traps"
  | "lats"
  | "triceps"
  | "glutes"
  | "biceps"
  | "forearms"
  | "hamstrings";

// Each shape describes the left half; mirroring keeps bilateral hit areas exact.
const shapes: Partial<Record<Group, string[]>> = {
  shoulders: [
    // Clavicular, acromial and posterior portions converge on the humerus.
    "M155 119C143 118 131 121 125 127C126 140 124 155 118 173C128 162 136 145 150 136L161 128Z",
    "M123 128C110 135 106 149 108 163C109 177 114 187 118 192C120 176 127 159 125 143Z",
    "M108 148C102 160 103 179 109 190L116 195L112 177Z",
  ],
  chest: [
    // Broad sternal origin, narrowing laterally into the anterior axillary fold.
    "M205 129C188 126 171 128 157 134L129 155C137 163 142 173 151 183C166 196 188 198 203 190C207 181 206 153 205 129Z",
  ],
  core: [
    // Rectus abdominis follows the costal margin, with tendinous intersections.
    "M203 198C193 194 183 197 180 205L180 220C187 225 198 225 205 220L205 203Z",
    "M204 228C195 224 185 225 181 231L182 247C190 251 198 251 205 246L205 233Z",
    "M204 255C196 252 187 253 184 259L186 277C192 281 200 281 205 276L205 260Z",
    "M204 284C197 282 190 283 188 289C188 307 193 322 205 334L205 293Z",
    // External oblique: a continuous flank rather than disconnected armor tiles.
    "M165 225C157 239 155 254 159 272C165 292 177 308 188 319C184 298 182 278 182 259L178 241Z",
  ],
  quads: [
    // Vastus lateralis, rectus femoris and the distal vastus medialis "teardrop".
    "M163 350C150 364 144 390 147 419C149 446 155 467 165 483C167 468 166 452 168 434C171 408 176 377 171 357Z",
    "M175 345C166 366 167 393 170 419C173 443 174 466 179 480C186 466 188 445 189 423C191 395 189 365 182 349Z",
    "M194 418C187 434 182 452 182 468C181 479 185 487 191 488C198 485 202 476 201 466C201 446 197 431 194 418Z",
  ],
  calves: [
    // Only the lateral calf/soleus silhouette is exposed in the anterior view.
    "M161 522C151 536 150 556 156 576C161 591 164 602 168 610L167 575C166 555 170 538 168 526Z",
    "M194 538C197 555 194 574 188 592L184 610C184 587 189 563 190 546Z",
  ],
  traps: [
    // Upper fibers run out to the acromion; lower fibers descend along the spine.
    "M196 96C189 106 172 112 153 119L136 130C155 131 177 137 192 145L206 151L206 105Z",
    "M206 154C190 146 175 140 161 139C169 151 180 165 187 183C193 202 197 223 206 238Z",
  ],
  lats: [
    // Latissimus sweeps from the thoracolumbar fascia to the humerus, below scapula.
    "M138 193C145 217 156 239 168 258C178 276 190 287 203 298L204 246C183 231 170 214 159 194L146 181Z",
  ],
  triceps: [
    "M122 179C110 187 103 204 102 222C102 237 106 246 112 250C118 239 126 218 129 200Z",
    "M131 188C136 205 135 225 129 240L118 255L113 252C121 236 127 214 131 188Z",
    "M107 244L117 253L125 244L119 260L109 263L103 256Z",
  ],
  glutes: [
    "M167 318C153 325 148 341 148 355L161 345L179 334L190 329Z",
    "M192 330C174 331 156 344 150 360C145 373 149 386 158 391C171 397 194 392 204 382L206 345L202 332Z",
  ],
  biceps: [
    // Biceps brachii long/short heads, with brachialis beside the distal tendon.
    "M122 178C111 180 101 191 99 206C97 222 101 238 109 248C121 243 130 228 133 209C135 195 130 183 122 178Z",
    "M134 190C140 204 138 225 130 240L116 250C126 233 132 211 134 190Z",
  ],
  forearms: [
    // A rounded proximal belly tapers along the elbow–wrist axis, without side fins.
    "M107 249C99 256 96 269 97 283C98 296 100 307 102 316L109 317C112 303 117 289 120 275C121 263 115 253 107 249Z",
    "M120 254C126 263 125 278 120 292L113 318L109 319C112 301 115 282 117 266Z",
  ],
  hamstrings: [
    // Biceps femoris stays lateral; semitendinosus/semimembranosus stay medial.
    "M156 397C148 413 148 438 153 458C157 474 163 486 166 495L172 481C169 461 173 429 178 399Z",
    "M183 399C176 415 173 439 174 458C175 473 179 486 183 496C185 480 188 463 192 446C195 425 195 409 191 399Z",
    "M198 397C197 419 194 442 190 462L188 488C196 477 201 462 202 441L204 405Z",
  ],
};

const posteriorShoulders = [
  "M145 122C129 117 114 128 108 142C103 156 105 173 111 184C117 171 124 154 136 145L152 135Z",
  "M150 137C134 145 122 161 117 180L124 185C137 173 148 155 153 143Z",
];
// Na vista posterior a panturrilha aparece inteira: as duas cabeças do gastrocnêmio e o sóleo.
const posteriorCalves = [
  "M164 521C153 531 151 548 156 564C159 576 165 584 173 589C176 576 179 557 177 540L174 523Z",
  "M184 523C177 540 178 563 181 580C183 589 186 594 190 595C198 585 201 566 199 551C197 537 191 528 184 523Z",
  "M156 570C158 593 166 610 175 627L175 603L170 591Z",
];
const posteriorShapes: Partial<Record<Group, string[]>> = {
  ...shapes,
  shoulders: posteriorShoulders,
  calves: posteriorCalves,
};

// Músculo da ficha dono de cada região em cada vista. Na frente o deltoide se divide em
// anterior (porção clavicular) e lateral (acromial); atrás, na calota lateral (acromial) e
// na porção escapular (posterior). null fica neutro.
const OWNERS: Record<View, Partial<Record<Group, MuscleId | null | MuscleId[]>>> = {
  front: {
    chest: "peito",
    shoulders: ["deltAnterior", "deltLateral", "deltLateral"],
    biceps: "biceps",
    forearms: "antebraco",
    core: "abdomen",
    quads: "quadriceps",
    calves: "panturrilha",
  },
  back: {
    traps: "trapezio",
    shoulders: ["deltLateral", "deltPosterior"],
    lats: "costas",
    triceps: "triceps",
    forearms: "antebraco",
    glutes: "gluteo",
    hamstrings: "posterior",
    calves: "panturrilha",
  },
};

function ownerOf(view: View, group: Group, part: number): MuscleId | null {
  const o = OWNERS[view][group];
  return Array.isArray(o) ? o[part] : (o ?? null);
}

// Include the upper cap beside the clavicle, not just the narrow colored bellies.
const SHOULDER_HIT_AREA = "M155 116C133 109 111 119 104 137C97 150 99 175 108 188L117 196C120 176 126 158 139 146L160 131Z";

// Foreshortened anterior foot: narrow ankle, flared forefoot, longer medial edge.
const FOOT_FRONT =
  "M166 630C165 640 164 647 161 654C158 660 156 665 156 669C156 673 160 675 166 676C174 678 184 679 189 679C193 679 195 676 194 671C193 664 191 657 189 650C188 644 187 637 186 630C180 635 172 635 166 630Z";
// Posterior foot: heel and Achilles with the forefoot flaring out behind it.
const FOOT_BACK =
  "M166 631C164 642 163 653 163 661C160 665 159 670 161 673C166 676 185 676 190 673C192 670 191 665 188 661C188 653 186 645 185 633C178 636 172 635 166 631Z";

// Keep the relaxed hands aligned with the narrower forearm and wrist.
const HAND_OFFSET = 12;

// Relaxed cyber-hand: separate digits, a forward thumb and tapered finger lengths.
const finger = (x: number, width: number, top: number, tip: number) => {
  const r = width / 2;
  return `M${x} ${top}C${x - 0.35} ${top + 8} ${x - 0.2} ${tip - r - 3} ${x} ${tip - r}A${r} ${r} 0 0 0 ${x + width} ${tip - r}C${x + width + 0.2} ${tip - r - 3} ${x + width + 0.35} ${top + 8} ${x + width} ${top}Z`;
};
const fingers = [
  {
    d: finger(81.4, 4.9, 347, 369),
    joints: [356, 363],
    transform: "rotate(5 84 347)",
  },
  {
    d: finger(86.8, 5.3, 349, 376),
    joints: [359, 368],
    transform: "rotate(2 89 349)",
  },
  { d: finger(92.6, 5.6, 349, 379), joints: [360, 370], transform: undefined },
  {
    d: finger(98.7, 5.3, 348, 375),
    joints: [358, 367],
    transform: "rotate(-3 101 348)",
  },
];
const HAND = {
  thumb: {
    d: finger(104.2, 5.2, 331, 358),
    joints: [341, 350],
    transform: "rotate(-21 106.8 331)",
  },
  palm: "M86 318C83 326 81 336 81 350C86 353 100 354 106 351C108 343 108 331 107 318Z",
};

const anteriorNeutral = [
  // Serratus anterior and the long adductor/sartorius boundaries.
  "M143 184C149 194 161 199 174 199L172 210C159 209 150 201 143 191Z",
  "M146 199C151 210 160 217 173 220L175 211C162 209 153 205 146 199Z",
  "M150 216C155 226 163 232 175 236L176 225C164 225 157 221 150 216Z",
  "M152 232C156 244 165 251 176 255L176 243C165 242 158 237 152 232Z",
  "M197 349C192 367 190 391 194 413L202 441L207 379L207 352Z",
  "M159 341C172 362 181 392 190 418L197 445L200 442C189 398 175 361 164 340Z",
  // Tibialis anterior runs along the shin, not as a posterior calf belly.
  "M180 524C171 541 171 564 175 587L175 628L180 635C181 609 188 578 190 552L189 530Z",
  "M169 532C165 550 166 575 169 593L171 624L174 629L171 574L173 536Z",
];
const posteriorNeutral = [
  // Scapular infraspinatus/teres occupy the space between trapezius and deltoid.
  "M159 144C147 144 136 150 132 162C143 173 158 180 178 180C173 166 165 153 159 144Z",
  "M135 171C141 183 153 191 170 194L176 185C159 184 146 179 135 171Z",
  "M189 260C181 278 179 298 183 316L203 326L204 299Z",
  "M190 594C185 608 181 622 180 642L175 643C174 621 175 605 179 590Z",
  "M196 567C197 590 190 615 183 630L186 608Z",
];

const armor = [
  "M157 114L185 106L188 116L172 128L145 135Z",
  "M165 286L181 309L204 331L203 347L187 350L170 333L159 320Z",
  "M159 488C169 480 187 482 196 492L193 511L181 524L165 515L158 501Z",
  "M100 299L108 304L117 300L115 315L108 324L99 317Z",
  "M165 609C168 613 171 619 172 627L172 638C169 641 166 641 163 638L162 631Z",
];

const SILHOUETTE =
  "M189 92C184 105 168 112 149 114C128 113 111 123 104 142C97 163 99 180 98 191C92 210 94 233 101 248C94 266 94 284 97 301L98 317L104 324L117 321L118 313C121 295 128 275 127 258L138 211C147 230 153 250 159 269C165 283 166 294 161 308C159 322 154 333 150 340C139 368 139 405 145 438L153 480L156 504C149 526 147 551 153 576L162 615L162 640C169 646 181 647 189 640L190 636C197 595 204 556 199 528L201 503L207 445L210 376V103Z";

// Translucent skeletal reference, inspired by computed-tomography overlays.
const skeleton = [
  "M206 104C190 107 170 108 150 116",
  "M121 140C114 175 110 205 108 240",
  "M109 248L103 316M117 251L112 318",
  "M102 322L96 350M107 322L102 351M112 322L108 351M116 322L114 350M117 331L123 350",
  "M206 318C190 314 168 318 160 332C156 348 170 360 188 362C196 362 202 352 206 344",
  "M178 362C176 400 178 440 182 488",
  "M181 516L178 628M171 520L167 620",
  ...Array.from(
    { length: 8 },
    (_, i) => `M206 ${126 + i * 13}C${190 - i} ${124 + i * 13} ${165 - i * 1.2} ${132 + i * 13} ${158 + i * 1.5} ${150 + i * 13}`,
  ),
];

const nerves = [
  "M200 110C180 140 150 150 130 170C118 200 112 240 108 300L104 330",
  "M200 330C190 380 186 430 184 490C182 540 176 590 172 640",
];
const vessels = [
  "M180 122C150 136 130 162 122 202C116 242 119 282 110 322",
  "M196 340C182 380 176 440 178 500C178 560 186 600 182 650",
  "M204 120C196 160 186 205 190 250C194 290 200 315 202 330",
];

// Mira e rótulo do músculo selecionado (x, y, lado do rótulo).
const CALLOUTS: Record<View, Partial<Record<MuscleId, [number, number, "left" | "right"]>>> = {
  front: {
    peito: [246, 173, "right"],
    deltAnterior: [140, 138, "left"],
    deltLateral: [113, 162, "left"],
    biceps: [115, 214, "left"],
    antebraco: [108, 281, "left"],
    abdomen: [224, 266, "right"],
    quadriceps: [176, 414, "left"],
    panturrilha: [260, 560, "right"],
  },
  back: {
    trapezio: [226, 169, "right"],
    deltLateral: [116, 152, "left"],
    deltPosterior: [135, 162, "left"],
    costas: [166, 244, "left"],
    triceps: [310, 215, "right"],
    antebraco: [310, 281, "right"],
    gluteo: [178, 365, "left"],
    posterior: [239, 440, "right"],
    panturrilha: [244, 556, "right"],
  },
};

// Brilho especular de cada região (lado esquerdo).
const SPECULAR: Record<Group, [number, number]> = {
  shoulders: [116, 154],
  chest: [174, 173],
  core: [196, 266],
  quads: [176, 414],
  calves: [176, 560],
  traps: [194, 169],
  lats: [166, 244],
  triceps: [110, 215],
  biceps: [115, 214],
  forearms: [108, 281],
  glutes: [178, 365],
  hamstrings: [181, 440],
};

// Fibers follow each belly's origin-to-insertion direction, not a shared texture.
const fiberDirections: Record<Group, Array<(t: number) => string>> = {
  shoulders: [
    (t) => `M${132 + 25 * t} ${119 + 7 * t}Q${137 + 10 * t} 144 118 178`,
    (t) => `M${108 + 16 * t} 133Q${113 + 17 * t} 154 117 190`,
    (t) => `M${104 + 5 * t} 151Q${102 + 10 * t} 174 115 193`,
  ],
  chest: [(t) => `M205 ${130 + 61 * t}Q${174 - 20 * t} ${124 + 77 * t} 130 156`],
  core: [
    (t) => `M${180 + 25 * t} 197Q${178 + 28 * t} 210 ${183 + 20 * t} 225`,
    (t) => `M${182 + 23 * t} 226Q${179 + 28 * t} 238 ${185 + 19 * t} 252`,
    (t) => `M${184 + 21 * t} 253Q${183 + 25 * t} 267 ${189 + 15 * t} 281`,
    (t) => `M${188 + 17 * t} 283Q${190 + 14 * t} 313 204 333`,
    (t) => `M${157 + 19 * t} ${225 + 35 * t}Q${161 + 19 * t} ${265 + 34 * t} ${187 + t} 319`,
  ],
  quads: [
    (t) => `M${152 + 21 * t} 351Q${137 + 32 * t} 413 165 483`,
    (t) => `M${171 + 15 * t} 346Q${161 + 35 * t} 409 179 480`,
    (t) => `M194 418Q${175 + 27 * t} 464 ${189 + 4 * t} 488`,
  ],
  calves: [(t) => `M${155 + 16 * t} 523Q${142 + 29 * t} 559 167 608`, (t) => `M${190 + 6 * t} 538Q${197 - 5 * t} 574 184 609`],
  traps: [
    (t) => `M205 ${100 + 49 * t}Q${182 - 12 * t} ${113 + 12 * t} 137 130`,
    (t) => `M${162 + 40 * t} ${141 + 11 * t}Q${185 + 15 * t} 180 206 238`,
  ],
  biceps: [(t) => `M${109 + 19 * t} 180Q${89 + 46 * t} 211 ${109 + 6 * t} 248`, (t) => `M${133 + 3 * t} 190Q${135 - 9 * t} 222 117 249`],
  forearms: [
    (t) => `M${102 + 14 * t} 250Q${91 + 30 * t} 278 ${102 + 7 * t} 317`,
    (t) => `M${119 + 5 * t} 254Q${116 + 7 * t} 282 ${109 + 4 * t} 319`,
  ],
  lats: [(t) => `M203 ${247 + 52 * t}Q${152 + 16 * t} ${222 + 45 * t} 141 190`],
  triceps: [
    (t) => `M${112 + 16 * t} 179Q${93 + 33 * t} 217 112 250`,
    (t) => `M132 189Q${142 - 12 * t} 227 116 254`,
    (t) => `M${105 + 20 * t} 244Q114 256 112 261`,
  ],
  glutes: [
    (t) => `M${154 + 29 * t} 323Q${144 + 22 * t} 341 155 354`,
    (t) => `M204 ${334 + 45 * t}Q${176 - 14 * t} ${335 + 48 * t} 151 384`,
  ],
  hamstrings: [
    (t) => `M${153 + 25 * t} 398Q${146 + 29 * t} 439 166 495`,
    (t) => `M${180 + 16 * t} 399Q${166 + 28 * t} 444 183 496`,
    (t) => `M${198 + 7 * t} 399Q${202 - 5 * t} 445 189 487`,
  ],
};

const posteriorFiberDirections: typeof fiberDirections = {
  ...fiberDirections,
  shoulders: [(t) => `M${114 + 31 * t} 124Q${101 + 36 * t} 151 112 184`, (t) => `M${139 + 13 * t} 139Q${132 + 12 * t} 165 121 184`],
  calves: [
    (t) => `M${155 + 20 * t} 523Q${150 + 26 * t} 556 ${166 + 6 * t} 588`,
    (t) => `M${180 + 14 * t} 524Q${177 + 22 * t} 560 ${184 + 8 * t} 594`,
    (t) => `M${156 + 12 * t} 571Q${160 + 10 * t} 600 175 626`,
  ],
};

const LEVEL_COLOR: Record<FatigueLevel, string> = {
  critico: "var(--red-hi)",
  atencao: "var(--amber)",
  estavel: "var(--cyan)",
};

function Pair({ children }: { children: ReactNode }) {
  return (
    <>
      <g>{children}</g>
      <g transform="translate(420 0) scale(-1 1)">{children}</g>
    </>
  );
}

export function Anatomy({
  view,
  zones,
  selectedId,
  onSelect,
}: {
  view: View;
  zones: AnatomyZone[];
  selectedId: MuscleId | null;
  onSelect: (id: MuscleId) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const ref = (name: string) => `${uid}-${name}`;
  const paint = (name: string) => `url(#${ref(name)})`;
  const muscleShapes = view === "front" ? shapes : posteriorShapes;
  const fibers = view === "front" ? fiberDirections : posteriorFiberDirections;
  const footOutline = view === "front" ? FOOT_FRONT : FOOT_BACK;
  const groups = Object.keys(OWNERS[view]) as Group[];
  // Partes de cada músculo da vista; as sem dono viram placas neutras.
  const parts = (m: MuscleId | null) =>
    groups.flatMap((group) =>
      (muscleShapes[group] ?? []).map((d, part) => ({ group, part, d })).filter(({ group, part }) => ownerOf(view, group, part) === m),
    );
  const active = zones.find((zone) => zone.id === selectedId);
  const callout = active && CALLOUTS[view][active.id];
  const neutral = [...(view === "front" ? anteriorNeutral : posteriorNeutral), ...parts(null).map((p) => p.d)];

  return (
    <svg
      className="fm-body-map"
      viewBox="0 0 420 710"
      aria-label={`Mapa muscular interativo — vista ${view === "front" ? "frontal" : "posterior"}`}
    >
      <defs>
        <linearGradient id={ref("titanium")} x1="0" y1=".1" x2=".9" y2=".7">
          <stop stopColor="#091016" />
          <stop offset=".23" stopColor="#263e4b" />
          <stop offset=".42" stopColor="#59727d" />
          <stop offset=".49" stopColor="#304752" />
          <stop offset=".76" stopColor="#17242e" />
          <stop offset="1" stopColor="#060d14" />
        </linearGradient>
        <linearGradient id={ref("ceramic")} x1="0" y1="0" x2="1" y2=".7">
          <stop stopColor="#6c8590" />
          <stop offset=".08" stopColor="#30424e" />
          <stop offset=".48" stopColor="#14202c" />
          <stop offset=".8" stopColor="#0a121d" />
          <stop offset="1" stopColor="#344954" />
        </linearGradient>
        <linearGradient id={ref("skin")} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#081820" />
          <stop offset=".55" stopColor="#0d2731" />
          <stop offset="1" stopColor="#123440" />
        </linearGradient>
        <radialGradient id={ref("foot")} gradientUnits="userSpaceOnUse" cx="176" cy="646" r="39">
          <stop stopColor="#71919c" />
          <stop offset=".3" stopColor="#395764" />
          <stop offset=".7" stopColor="#172d38" />
          <stop offset="1" stopColor="#0a1722" />
        </radialGradient>
        <linearGradient id={ref("sweep")} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#5ff4f7" stopOpacity="0" />
          <stop offset=".82" stopColor="#5ff4f7" stopOpacity=".16" />
          <stop offset=".97" stopColor="#c4feff" stopOpacity=".55" />
          <stop offset="1" stopColor="#5ff4f7" stopOpacity="0" />
        </linearGradient>
        <pattern id={ref("slices")} width="6" height="4.5" patternUnits="userSpaceOnUse">
          <path d="M0 .5H6" stroke="#6fe9ee" strokeOpacity=".11" strokeWidth=".5" />
        </pattern>
        {(["critico", "atencao", "estavel"] as const).map((status) => {
          const colors = {
            critico: ["#3a0b20", "#b83851", "#ed8d94", "#8b273e", "#220e1b"],
            atencao: ["#251b16", "#9e7049", "#d9ba8b", "#71503a", "#161a20"],
            estavel: ["#10202b", "#2c6170", "#80afb4", "#294853", "#0b161f"],
          }[status];
          return (
            <radialGradient key={status} id={ref(status)} cx=".36" cy=".28" r=".83" gradientTransform="translate(0 -.08) scale(1 1.18)">
              <stop stopColor={colors[2]} />
              <stop offset=".28" stopColor={colors[1]} />
              <stop offset=".66" stopColor={colors[3]} />
              <stop offset=".88" stopColor={colors[0]} />
              <stop offset="1" stopColor={colors[4]} />
            </radialGradient>
          );
        })}
        <radialGradient id={ref("floor")}>
          <stop stopColor="#24c7d1" stopOpacity=".26" />
          <stop offset="1" stopColor="#24c7d1" stopOpacity="0" />
        </radialGradient>
        <filter id={ref("emission")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.5" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={ref("rim")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id={ref("silhouette")}>
          <path d={SILHOUETTE} />
          <path d={SILHOUETTE} transform="translate(420 0) scale(-1 1)" />
          {[undefined, "translate(420 0) scale(-1 1)"].map((mirror) => (
            <g key={mirror ?? "left-foot"} transform={mirror}>
              <path d={footOutline} />
            </g>
          ))}
          {[undefined, "translate(420 0) scale(-1 1)"].map((mirror) => (
            <g key={mirror ?? "left"} transform={`${mirror ?? ""} translate(${HAND_OFFSET} 0)`}>
              <path d={HAND.thumb.d} transform={HAND.thumb.transform} />
              <path d={HAND.palm} />
              {fingers.map(({ d, transform }) => (
                <path key={d} d={d} transform={transform} />
              ))}
            </g>
          ))}
          <path d="M187 65C181 44 186 23 199 17C207 13 222 14 231 23C240 32 239 51 235 65L231 79L220 92H203L191 79Z" />
        </clipPath>
        {groups.flatMap((group) =>
          (muscleShapes[group] ?? []).map((d, index) => (
            <clipPath id={ref(`clip-${group}-${index}`)} key={`${group}-${index}`}>
              <path d={d} />
            </clipPath>
          )),
        )}
      </defs>

      <ellipse cx="210" cy="680" rx="118" ry="15" fill={paint("floor")} />
      <g className="holo-ring back" fill="none" pointerEvents="none">
        <path d="M84 338A126 17 0 0 1 336 338" />
        <path d="M118 672A92 12 0 0 1 302 672" />
      </g>
      <g className="anatomy-registration" fill="none" stroke="#77e0e3" strokeWidth=".5" opacity=".2">
        <path d="M210 79V680M110 124H61v531h49M310 124h49v531h-49" strokeDasharray="2 6" />
        {[148, 254, 342, 495, 637].map((y) => (
          <path key={y} d={`M58 ${y}h9M353 ${y}h9`} />
        ))}
      </g>

      {/* Fresnel rim light keeps the silhouette readable without a hard outline. */}
      <g fill="none" stroke="#2fd9e3" strokeOpacity=".28" strokeWidth="3" filter={paint("rim")} pointerEvents="none">
        <Pair>
          <path d={SILHOUETTE} />
          <path d={footOutline} />
          <path d={HAND.palm} transform={`translate(${HAND_OFFSET} 0)`} />
        </Pair>
      </g>

      <Pair>
        <path fill={paint("skin")} stroke="#4b7c88" strokeOpacity=".62" strokeWidth=".7" d={SILHOUETTE} />
        <g fill={paint("titanium")} stroke="#718e97" strokeOpacity=".34" strokeWidth=".65" fillOpacity=".92">
          {neutral.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g className="chassis-seams" fill="none" stroke="#b0cbd0" strokeOpacity=".2" strokeWidth=".55">
          <path d="M110 187C108 203 105 222 109 238M107 257C103 274 103 291 105 307M119 263L111 301M159 534C157 555 164 574 169 585M184 550L182 599" />
        </g>
        <g className="anatomy-foot" pointerEvents="none">
          <path d={footOutline} fill={paint("foot")} stroke="#8aabb7" strokeOpacity=".65" strokeWidth=".65" />
          {view === "front" ? (
            <>
              <path
                d="M171 639C169 647 168 654 169 661C174 664 181 664 186 662C185 654 183 647 181 639C177 641 174 641 171 639Z"
                fill={paint("titanium")}
                fillOpacity=".4"
                stroke="#a6c2c9"
                strokeOpacity=".28"
                strokeWidth=".5"
              />
              <path
                className="anatomy-toecap"
                d="M157 665C166 669 183 670 194 667C194.5 669 194.5 670 194 671C194 676 193 679 189 679C184 679 174 678 166 676C160 675 156 673 156 669C156 667 156.5 666 157 665Z"
                fill="#c9e4ea"
                fillOpacity=".08"
              />
              <g fill="none" stroke="#c4dce0" strokeLinecap="round" strokeWidth=".5">
                <path strokeOpacity=".22" d="M176 637C176 648 178 656 180 664M172 639C170 648 169 656 168 664" />
                <path strokeOpacity=".4" d="M157 665C166 669 183 670 194 667M163 645Q161 648 162 651M189 641Q191 644 190 647" />
                <path
                  strokeOpacity=".26"
                  d="M186.5 669L187.5 678.5M180.5 669.5L181 678.2M174.5 669.3L174 677.5M168.5 668.6L167.5 676.4M162.5 667.4L161.5 675"
                />
              </g>
              <path
                d="M160 674.5C168 677 183 678.3 190 678"
                fill="none"
                stroke="#65e9ef"
                strokeOpacity=".55"
                strokeWidth=".6"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M170 634C169 645 166 653 169 661C172 666 181 666 184 661C186 653 180 645 181 634Z"
                fill={paint("titanium")}
                stroke="#a6c2c9"
                strokeOpacity=".3"
                strokeWidth=".55"
              />
              <path
                d="M175 635C174 646 172 654 175 660M163 666C170 669 182 669 189 666"
                fill="none"
                stroke="#b4ced5"
                strokeOpacity=".35"
                strokeWidth=".55"
                strokeLinecap="round"
              />
            </>
          )}
          <path d="M166 635Q169 638 172 637" fill="none" stroke="#65e9ef" strokeWidth=".8" filter={paint("emission")} />
        </g>
        <g className="cyber-hand" transform={`translate(${HAND_OFFSET} 0)`}>
          <g transform={HAND.thumb.transform}>
            <path className="hand-shell" d={HAND.thumb.d} />
            <path className="hand-joints" d={HAND.thumb.joints.map((y) => `M104.9 ${y}H108.7`).join("")} />
          </g>
          <path className="hand-shell" d={HAND.palm} />
          <path className="hand-tendons" d="M88 326L84 347M94 323L90 348M100 323L96 348M105 325L102 347" />
          {fingers.map(({ d, joints, transform }, index) => {
            const x = [81.4, 86.8, 92.6, 98.7][index];
            const width = [4.9, 5.3, 5.6, 5.3][index];
            return (
              <g key={d} transform={transform}>
                <path className="hand-shell" d={d} />
                <path className="hand-joints" d={joints.map((y) => `M${x + 0.7} ${y}H${x + width - 0.7}`).join("")} />
              </g>
            );
          })}

          <path className="hand-led" d="M88 332H99" />
        </g>
      </Pair>

      {/* Internal layers: CT slices, skeleton and bio-signal routing. */}
      <g clipPath={paint("silhouette")} pointerEvents="none">
        <rect x="60" y="10" width="300" height="680" fill={paint("slices")} />
        <g className="xray-skeleton" fill="none">
          <Pair>
            {skeleton.map((d, i) => (
              <path key={i} d={d} />
            ))}
            <circle cx="176" cy="362" r="4.5" />
            <circle cx="182" cy="502" r="5" />
          </Pair>
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x="206.5" y={104 + i * 10.5} width="7" height="7" rx="2" />
          ))}
        </g>
        <Pair>
          <g className="nerve-flow" fill="none">
            {nerves.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <g className="vessel-flow" fill="none">
            {vessels.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </Pair>
      </g>

      {zones.map((zone) => {
        const id = zone.id;
        const own = parts(id);
        if (!own.length) return null;
        const selected = selectedId === id;
        return (
          <g
            key={id}
            className={`anatomy-muscle ${zone.level}${selected ? " is-selected" : ""}`}
            // Tom contínuo pela % (ciano → âmbar → vermelho), não só três faixas.
            style={
              zone.fatigue > 0
                ? ({ "--tissue-edge": fatigueColor(zone.fatigue), "--tissue-glow": fatigueColor(zone.fatigue) } as CSSProperties)
                : undefined
            }
            tabIndex={0}
            role="button"
            aria-label={`${zone.name}, fadiga ${zone.fatigue}%`}
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(id);
              }
            }}
          >
            <title>
              {zone.name} — {zone.fatigue}% de fadiga
            </title>
            <Pair>
              {id === "deltLateral" && view === "back" && (
                <path d={SHOULDER_HIT_AREA} fill="transparent" stroke="none" pointerEvents="all" />
              )}
              {own.map(({ d }, i) => (
                <path key={i} className="sculpted-muscle" d={d} fill={paint(zone.level)} fillOpacity=".9" strokeWidth=".8" />
              ))}
              {own.map(({ group, part }) => (
                <g
                  key={`${group}-${part}`}
                  clipPath={paint(`clip-${group}-${part}`)}
                  className="muscle-fascicles"
                  fill="none"
                  pointerEvents="none"
                >
                  {Array.from({ length: 18 }, (_, i) => {
                    const d = fibers[group][part](i / 17);
                    return (
                      <g key={i}>
                        <path d={d} stroke="#e7e3dc" strokeOpacity={i % 3 === 0 ? ".25" : ".12"} strokeWidth=".55" />
                        <path d={d} transform="translate(.8 .8)" stroke="#000" strokeOpacity=".24" strokeWidth=".7" />
                      </g>
                    );
                  })}
                  <ellipse className="muscle-specular" cx={SPECULAR[group][0]} cy={SPECULAR[group][1] - 8} rx="10" ry="18" />
                </g>
              ))}
              {own.map(({ d }, i) => (
                <path key={i} d={d} className="muscle-contour" fill="none" strokeWidth=".55" pointerEvents="none" />
              ))}
            </Pair>
          </g>
        );
      })}

      {/* Mechanical integration sits over the anatomy, not over its hit areas. */}
      <g pointerEvents="none">
        <Pair>
          <g fill={paint("ceramic")} stroke="#69808d" strokeWidth=".8">
            {armor.map((d, i) => (
              <path d={d} key={i} />
            ))}
            <path d="M189 89L194 107L207 121L207 98Z" />
            <path d="M205 327L186 316L191 334L204 350L209 374L209 333Z" />
          </g>
          <g fill="none" stroke="#a3c5ce" strokeOpacity=".32" strokeWidth=".6">
            <path d="M165 491L183 487L190 495L187 508L180 516L168 509ZM159 119L179 113M169 310L179 326L187 329M171 615L171 635M102 306L107 317M192 96L198 109" />
          </g>
          <g fill="none" stroke="#53e8ee" strokeWidth="1.4" filter={paint("emission")}>
            <path d="M150 126L172 119L178 119M175 310L185 320M171 496L180 494L185 497M103 311L107 316M168 626V635" />
          </g>
          <g fill="#99f9fa" filter={paint("emission")}>
            <rect x="181" y="115" width="2" height="3" rx=".7" />
            <circle cx="180" cy="506" r="1.4" />
            <circle cx="107" cy="322" r="1" />
          </g>
        </Pair>

        {view === "back" && (
          <g>
            <path d="M207 103L213 103L216 309L210 325L204 309Z" fill={paint("ceramic")} stroke="#5c919f" strokeWidth=".7" />
            {Array.from({ length: 20 }, (_, i) => (
              <path key={i} d={`M207 ${121 + i * 9}h6l2 4h-10Z`} fill={i % 3 === 0 ? "#4fd8e1" : "#3a535f"} />
            ))}
          </g>
        )}
        <g className="anatomy-head">
          <path
            d="M187 65C181 44 186 23 199 17C207 13 222 14 231 23C240 32 239 51 235 65L231 79L220 92H203L191 79Z"
            fill={paint("ceramic")}
            stroke="#8099a5"
            strokeWidth=".8"
          />
          <path
            d="M191 31L198 24L207 22L202 47L192 51ZM214 22L226 26L232 34L231 51L218 47Z"
            fill="#263944"
            stroke="#465c6c"
            strokeWidth=".6"
          />
          <path
            d="M189 52L201 58L210 60L220 57L233 51L230 64L219 70L217 79H204L201 70L191 65Z"
            fill="#07131b"
            stroke="#3d626e"
            strokeWidth=".7"
          />
          {view === "front" ? (
            <>
              <path d="M190 55L202 63L210 65L219 62L232 54" fill="none" stroke="#69f5f6" strokeWidth="1.8" filter={paint("emission")} />
              <path d="M202 80L210 86L219 80M210 69V78" fill="none" stroke="#708c9c" strokeWidth=".8" />
            </>
          ) : (
            <>
              <path d="M202 26H219L223 40L218 55H204L199 40Z" fill="#1c303d" stroke="#63818d" strokeWidth=".8" />
              <path d="M206 39H216M206 43H216M209 70V81" stroke="#65ecf3" strokeWidth="1.6" filter={paint("emission")} />
            </>
          )}
          <path d="M185 48L182 51L184 64L189 67M236 48L240 51L238 64L234 67" fill={paint("titanium")} stroke="#78949f" strokeWidth=".7" />
        </g>

        <g clipPath={paint("silhouette")}>
          <rect className="scan-sweep" x="60" y="-40" width="300" height="46" fill={paint("sweep")} />
        </g>
        <g className="holo-ring front" fill="none">
          <path d="M84 338A126 17 0 0 0 336 338" />
          <path d="M118 672A92 12 0 0 0 302 672" />
        </g>

        {active && callout && (
          <g className="anatomy-callout" key={active.id} style={{ color: LEVEL_COLOR[active.level] }}>
            <circle cx={callout[0]} cy={callout[1]} r="9" className="reticle-outer" />
            <circle cx={callout[0]} cy={callout[1]} r="2.4" fill="currentColor" />
            <path
              className="callout-leader"
              d={`M${callout[0]} ${callout[1]}L${callout[0] + (callout[2] === "left" ? -24 : 24)} ${callout[1] - 26}H${
                callout[2] === "left" ? 14 : 406
              }`}
            />
            <g textAnchor={callout[2] === "left" ? "start" : "end"}>
              <text x={callout[2] === "left" ? 14 : 406} y={callout[1] - 32} className="callout-name">
                {active.name.toUpperCase()}
              </text>
              <text x={callout[2] === "left" ? 14 : 406} y={callout[1] - 14} className="callout-value">
                {active.fatigue}% / FADIGA
              </text>
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
