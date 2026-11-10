import { useNavigate } from "react-router-dom";
import { PageHead } from "../components/bits";

// Política de privacidade e regras de convivência, em linguagem simples. O mesmo texto está em docs/privacidade.md
// (para publicar numa página e apontar nas lojas de app). Mudou um, mude o outro.

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Sem conta, nada sai do seu celular",
    items: [
      "Treinos, medidas, fotos e ajustes ficam guardados só neste aparelho.",
      "O app não tem anúncios, não rastreia você e não vende dados.",
      "Se uma tela quebrar, o app pode enviar um aviso técnico (a mensagem do erro, a tela e a versão do app), sem nome, sem conta e sem dados de treino.",
    ],
  },
  {
    title: "Com conta online (opcional), o que vai para o servidor",
    items: [
      "Seu nome de usuário, o nome que os amigos veem e a senha (guardada embaralhada: ninguém consegue ler).",
      "Sua melhor marca em cada exercício, o resumo de cada treino (data, nome, séries, volume, duração) e os treinos completos, para aparecerem nos seus outros aparelhos.",
      "O backup automático: uma cópia dos seus dados que só a sua conta acessa.",
      "As fotos do corpo NÃO vão no backup da nuvem, a não ser que você ligue essa opção na tela da conta.",
      "Sexo e peso corporal, só se você informar, e só para calcular a comparação. Ninguém vê.",
      "O app não pede e-mail, telefone, localização nem contatos.",
    ],
  },
  {
    title: "Quem vê o quê",
    items: [
      "Comparação com todos: é anônima. Só entra a sua marca na conta da porcentagem, sem nome. Dá para sair dela na tela da conta.",
      "Amigos (só quem você aceitou): veem seu nome, o resumo dos seus treinos e seus recordes. Dá para desligar na tela da conta.",
      "Qualquer usuário consegue achar seu nome de usuário na busca para mandar pedido de amizade, a não ser quem você bloqueou.",
      "Seu backup, suas fotos, seu sexo e seu peso nunca aparecem para outras pessoas.",
    ],
  },
  {
    title: "Seus controles",
    items: [
      "Sair da conta: o app para de enviar. O que está no celular continua.",
      "Apagar a conta: apaga do servidor a conta, amizades, recordes, treinos e backups, na hora. Fica na tela da conta, em “Apagar minha conta”.",
      "Bloquear alguém: desfaz a amizade e a pessoa não te acha mais nem consegue mandar pedido. Ela não é avisada.",
      "Denunciar alguém: o aviso chega a quem cuida do servidor, que pode remover a conta denunciada.",
    ],
  },
  {
    title: "Regras de convivência",
    items: [
      "Não use nome ofensivo, que se passe por outra pessoa ou que faça propaganda.",
      "Não registre marcas falsas para aparecer na frente nas comparações.",
      "Contas que quebrarem essas regras podem ser removidas.",
    ],
  },
  {
    title: "Treinador por IA",
    items: [
      "É opcional e usa a sua própria chave da Anthropic. Quando você conversa com o treinador, os dados de treino necessários para responder vão direto do seu celular para a Anthropic, sem passar pelo servidor do AUGMENT.",
      "A chave fica guardada só no seu aparelho.",
    ],
  },
  {
    title: "Mais",
    items: [
      "O servidor fica na Cloudflare. Os dados são guardados enquanto a conta existir.",
      "A conta online é para maiores de 13 anos.",
      "Se esta política mudar, o texto novo aparece aqui antes de valer.",
    ],
  },
];

export function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="stack-lg">
      <PageHead back="/online" code="AUG.NET // PRIVACIDADE" title="Privacidade" sub="O que o app guarda, o que envia e quem vê." />
      {SECTIONS.map((s) => (
        <section key={s.title} data-augmented-ui="tl-clip br-clip border" className="card stack">
          <h2 className="h-sec">{s.title}</h2>
          <ul className="small prose-list" style={{ marginTop: 0 }}>
            {s.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={() => navigate(-1)}>
        Voltar
      </button>
    </div>
  );
}
