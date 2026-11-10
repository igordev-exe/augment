# AUGMENT: política de privacidade e regras de convivência

Texto em linguagem simples. É o mesmo que aparece no app em Conta online > Política de privacidade
(`src/screens/PrivacyPolicy.tsx`). Mudou um, mude o outro. Para as lojas de app, publique esta página e use o
endereço dela no cadastro do aplicativo.

## Sem conta, nada sai do seu celular

- Treinos, medidas, fotos e ajustes ficam guardados só neste aparelho.
- O app não tem anúncios, não rastreia você e não vende dados.
- Se uma tela quebrar, o app pode enviar um aviso técnico (a mensagem do erro, a tela e a versão do app), sem nome, sem conta e sem dados de treino.

## Com conta online (opcional), o que vai para o servidor

- Seu nome de usuário, o nome que os amigos veem e a senha (guardada embaralhada: ninguém consegue ler).
- Sua melhor marca em cada exercício, o resumo de cada treino (data, nome, séries, volume, duração) e os treinos completos, para aparecerem nos seus outros aparelhos.
- O backup automático: uma cópia dos seus dados que só a sua conta acessa.
- As fotos do corpo NÃO vão no backup da nuvem, a não ser que você ligue essa opção na tela da conta.
- Sexo e peso corporal, só se você informar, e só para calcular a comparação. Ninguém vê.
- O app não pede e-mail, telefone, localização nem contatos.

## Quem vê o quê

- Comparação com todos: é anônima. Só entra a sua marca na conta da porcentagem, sem nome. Dá para sair dela na tela da conta.
- Amigos (só quem você aceitou): veem seu nome, o resumo dos seus treinos e seus recordes. Dá para desligar na tela da conta.
- Qualquer usuário consegue achar seu nome de usuário na busca para mandar pedido de amizade, a não ser quem você bloqueou.
- Seu backup, suas fotos, seu sexo e seu peso nunca aparecem para outras pessoas.

## Seus controles

- Sair da conta: o app para de enviar. O que está no celular continua.
- Apagar a conta: apaga do servidor a conta, amizades, recordes, treinos e backups, na hora. Fica na tela da conta, em “Apagar minha conta”.
- Bloquear alguém: desfaz a amizade e a pessoa não te acha mais nem consegue mandar pedido. Ela não é avisada.
- Denunciar alguém: o aviso chega a quem cuida do servidor, que pode remover a conta denunciada.

## Regras de convivência

- Não use nome ofensivo, que se passe por outra pessoa ou que faça propaganda.
- Não registre marcas falsas para aparecer na frente nas comparações.
- Contas que quebrarem essas regras podem ser removidas.

## Treinador por IA

- É opcional e usa a sua própria chave da Anthropic. Quando você conversa com o treinador, os dados de treino necessários para responder vão direto do seu celular para a Anthropic, sem passar pelo servidor do AUGMENT.
- A chave fica guardada só no seu aparelho.

## Mais

- O servidor fica na Cloudflare. Os dados são guardados enquanto a conta existir.
- A conta online é para maiores de 13 anos.
- Se esta política mudar, o texto novo aparece aqui antes de valer.

## Para quem hospeda o servidor

- Denúncias: `GET /admin/reports` com o cabeçalho `Authorization: Bearer <ADMIN_TOKEN>`.
- Remover uma conta denunciada: `POST /admin/users/delete` com `{ "userId": "..." }` e o mesmo cabeçalho.
- Erros do app: `GET /admin/errors`.
