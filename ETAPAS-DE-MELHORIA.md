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

## 2. Autenticação e autorização — próxima etapa

Antes de mudar o login, inspecionar as definições e políticas das tabelas `users`,
`financial_data` e `simulation_data`, sem compartilhar senhas ou chaves privadas.
Confirmar como vincular os logins existentes às contas autenticadas.

Preparar scripts de migração e reversão e um procedimento de teste. Implementar
sessão validada pelo servidor, isolamento por usuário e administração autorizada
no backend. Não desativar o acesso antigo até validar o novo caminho e a
preservação dos dados. Uma mudança somente no HTML não resolve a autorização.

Critérios: login/logout, renovação/expiração, recuperação de acesso, usuário comum
sem acesso aos dados de outro usuário e sem poderes de administrador; dados
antigos visíveis na conta correta. Testar com duas contas de teste.

## 3. Persistência confiável

Uniformizar falhas de salvamento e mensagens de sucesso. Adicionar controle de
versão para impedir sobrescrita por outra aba/dispositivo. Validar conflitos e
recarregamento, incluindo rollback de operações compostas.

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
