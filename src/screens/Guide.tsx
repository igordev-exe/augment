import type { ReactNode } from "react";
import { PageHead } from "../components/bits";
import { MUSCLE_LABEL, MUSCLE_ORDER } from "../data/program";
import { plannedVolume } from "../lib/sessions";

// Guia: regras da ficha v2 (carga fixa, até onde ir, −15% na última série) e fontes.

const SECTIONS = [
  { id: "semana", t: "Semana" },
  { id: "carga", t: "Carga" },
  { id: "falha", t: "Falha" },
  { id: "cadencia", t: "Cadência" },
  { id: "progressao", t: "Progressão" },
  { id: "mesociclo", t: "Mesociclo" },
  { id: "intensificadores", t: "Intensificadores" },
  { id: "volume", t: "Volume" },
  { id: "deload", t: "Deload" },
  { id: "dieta", t: "Recomposição" },
  { id: "recuperacao", t: "Recuperação" },
  { id: "erros", t: "Erros" },
  { id: "fontes", t: "Fontes" },
];

function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="guide-sec card stack">
      <h2 className="h-sec">{title}</h2>
      <div className="prose">{children}</div>
    </section>
  );
}

export function Guide() {
  const vol = plannedVolume(3);
  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // MANUAL DO OPERADOR" title="Guia" sub="As regras da ficha v2 e o porquê de cada uma." />

      <nav className="toc" aria-label="Seções do guia">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-augmented-ui="br-clip border" className="chip"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {s.t}
          </a>
        ))}
      </nav>

      <Sec id="semana" title="Como rodar a semana">
        <p>Segunda Push A, terça Pull A, quarta Lower A, quinta Upper B, sexta Lower B. Sábado e domingo são descanso.</p>
        <p>
          <strong>Perdeu um dia?</strong> Não pule o treino: empurre a sequência. Push A → Pull A → Lower A → Upper B → Lower B e recomeça. Cada
          grupo cai ~2× a cada 7–8 dias. A aba Histórico já mostra a agenda recalculada.
        </p>
        <p>Use o sábado como recuperação, não como sexto treino. Cada sessão leva 70–80 minutos.</p>
      </Sec>

      <Sec id="carga" title="Carga: como espalhar o peso">
        <ol>
          <li>
            <strong>Aquecimento:</strong> 2 séries leves no primeiro exercício do dia e 1 nos demais, com poucas reps. Não contam como série.
          </li>
          <li>
            <strong>Carga fixa:</strong> o mesmo peso em todas as séries de trabalho. É normal as reps caírem de uma série para outra (10, 9, 8).
          </li>
          <li>
            <strong>−15% na última:</strong> se uma série cair abaixo do piso da faixa, a última série vai com 15% a menos. O app faz isso
            sozinho e marca a série como "−15%".
          </li>
        </ol>
        <p className="callout">
          Por que carga fixa: pirâmides, drop sets e carga fixa dão hipertrofia parecida quando cada série termina perto da falha (Angleri
          2017; revisões de Cattan 2021 e Cardozo 2023). A carga fixa é a estrutura usada como referência na maioria dos estudos e a mais
          simples de comparar semana a semana.
        </p>
        <p>
          O que não funciona é a pirâmide crescente com séries leves longe da falha (40×10 → 80×8 → 120×6): na prática vira 1 série efetiva.
        </p>
      </Sec>

      <Sec id="falha" title="Até onde ir em cada série">
        <p>
          <strong>Falha</strong> (máquinas e isolados): você empurra com tudo, com técnica certa, e a carga trava. A rep que travou não conta.
        </p>
        <p>
          <strong>Falha técnica</strong> (compostos): a última rep que saiu limpa. Se a próxima vai precisar roubar ou vai parar no meio, não
          tente.
        </p>
        <p>
          <strong>Sobra 2</strong> (terra romeno): pare na primeira rep visivelmente lenta. Nunca à falha.
        </p>
        <p className="callout warn">
          Nas semanas 1 e 2, e no deload, ninguém vai à falha: o app troca o selo para "Sobra N" automaticamente.
        </p>
        <p>
          <strong>Como a série evolui:</strong>
        </p>
        <ol>
          <li>Reps fáceis: a carga sobe rápido, respiração normal.</li>
          <li>Primeira rep lenta: mesma intenção, subida mais devagar. Costuma sobrar 2–3 reps.</li>
          <li>Reps "moídas": 2–3 s para subir, tremor, careta, o corpo tenta roubar. Sobra ~1.</li>
          <li>Falha: você manda o comando e o músculo não responde. Peso morto, sem progresso.</li>
        </ol>
        <p>
          <strong>Ardência não é falha.</strong> Ela vem do acúmulo de metabólitos e aparece cedo nas séries longas, às vezes com 6–8 reps
          sobrando. Use a velocidade da rep, não a queimação, para decidir quando parar.
        </p>
        <p>
          <strong>Pare na hora se sentir:</strong> dormência ou formigamento (nervo comprimido: ajuste a posição), dor aguda e localizada
          (fisgada), tontura (solte o ar na subida).
        </p>
        <p>
          <strong>Calibrar o RIR:</strong> na última série de uma máquina, quando vier a primeira rep lenta, chute quantas sobram e vá até travar.
          Em 2–3 semanas sua leitura de "falta 1" nos compostos fica bem mais precisa.
        </p>
        <p className="small muted">
          Base: proximidade da falha influencia hipertrofia, não força (Robinson 2024). Parar com 1–2 reps sobrando deu hipertrofia parecida
          com ir à falha em treinados (Refalo 2024). As pessoas erram ~1 rep ao estimar o RIR, e erram mais longe da falha (Halperin 2022).
        </p>
      </Sec>

      <Sec id="cadencia" title="Cadência e amplitude">
        <ul>
          <li>Desça em 2–3 s, controlando. No terra romeno, até 4 s.</li>
          <li>No ponto alongado, controle a carga: sem quicar e sem deixar o peso descansar na articulação.</li>
          <li>Suba com intenção de ser rápido, sem impulso. Nas últimas reps a carga vai subir devagar mesmo assim: é o sinal de que está perto da falha.</li>
          <li>Não trave nem descanse no topo, exceto onde a ficha pede pausa (encolhimento, elevação pélvica, panturrilha sentada).</li>
        </ul>
        <p>
          Reps de 0,5 a 8 s de duração total dão hipertrofia parecida (Schoenfeld 2015). Só o superlento (mais de 10 s) se sai pior.
        </p>
        <p>
          <strong>Amplitude:</strong> completa e controlada é o padrão. Parciais alongadas só onde há dado: extensora depois da falha e panturrilha
          em pé (Kassiano 2023). A seleção prioriza exercícios com resistência alta na posição alongada (Wolf 2023; Maeo 2021 e 2023), com a
          ressalva de que em treinados a vantagem parece menor (Wolf 2025).
        </p>
      </Sec>

      <Sec id="progressao" title="Dupla progressão">
        <ol>
          <li>Escolha a carga que deixa a 1ª série dentro da faixa de reps.</li>
          <li>A cada semana, tente +1 rep por série com a mesma carga.</li>
          <li>Quando todas as séries baterem o topo da faixa, suba a carga (+2,5 kg nos compostos, +1 a 2,5 kg nos isolados) e volte ao piso.</li>
          <li>Registre tudo. Sem registro não há progressão.</li>
        </ol>
        <p className="callout">
          No treino, o app mostra a última vez e uma sugestão: manter (com a meta de reps de cada série), subir ou baixar. Se você usou o −15%
          na última vez, ele mantém a carga até todas as séries caberem na faixa.
        </p>
        <div data-augmented-ui="tl-clip br-clip border" className="table-wrap" style={{ marginTop: 10 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Supino inclinado, faixa 6–10</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>30 kg × 8, 8, 7, 6</td><td>Dentro da faixa</td></tr>
              <tr><td>2</td><td>30 kg × 9, 9, 8, 7</td><td>Progrediu em reps</td></tr>
              <tr><td>3</td><td>30 kg × 10, 10, 9, 9</td><td>Quase lá</td></tr>
              <tr><td>4</td><td>30 kg × 10, 10, 10, 10</td><td>Teto batido: sobe</td></tr>
              <tr><td>5</td><td>32,5 kg × 8, 7, 7, 6</td><td>Recomeça</td></tr>
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec id="mesociclo" title="Mesociclo de 6 semanas + deload">
        <div data-augmented-ui="tl-clip br-clip border" className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Sem.</th>
                <th>Séries</th>
                <th>Compostos</th>
                <th>Isolados</th>
                <th>Intensif.</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Ficha, −1 nos isolados</td><td>2–3 RIR</td><td>1–2 RIR</td><td>0</td></tr>
              <tr><td>2</td><td>Ficha</td><td>2 RIR</td><td>1 RIR</td><td>0</td></tr>
              <tr><td>3</td><td>Ficha</td><td>1–2 RIR</td><td>0–1 RIR</td><td>1</td></tr>
              <tr><td>4</td><td>+1 nos ▲</td><td>1–2 RIR</td><td>0–1 RIR</td><td>2</td></tr>
              <tr><td>5</td><td>+1 nos ▲</td><td>1 RIR</td><td>0</td><td>2–3</td></tr>
              <tr><td>6</td><td>+1 nos ▲</td><td>1 RIR</td><td>0</td><td>3</td></tr>
              <tr><td>D</td><td>Metade, mesma carga</td><td>4 RIR</td><td>4 RIR</td><td>0</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          ▲ = ganham +1 série nas semanas 4–6: supino na máquina, crucifixo no cabo, pullover, remada baixa e a elevação lateral do Lower B.
          Nenhum exercício passa de 4 séries e o braço não ganha séries. Compostos livres nunca abaixo de 1 RIR.
        </p>
        <p>A semana atual é calculada pela data de início em Ajustes, e o app ajusta séries, selos e intensificadores sozinho.</p>
      </Sec>

      <Sec id="intensificadores" title="Intensificadores">
        <p>Só na última série de exercícios de máquina ou cabo, nunca em movimento livre pesado.</p>
        <ul>
          <li><strong>Drop set:</strong> falha → tira ~30% da carga → falha de novo.</li>
          <li><strong>Rest-pause:</strong> falha → 15 s de descanso → mais reps até falhar → repete uma vez.</li>
          <li><strong>Myo-reps:</strong> série de ativação de 15–20 reps a 1 RIR; depois 15 s e mini-séries de 3–5 reps, até não completar ou até 5 delas.</li>
        </ul>
      </Sec>

      <Sec id="volume" title="Volume e frequência">
        <p>
          Séries semanais e hipertrofia têm relação positiva com retornos decrescentes (Pelland 2025; Schoenfeld 2017). A recomendação padrão
          para homens jovens treinados é 12–20 séries por músculo por semana (Baz-Valle 2022). Cada músculo é treinado 2× por semana porque
          dividir o volume rende mais séries de qualidade.
        </p>
        <div data-augmented-ui="tl-clip br-clip border" className="table-wrap" style={{ marginTop: 8 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Músculo</th>
                <th className="r">Séries diretas/semana</th>
              </tr>
            </thead>
            <tbody>
              {MUSCLE_ORDER.map((m) => (
                <tr key={m}>
                  <td>{MUSCLE_LABEL[m]}</td>
                  <td className="r">{vol[m]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Deltoide lateral e dorsal ficam no topo de propósito. Bíceps e tríceps recebem muito volume indireto (~16–17 séries efetivas
          contando puxadas e supinos), por isso o braço não ganha séries nas semanas 4–6.
        </p>
      </Sec>

      <Sec id="deload" title="Deload e volume cego">
        <p>
          O deload corta séries pela metade e mantém a carga. Antecipe se dois sinais aparecerem juntos: reps caindo com a mesma carga em duas
          sessões seguidas, sono ruim, articulação reclamando.
        </p>
        <p>Depois do deload, troque 2 a 3 exercícios acessórios por variações equivalentes (outro ângulo, outra pegada), mantendo os padrões principais.</p>
        <p className="callout warn">
          <strong>Sinal de parada:</strong> se cargas ou reps caírem de forma sistemática de semana para semana, você passou do volume
          recuperável. Corte séries, não adicione. Em déficit isso chega mais cedo: atenção a partir da semana 4.
        </p>
      </Sec>

      <Sec id="dieta" title="Fase atual: recomposição">
        <p>Perder gordura mantendo e, se possível, ganhando massa. O superávit para hipertrofia máxima vem na fase seguinte.</p>
        <div data-augmented-ui="tl-clip br-clip border" className="table-wrap" style={{ marginTop: 8 }}>
          <table className="t">
            <tbody>
              <tr><td>Manutenção estimada</td><td>2.700–2.900 kcal/dia</td></tr>
              <tr><td>Ingestão alvo</td><td>2.400–2.500 kcal/dia</td></tr>
              <tr><td>Proteína</td><td>190–220 g/dia, 4 refeições de 45–55 g</td></tr>
              <tr><td>Gordura</td><td>60–80 g/dia</td></tr>
              <tr><td>Carboidrato</td><td>o restante (~220–260 g), mais perto do treino</td></tr>
              <tr><td>Ritmo de perda</td><td>0,4–0,6 kg por semana</td></tr>
              <tr><td>Reavaliação</td><td>a cada 3 semanas, pela média semanal do peso</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Quando mudar de fase:</strong> perto de 15–18% de gordura (abdômen com contorno visível na luz boa), ou se o desempenho cair
          por 2+ semanas mesmo após um deload. Aí o superávit é de +250 a 400 kcal, ganhando ~0,25–0,5% do peso por semana.
        </p>
        <p className="small muted">Orientação geral baseada em literatura pública. Não substitui nutricionista, médico ou educador físico.</p>
      </Sec>

      <Sec id="recuperacao" title="Recuperação">
        <ul>
          <li><strong>Sono:</strong> 7 a 9 horas. Em déficit, com 5 treinos por semana, é a diferença entre progredir e estagnar.</li>
          <li><strong>Cardio:</strong> 2–3 sessões de 30–40 min em zona 2, em dias separados ou depois da musculação, nunca antes. Mais 8–10 mil passos por dia.</li>
          <li><strong>Creatina:</strong> 5 g de monoidratada por dia, todo dia. Whey só se ajudar a bater a proteína.</li>
          <li><strong>Descanso entre séries:</strong> 2–3 min nos compostos, 60–120 s nos isolados. Descanso curto só faz você render menos (Singer 2024).</li>
        </ul>
      </Sec>

      <Sec id="erros" title="Seis erros que custam o resultado">
        <ol>
          <li>Não registrar as séries.</li>
          <li>Descansar 45 s achando que "queima mais".</li>
          <li>Levar composto livre à falha.</li>
          <li>Trocar de programa a cada três semanas.</li>
          <li>Achar que mais volume é sempre melhor.</li>
          <li>Trocar exercício por tier list. Troque por equipamento, conforto ou evidência direta.</li>
        </ol>
      </Sec>

      <Sec id="fontes" title="Fontes">
        <ul className="small">
          <li>Pelland, Remmert, Robinson, Hinson e Zourdos. The Resistance Training Dose Response. Sports Medicine, 2025/2026.</li>
          <li>Schoenfeld, Ogborn e Krieger. J Sports Sci, 2017. Schoenfeld et al., Sports Med 2016; Schoenfeld, Grgic e Krieger, J Sports Sci 2019.</li>
          <li>Baz-Valle et al. J Hum Kinet, 2022.</li>
          <li>Robinson et al. Proximity to failure meta-regressions. Sports Med, 2024.</li>
          <li>Refalo et al. Sports Med, 2023; J Sports Sci, 2024.</li>
          <li>Halperin et al. Accuracy in predicting repetitions to task failure. Sports Med, 2022.</li>
          <li>Schoenfeld, Ogborn e Krieger. Repetition duration and hypertrophy. Sports Med, 2015.</li>
          <li>Singer et al. Give it a rest. Front Sports Act Living, 2024.</li>
          <li>Wolf et al. Int J Strength Cond, 2023; PeerJ, 2025. Maeo et al. MSSE 2021; Eur J Sport Sci 2023. Kassiano et al. JSCR 2023. Pedrosa et al. Eur J Sport Sci 2022.</li>
          <li>Angleri, Ugrinowitsch e Libardi. Crescent pyramid and drop-set systems. Eur J Appl Physiol, 2017.</li>
          <li>Cattan. Pyramidal Systems in Resistance Training. Encyclopedia (MDPI), 2021. Cardozo et al. J Bodyw Mov Ther, 2023.</li>
          <li>Sødal et al. Effects of Drop Sets on Skeletal Muscle Hypertrophy. Sports Med Open, 2023.</li>
          <li>Plotkin et al. Progressive overload without progressing load? PeerJ, 2022.</li>
          <li>Rogerson et al. Sports Med Open, 2024. Vargas-Molina et al. Eur J Appl Physiol, 2026. Aragon e Schoenfeld, Strength Cond J, 2020.</li>
          <li>Haun et al. PLoS One, 2019. Krieger (Weightology). Nuckols (Stronger by Science).</li>
        </ul>
      </Sec>
    </div>
  );
}
