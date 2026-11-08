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
