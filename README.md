# Dashboard Financeiro

Abra `index.html` no navegador para acessar a aplicação. Não há etapa de build.
O carregamento das fontes e a comunicação com o Supabase dependem de internet.

## Organização

- `index.html`: estrutura das telas e dos modais.
- `css/styles.css`: estilos, temas e regras de responsividade.
- `js/config.js`: configuração do Supabase, constantes e funções de formatação.
- `js/state.js`: estado compartilhado da aplicação.
- `js/app.js`: inicialização e indicador de sincronização.
- `js/auth.js`: login e logout.
- `js/data.js`: carregamento, salvamento e dados iniciais.
- `js/navigation.js`: navegação, seleção de mês, tema e menu lateral.
- `js/transactions.js`: pagamentos, compatibilidade dos registros antigos, filtros e totais.
- `js/planning.js`: calendário, pendências e baixas vinculadas aos lançamentos.
- `js/backup.js`: backup JSON e exportação CSV, sem gravar no servidor.
- `js/household.js`: cálculo do rateio e cópia de despesas da casa.
- `js/charts.js`: gráficos de categorias e evolução mensal.
- `js/pages/`: lógica de cada tela, em arquivos separados.
- `js/modals.js`: abertura, fechamento e eventos comuns dos modais.

Os scripts são carregados na ordem declarada ao final do HTML e compartilham
o escopo global, utilizado também pelos eventos definidos nos elementos HTML.
Ao adicionar arquivos, mantenha as dependências antes dos scripts que as utilizam.

## Lançamentos

O resumo do mês considera todos os lançamentos do mês ativo e o saldo anterior.
O resumo filtrado considera apenas os resultados visíveis, sem saldo anterior.
Os gastos incluem pagamentos pendentes e pagos; os valores de cada status aparecem
abaixo do resumo filtrado. O status não altera o valor lançado no mês.

Os filtros aceitam várias opções: opções de uma lista se somam, e listas diferentes
se combinam. Por exemplo, Nubank e Inter com status Pendente mostra os pendentes
dos dois cartões. Uma lista sem seleção aceita todas as opções.

Novos lançamentos guardam `formaPagamento`, `cartao` e `status` separadamente.
Quitar uma fatura preserva o cartão e altera apenas o status dos gastos pendentes
no crédito. Registros antigos com `banco` diferente de `pago` são interpretados como
crédito pendente. Quando o registro antigo contém apenas `banco: 'pago'`, a forma
original é desconhecida e pode ser preenchida ao editar o lançamento.

## Testes locais

Com Node.js instalado, execute:

```sh
node --test tests/*.test.cjs
```

Esses testes usam dados simulados e não acessam o Supabase.

## Saldo mensal, devoluções e investimentos

O cartão **Saldo mensal** mostra entradas menos gastos, sem saldo anterior.
O **Saldo atual** mantém o cálculo acumulado, incluindo saldo anterior, aportes
e resgates. A legenda de cada cartão explica a diferença.

Em **Devoluções a receber**, cadastre compras feitas para terceiros ou empréstimos.
Você pode vincular uma saída existente do ano selecionado; o cadastro da pendência
não duplica o gasto. Registros manuais também não criam saídas: registre o gasto
original em Lançamentos. A aba reúne pendências de todos os anos.

Registre recebimentos parciais ou totais na própria pendência. Cada recebimento
cria uma entrada na data informada, em um ano já cadastrado. Evite lançar a mesma
entrada manualmente. No histórico da pendência, **Estornar** remove a entrada
gerada e reabre o valor correspondente. Lançamentos gerados são corrigidos por
esse histórico para manter os valores sincronizados.

O **Calendário de gastos** usa as datas das saídas do mês e ano selecionados,
incluindo gastos pagos e pendentes. Clique em um dia para ver os detalhes.
Saídas sem data ou com data de outro mês ficam fora do calendário, com aviso.

O saldo de investimentos agora é **manual**. Aportes, resgates, metas e reposições
não o alteram automaticamente. Em **Conferir saldo**, informe o valor real da
carteira ou 0 para recomeçar; o valor anterior fica no histórico de conferências.
O histórico de transações é preservado. Os totais anuais de aportes e resgates
continuam dependendo da qualidade dos lançamentos antigos.

Em **Resgates a repor**, vincule um resgate existente ou cadastre uma pendência
manual. Cada reposição parcial ou total cria um lançamento de investimentos na
data informada, sem alterar o saldo manual. As pendências não são criadas
automaticamente a partir de resgates antigos e não mudam com a seleção do mês.

## Orçamentos por categoria

Em **Planejamento → Orçamentos**, escolha a categoria e salve um limite para o
mês ativo. Salvar novamente a mesma categoria substitui seu limite. Editar
preenche o formulário; remover exclui somente o limite, preservando os gastos.

O consumo inclui saídas pagas e pendentes do mês/ano selecionado. Não depende
dos filtros de Lançamentos. Os cálculos somam centavos por lançamento e mostram
consumo, restante ou excedido, com alertas a partir de 80%, no limite e acima dele.
Limite zero significa que nenhum gasto está previsto naquela categoria.

No formulário, escolha **Padrão para todos os meses** para definir um limite base
por categoria ou **Somente neste mês** para criar uma exceção. O padrão vale
para todos os meses e anos sem ajuste próprio, inclusive meses anteriores.
Limites mensais já cadastrados são preservados. **Voltar ao padrão** remove
a exceção; **Remover deste mês** desativa o limite apenas naquele mês.

**Copiar limites do mês anterior** copia os limites efetivos, incluindo padrões,
como ajustes do mês ativo. Substitui as mesmas categorias e mantém as demais.
Janeiro usa dezembro do ano anterior, quando cadastrado. Categorias
personalizadas e categorias já usadas nos dados também aparecem na seleção.
Os limites ficam no documento financeiro existente e entram no backup JSON.

## Recorrências e parcelas

Em **Lançamentos → Recorrências e parcelas**, escolha a modalidade:

- **Recorrência mensal:** informe o valor de cada mês e a quantidade de ocorrências.
- **Compra parcelada:** informe o total da compra e a quantidade de parcelas.
  Os centavos restantes são distribuídos nas primeiras parcelas, preservando o total.

Informe o primeiro vencimento, categoria e forma de pagamento. Confira a prévia
antes de gerar. Cada série contém de 2 a 120 saídas mensais pendentes, vinculadas
pelo identificador da série e identificadas por sua posição na listagem. Não há
cobrança automática nem geração indefinida: toda a série é criada de uma vez.
Dias inexistentes usam o último dia do mês, retomando o dia original depois.

Meses e anos necessários são criados no documento financeiro. O seletor de ano
fica acima dos meses na barra lateral. Ao atravessar o ano com dados antigos na
raiz, meses e contas de casa são preservados no ano original; metas, investimentos,
pendências e cadastros continuam no mesmo documento. Os saldos anteriores de
meses novos começam em zero, sem projeção ou transferência automática de saldo.

Ao editar uma ocorrência gerada, escolha **Somente esta ocorrência** ou **Esta e
as próximas pendentes**. O valor editado passa a ser o de cada ocorrência
alcançada; editar parcelas pode mudar o total da compra. A quantidade e a
numeração permanecem iguais. A nova data define o dia dos próximos vencimentos.
Ocorrências posteriores pagas são preservadas. Vínculos com pendências impedem
edição em grupo: corrija essas ocorrências individualmente pela tela apropriada.
Excluir um lançamento remove apenas aquela ocorrência; não cancela a série.

As saídas geradas entram nos totais, calendário e orçamentos do respectivo mês.
O vínculo completo fica no backup JSON. Os testes não acessam o Supabase.

## Agenda financeira

Em **Planejamento → Agenda financeira**, acompanhe contas, faturas e devoluções
pendentes de todos os anos. Filtre vencidos, hoje/próximos 7 dias, mês/ano ativo
ou itens sem vencimento, combinando com o tipo. Os cartões de resumo mostram
todas as pendências, sem aplicar os filtros.

- Contas: saídas pendentes fora do crédito. Usam **Vencimento da conta** (opcional)
  ou, quando vazio, a data do lançamento.
- Faturas: compras de crédito pendentes agrupadas por cartão/mês de competência,
  sem repetir as compras como contas individuais. Configure o dia em
  **Configurar vencimento dos cartões**. Sem configuração, ficam sem vencimento.
  O dia fica no mês de competência do registro, ajustado ao último dia quando
  necessário. Não há fechamento de cartão ou inferência de ciclo de compra.
  Alterar o dia atualiza também faturas antigas pendentes, com confirmação.
- Devoluções: data prevista e saldo ainda não recebido. Reposições de
  investimentos continuam na carteira e não entram como contas da agenda.

**Marcar pago hoje** atualiza status e data de pagamento dos registros existentes;
não cria outra saída. Uma fatura baixa somente suas compras pendentes.
**Registrar recebimento** usa o fluxo existente de recebimentos parciais/totais,
criando a entrada correspondente. **Ver lançamentos** abre o mês correto e,
para faturas, filtra o cartão/pendentes. **Editar previsão** abre a devolução.
Itens sem data válida não são classificados como vencidos. Concluídos saem da
agenda e permanecem no histórico original. Configurações entram no backup JSON.

## Caixa projetado

Em **Planejamento → Caixa projetado**, confira a soma disponível de suas contas
hoje, já considerando o que foi recebido e pago. Zero e saldos negativos são
permitidos. O saldo de investimentos, metas e saldos anteriores dos meses não
são somados a esse valor. A conferência é independente do mês/ano ativo.

Escolha 30, 60, 90 ou 180 dias. A tela mostra disponível estimado, entradas e
saídas previstas, saldo final, menor saldo e primeiro dia com saldo negativo.
O gráfico e os detalhes por dia usam todos os anos cadastrados. A projeção não
cria lançamentos nem modifica vencimentos; os cálculos são em centavos.

Contas e faturas seguem a agenda: compras no crédito aparecem apenas na fatura,
sem duplicação. Entradas, resgates e aportes pendentes entram pelas suas datas.
Para prever um salário, cadastre Entrada com status Pendente e a data esperada;
ao receber, altere o mesmo registro para Pago. Não cadastre outra entrada igual.
Devoluções previstas são opcionais e ficam desmarcadas inicialmente. Recebimentos
parciais usam apenas o saldo ainda pendente da devolução.

Vencidos são posicionados em hoje como hipótese, com aviso; itens sem data
válida ficam listados fora da projeção. Compromissos após o horizonte também
ficam fora. Saldos são ao fim do dia, sem prever a ordem dos pagamentos nele.
Faturas mantêm a regra de competência da agenda, sem cálculo de fechamento.

A conferência guarda o saldo real e o total líquido dos registros concluídos
naquele momento. Pagamentos e recebimentos registrados depois ajustam o
**Disponível estimado agora**, evitando que a baixa faça um compromisso sumir
do saldo final. Correções, exclusões ou estornos de registros antigos também
alteram esse ajuste; confira novamente o saldo depois dessas correções.
Cada nova conferência reinicia o ajuste e preserva a anterior no histórico de
dados. Conferências e histórico entram no backup JSON. Não há integração bancária.
