# Etapas de melhoria

Cada etapa deve ter testes automatizados, revisão no navegador e confirmação de
funcionamento antes de iniciar a próxima. Alterações locais não são publicação.

## 1. Backup antes da migração — implementado localmente

- Exportação JSON versionada dos dados carregados e da simulação salva.
- Exportação CSV dos lançamentos de todos os anos, sem aplicar os filtros da tela.
- Nenhuma escrita no Supabase durante a exportação.
- Senhas e sessão não entram no envelope de backup.
- Falha ao buscar a simulação interrompe o backup completo, evitando exportação
  apresentada como completa com dados faltantes.

Validação manual: abrir Backup e exportação, baixar os dois arquivos, conferir os
anos e alguns lançamentos conhecidos. Abrir o CSV em uma planilha e verificar
acentos, datas e valores. Guardar o JSON antes de migrar a autenticação.

Limites: JSON reflete os dados financeiros em memória e a simulação já salva no
servidor; não representa alterações de outra aba nem edições não salvas da
simulação. Não inclui cadastro de usuários, políticas ou esquema do banco.
Importação/restauração ainda não está disponível.

## 2. Foco em uso pessoal — atualizado em 10/11/2026

Login e autenticação ficam fora das próximas entregas, conforme a orientação
para uso pessoal. Manter HTML, CSS e JavaScript sem build e sem adicionar
serviços ou alterar o esquema do banco nesta rodada.

Correções implementadas localmente:
- Metas aceitam valor atual e objetivo zero; novas metas respeitam o valor inicial.
- Valores negativos ou inválidos nas metas são rejeitados.
- Falha de gravação restaura as metas anteriores e mantém o formulário aberto.
- Simulação preserva salário zero e mostra o sinal negativo dos saldos.
- Copiar um mês sem salário inicia a simulação com zero.
- Simulação só confirma sucesso quando a gravação termina com sucesso.

Validação: 35 testes automatizados aprovados, sem acessar o Supabase.
Conferência visual no navegador ainda pendente: zerar uma meta, simular déficit
e conferir os avisos de falha de gravação antes de iniciar a próxima etapa.

Próximas entregas: persistência confiável, restauração de backup, seleção de ano
e consistência de datas/valores; depois orçamentos, recorrências e parcelas.

## 3. Persistência confiável — proteção dos lançamentos implementada localmente

Criar, editar, excluir lançamentos e quitar faturas agora usam a mesma proteção
contra falhas das pendências. Se a gravação falhar, os dados em memória são
restaurados e o formulário permanece aberto. A quitação só confirma sucesso
após salvar. Cliques repetidos durante a mesma operação não duplicam o lançamento.

Validação: 46 testes automatizados aprovados, incluindo criação, edição,
exclusão e quitação com falha de gravação, tentativa repetida durante o envio
e quitação bem-sucedida. Os testes não acessam o Supabase.

Conferência manual pendente: criar e editar um lançamento; colocar o navegador
em modo offline e tentar salvar, excluir e quitar; conferir que o formulário
permanece aberto e os valores anteriores são preservados; voltar online e tentar
novamente. Recarregar a página para conferir os dados persistidos.

Controle de conflitos implementado localmente; validação no banco real pendente.

Uniformizar falhas de salvamento e mensagens de sucesso. Adicionar controle de
versão para impedir sobrescrita por outra aba/dispositivo. Validar conflitos e
recarregamento, incluindo rollback de operações compostas.

Conflitos entre abas/dispositivos — implementado localmente em 10/11/2026:
- Leitura de updated_at junto aos dados financeiros e à simulação.
- Atualização condicional por usuário e versão, em uma única operação no banco.
- Sem correspondência: bloquear gravação e orientar recarregamento da página.
- Primeiro salvamento usa inserção simples; conflito de usuário não sobrescreve dados.
- Registros antigos com updated_at nulo são tratados sem migração.
- Operações simultâneas na mesma aba não enviam gravações concorrentes da mesma tabela.

Validação: 49 testes automatizados aprovados, sem acessar o Supabase.
Conferência manual pendente: abrir duas abas com a mesma versão; salvar na
primeira; tentar salvar na segunda e conferir o aviso; recarregar a segunda
e confirmar que os dados da primeira foram preservados. Repetir na simulação.

Limites: não há mesclagem automática. Copie alterações não salvas antes de
recarregar, especialmente na simulação. A proteção depende do retorno das linhas
atualizadas e de todas as versões do aplicativo atualizarem updated_at; abas
com código antigo devem ser recarregadas. Nenhuma política ou trigger do banco
foi inspecionada nesta entrega; o teste com o Supabase real continua pendente.


## 4. Restauração e formato dos dados

Validar o JSON inteiro, mostrar prévia de anos e quantidades, conferir o usuário,
baixar backup anterior à troca e pedir confirmação antes da restauração.
Adicionar migrações versionadas sem apagar registros incompatíveis.

## 5. Consistência financeira

Padronizar centavos, validar competência/data, reconciliar saldo anterior e anual,
corrigir zeros em metas/simulação e acrescentar seleção de ano.

## 6. Conciliação, caixa e planejamento

Conferência com extratos, importação com detecção de duplicatas, contas/cartões,
vencimentos, competência versus caixa e projeção de saldo. Depois: orçamentos,
recorrências e parcelas. Cada grupo deve ser uma entrega própria.
## Funcionalidades para uso pessoal — prioridade definida em 10/11/2026

A pedido do usuário, seguir para as funcionalidades sugeridas antes da
restauração de backup. Entregar cada grupo separadamente, mantendo a arquitetura.

1. Orçamentos por categoria — implementado localmente: limites por mês/ano,
   consumo de saídas pagas e pendentes, restante/excedido, alertas em 80%, 100%
   e acima de 100%; edição e remoção sem alterar lançamentos. Dados em centavos
   dentro do documento financeiro, sem migração do banco. Categorias padrão,
   personalizadas e históricas. Proteção de falhas e conflitos existente.
   Validação: 54 testes aprovados. Revisão visual e salvamento real pendentes.
   Conferência manual: cadastrar limite, editar, trocar mês, voltar ao mês,
   conferir consumo com lançamentos conhecidos e remover somente o limite.
2. Recorrências e parcelas.
3. Agenda financeira.
4. Caixa projetado.
5. Acertos de casa.
6. Vínculo casa/transações.
7. Atalhos de pendências nos lançamentos.
8. Lixeira e auditoria.
9. Cadastros personalizados unificados.

### Complemento dos orçamentos: padrão e cópia

Implementado: padrão por categoria para todos os meses/anos sem exceção,
edição específica do mês, retorno ao padrão e remoção somente naquele mês.
Limites mensais anteriores continuam como exceções. Alterar o padrão também
altera a referência de meses anteriores sem ajuste, com aviso de confirmação.
Copiar mês anterior usa limites efetivos, substitui categorias correspondentes
e preserva as demais, incluindo a virada do ano quando o ano anterior existe.
Sem cópia de lançamentos. Padrões e exceções entram no backup JSON existente.
Validação: 60 testes aprovados; conferência visual e no Supabase pendentes.

### Recorrências e parcelas — implementadas localmente

Entrega de 10/11/2026: geração finita de 2 a 120 saídas mensais pendentes,
prévia e confirmação; parcelas com divisão exata de centavos; recorrências
com valor mensal; IDs e numeração de série nos lançamentos. Vencimentos ajustam
o último dia em meses curtos. Anos necessários são criados preservando os dados
antigos, com seletor de ano na barra lateral e identificação do ano ativo.
Edição individual ou desta e das próximas pendentes, mantendo posteriores pagas.
Vínculos com pendências bloqueiam alterações em grupo. Quantidade não é alterada;
novo valor na edição aplica-se a cada ocorrência e pode alterar o total parcelado.
Exclusão é individual. Não há geração infinita, cobrança automática ou transporte
automático de saldos anteriores. Os dados entram no backup JSON existente.

Validação: 70 testes automatizados aprovados. Conferência visual e persistência
real ainda pendentes. Procedimento manual: gerar R$ 100 em três parcelas a partir
de 31/12; conferir R$ 33,34 + R$ 33,33 + R$ 33,33 e datas de janeiro/fevereiro;
alternar ano; editar apenas uma; quitar uma futura e editar as próximas a partir
da anterior, confirmando que a paga permaneceu igual. Em modo offline, tentar
gerar uma série e conferir que nenhum registro/ano novo fica após a falha.
Próxima funcionalidade: agenda financeira.

### Agenda financeira — implementada localmente em 10/11/2026

Tela em Planejamento: contas, faturas e devoluções pendentes de todos os anos;
resumos, filtros combináveis de período/tipo e baixas sem duplicação de saídas.
Faturas agrupadas por cartão/competência, com dia de vencimento configurável,
ajustado em meses curtos. Sem cálculo de fechamento ou inferência de ciclo.
Contas usam vencimento opcional ou data do lançamento; devoluções usam data
prevista e saldo restante. Baixas usam a proteção de persistência existente.
Corrigidos IDs repetidos nos formulários de séries e recebimentos.

Validação: 81 testes automatizados aprovados; revisão visual e persistência no
Supabase pendentes. Conferência manual: configurar cartão e conferir fatura;
filtrar vencidos/sem data; baixar uma conta e conferir o mesmo lançamento;
registrar recebimento parcial e conferir saldo restante; tentar baixar offline
e conferir preservação dos dados. Próxima funcionalidade: caixa projetado.

### Caixa projetado — implementado localmente em 10/11/2026

Saldo disponível conferido, projeção de 30/60/90/180 dias, gráfico, detalhes por
dia, saldo final/mínimo e primeiro saldo negativo. Contas/faturas reaproveitam
a agenda sem duplicar compras. Entradas/resgates/aportes pendentes usam datas;
devoluções previstas são opcionais e desmarcadas inicialmente. Vencidos são
considerados hoje como hipótese; itens sem vencimento ficam fora e destacados.
O saldo conferido não soma investimentos/metas/saldos anteriores mensais.

Registros concluídos desde a conferência ajustam o saldo disponível pela diferença
líquida; isso mantém a projeção consistente após quitar faturas ou receber
parcialmente uma devolução. Correções/exclusões antigas também afetam esse
ajuste e exigem nova conferência do saldo real. Nova conferência mantém a anterior
no histórico do documento, incluído no backup. Não há novo serviço ou esquema.

Validação: 92 testes automatizados aprovados, sem acessar Supabase. Revisão
visual e persistência real pendentes. Conferência manual: informar saldo real;
criar entrada pendente e conta futura; conferir saldo final e dias; quitar a
conta na agenda e verificar a redução do disponível sem perder seu custo no
saldo final; registrar recebimento parcial; alternar a inclusão de devoluções;
testar conferência de saldo offline e confirmar que o saldo anterior é mantido.
Próxima funcionalidade: acertos de casa.
