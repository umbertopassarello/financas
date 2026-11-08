# Análise do controle financeiro

Revisão do código local em 08/11/2026: autenticação, persistência, navegação,
lançamentos, gráficos, casa, investimentos, pendências, calendário, metas,
simulação, resumo anual e administração. Não foram inspecionados as políticas,
o esquema ou os dados do Supabase. Não houve validação visual em navegador.

## Prioridade 1: acesso e preservação dos dados

1. **Autenticação e autorização.** `js/auth.js` envia login e senha na URL de uma
   consulta a `users` e guarda o registro retornado em `localStorage`.
   `js/pages/admin.js` grava o campo `pass` diretamente. O frontend trata a senha
   como campo comum, e a sessão e o papel de administrador podem ser alterados
   no navegador. Migrar para sessões validadas pelo servidor e verificar políticas
   de isolamento por usuário no banco. Não é possível concluir pelo repositório
   quais proteções existem no Supabase. A chave pública do cliente não substitui
   autorização no servidor.
2. **Conflitos de gravação.** `js/data.js` salva todo o documento financeiro em
   JSON: duas abas podem carregar uma versão e a última gravação sobrescrever
   alterações da outra. Adicionar versão esperada, detecção de conflito e,
   posteriormente, registros separados para transações e pendências.
3. **Backup e restauração.** Exportar JSON com versão do formato e CSV de
   lançamentos. Importar com validação, prévia e backup antes da restauração.
4. **Falhas de salvamento.** Casa, pendências, saldo manual e exclusão em lote
   desfazem a alteração local quando a gravação falha. Fluxos antigos de
   lançamentos, metas e simulação ainda podem mostrar alteração ou sucesso apesar
   de falha. Uniformizar o comportamento e indicar alterações não salvas.
5. **Conteúdo nas telas.** Há interpolação direta de textos em HTML em trechos de
   lançamentos, dashboard, metas, administração e simulação. Usar `textContent`
   ou escape consistente e remover eventos construídos com dados do usuário.

## Prioridade 2: consistência dos valores

1. **Conciliação por conta e cartão.** Saldo inicial conferido, comparação com
   extrato e diferença visível. Importação CSV/OFX com detecção de duplicatas
   ajuda a evitar novos saldos de investimentos divergentes.
2. **Competência e caixa.** Hoje os totais incluem gastos pagos e pendentes.
   Acrescentar visão de caixa por data efetiva de pagamento/recebimento, mantendo
   a visão de gastos do mês. Cadastrar fechamento e vencimento por cartão.
3. **Datas e mês ativo.** O modal pode salvar uma data de outro mês dentro do mês
   selecionado. O calendário exclui a data incompatível com aviso, mas o saldo
   do mês conta o registro. Oferecer mover para o mês correto ou confirmar uma
   competência distinta de forma explícita.
4. **Centavos e rateio.** Padronizar valores em centavos inteiros e definir quem
   recebe o centavo restante. Três parcelas de R$ 33,33 não fecham R$ 100.
5. **Saldo anterior e ano.** O saldo anterior de cada mês é independente, enquanto
   o acumulado anual começa em zero. Criar reconciliação entre os dois cálculos
   e registro dos ajustes. Oferecer seleção de ano: os dados já suportam anos,
   mas a navegação ainda oferece apenas meses.
6. **Formato dos dados.** Versionar o documento e validar meses, listas e valores,
   além da presença de `months`. Migrar formatos antigos sem apagar informações.

## Funcionalidades sugeridas

- **Orçamentos por categoria:** limite mensal, consumido, restante e alertas.
- **Recorrências e parcelas:** gerar próximos vencimentos com vínculo à compra
  original, editando uma ocorrência ou as futuras.
- **Agenda financeira:** contas, faturas e devoluções previstas, com vencidos.
- **Caixa projetado:** saldos conferidos mais entradas e compromissos futuros.
- **Acertos de casa:** participantes nomeados, partes diferentes, múltiplos
  pagadores e transferências de acerto. O modelo atual assume que você participa
  de cada item e permite um pagador por despesa.
- **Vínculo casa/transações:** relacionar um pagamento a um lançamento existente
  para evitar digitação dupla. Contas de casa hoje são um controle independente.
- **Atalhos de pendências na transação:** cadastrar devolução ou resgate a repor
  sem sair da listagem.
- **Lixeira e auditoria:** recuperar exclusões e consultar mudanças.
- **Cadastros personalizados:** unificar categorias/cartões usados em todos os
  modais, filtros, simulações e gráficos; ainda há listas fixas em algumas telas.

## Ajustes pontuais encontrados

- `js/pages/simulacao.js`: defaults com `||` podem trocar salário zero por
  R$ 2.800; resultados usam valor absoluto e dependem da cor para mostrar déficit.
  A mensagem de sucesso não verifica o resultado do salvamento.
- `js/pages/metas.js`: `valor || m.atual` impede zerar uma meta. Aportes são
  independentes das transações, exigindo cuidado com dupla digitação.
- `js/pages/anual.js`: meses com apenas investimentos/resgates podem mostrar
  travessão no saldo, pois a condição verifica apenas entradas e gastos.
- O dashboard também escondia o sinal negativo do saldo com valor absoluto;
  isso foi corrigido nesta rodada.
- Os dados iniciais contêm lançamentos e metas pessoais fixos. Novos usuários
  deveriam começar vazios ou escolher explicitamente dados de exemplo.

## Implementado nesta rodada

Ordenação crescente/decrescente; seleção e exclusão em lote com proteção de
vínculos; edição/cópia de contas de casa; pagador e pagamentos parciais; saldo
devedor/crédito no rateio; alternância entre barras e pizza com preferência salva;
valores no gráfico mensal por mouse, foco ou toque; sinal do saldo no dashboard.

## Próximas etapas sugeridas

Autenticação e políticas → backup → gravação com detecção de conflitos →
conciliação → competência e caixa → orçamentos e recorrências. Fortalecer os
dados primeiro permite confiar nas projeções.
