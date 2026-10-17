-- ===========================================================================
-- O RETRATO DO BANCO (17/10/2026). SÓ LÊ: não cria, não muda, não apaga nada.
--
-- Devolve UMA linha com UM json: cada tabela e view do schema public com as
-- colunas, as chaves, os índices, os gatilhos, as regras de acesso (RLS) e
-- os grants; cada função com os argumentos, quem pode chamar e o texto; os
-- enums, as regras do Storage, os grants que o Supabase põe sozinho em
-- objeto novo (default privileges), os gatilhos de evento e o tamanho de
-- cada tabela.
--
-- Roda igual no ensaio (testes/banco.mjs) e no SQL Editor da produção. É
-- assim que os dois se comparam: o mesmo retrato dos dois lados.
-- ===========================================================================
select json_build_object(
 'tirado_em', now(),
 'versao_do_postgres', current_setting('server_version'),
 'tabelas', (select json_agg(json_build_object(
    'nome', c.relname,
    'tipo', c.relkind,
    'rls', c.relrowsecurity,
    'forca_rls', c.relforcerowsecurity,
    'comentario', obj_description(c.oid, 'pg_class'),
    'opcoes', c.reloptions,
    'linhas', case when c.relkind in ('r','p') then (select n_live_tup from pg_stat_user_tables s where s.relid = c.oid) end,
    'bytes', case when c.relkind in ('r','p') then pg_total_relation_size(c.oid) end,
    'colunas', (select json_agg(json_build_object(
        'nome', a.attname,
        'tipo', format_type(a.atttypid, a.atttypmod),
        'nulo', not a.attnotnull,
        'padrao', pg_get_expr(d.adbin, d.adrelid),
        'gerada', nullif(a.attgenerated, ''),
        'comentario', col_description(c.oid, a.attnum)) order by a.attnum)
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
    'restricoes', (select json_agg(json_build_object(
        'nome', k.conname,
        'tipo', k.contype,
        'def', pg_get_constraintdef(k.oid),
        'colunas', (select json_agg(att.attname order by o.i)
                      from unnest(k.conkey) with ordinality o(n, i)
                      join pg_attribute att on att.attrelid = k.conrelid and att.attnum = o.n),
        'alvo', case when k.contype = 'f' then k.confrelid::regclass::text end,
        'ao_apagar', case when k.contype = 'f' then k.confdeltype end) order by k.conname)
       from pg_constraint k where k.conrelid = c.oid),
    'indices', (select json_agg(json_build_object(
        'nome', i.relname,
        'def', pg_get_indexdef(x.indexrelid),
        'unico', x.indisunique,
        'primaria', x.indisprimary,
        'parcial', x.indpred is not null,
        'colunas', (select json_agg(case when o.n = 0 then null else att.attname end order by o.i)
                      from unnest(x.indkey::int2[]) with ordinality o(n, i)
                      left join pg_attribute att on att.attrelid = x.indrelid and att.attnum = o.n),
        'varreduras', (select idx_scan from pg_stat_user_indexes s where s.indexrelid = x.indexrelid),
        'bytes', pg_relation_size(x.indexrelid)) order by i.relname)
       from pg_index x join pg_class i on i.oid = x.indexrelid where x.indrelid = c.oid),
    'gatilhos', (select json_agg(json_build_object(
        'nome', t.tgname,
        'def', pg_get_triggerdef(t.oid),
        'funcao', t.tgfoid::regproc::text,
        'ligado', t.tgenabled <> 'D') order by t.tgname)
       from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal),
    'politicas', (select json_agg(json_build_object(
        'nome', p.polname,
        'cmd', p.polcmd,
        'permissiva', p.polpermissive,
        'papeis', (select json_agg(coalesce(r.rolname, 'public')) from unnest(p.polroles) pr left join pg_roles r on r.oid = pr),
        'usando', pg_get_expr(p.polqual, p.polrelid),
        'checando', pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname)
       from pg_policy p where p.polrelid = c.oid),
    'grants', (select json_agg(json_build_object('papel', g.grantee, 'priv', g.privilege_type) order by g.grantee, g.privilege_type)
       from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = c.relname
        and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')),
    'definicao', case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) end
   ) order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')),
 'funcoes', (select json_agg(json_build_object(
    'nome', p.proname,
    'args', pg_get_function_identity_arguments(p.oid),
    'entradas', case when p.proargnames is not null then
                  (select json_agg(x.n order by x.i)
                     from unnest(p.proargnames, coalesce(p.proargmodes, array_fill('i'::"char", array[cardinality(p.proargnames)]))) with ordinality x(n, m, i)
                    where x.m in ('i', 'b', 'v')) end,
    'com_padrao', p.pronargdefaults,
    'retorna', pg_get_function_result(p.oid),
    'definer', p.prosecdef,
    'config', p.proconfig,
    'lingua', l.lanname,
    'volatil', p.provolatile,
    'comentario', obj_description(p.oid, 'pg_proc'),
    'fonte', p.prosrc,
    'exec_anon', has_function_privilege('anon', p.oid, 'execute'),
    'exec_auth', has_function_privilege('authenticated', p.oid, 'execute'),
    'exec_public', coalesce((select bool_or(a.grantee = 0) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.privilege_type = 'EXECUTE'), false)
   ) order by p.proname, pg_get_function_identity_arguments(p.oid))
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   join pg_language l on l.oid = p.prolang
  where n.nspname = 'public' and p.prokind = 'f'),
 'enums', (select json_agg(json_build_object('nome', t.typname,
    'valores', (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
   from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype = 'e'),
 'sequencias', (select json_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'S'),
 'storage_baldes', (select json_agg(json_build_object('id', b.id, 'publico', b.public, 'limite', b.file_size_limit, 'tipos', b.allowed_mime_types) order by b.id) from storage.buckets b),
 'storage_politicas', (select json_agg(json_build_object('nome', policyname, 'cmd', cmd, 'papeis', roles, 'usando', qual, 'checando', with_check) order by policyname)
   from pg_policies where schemaname = 'storage' and tablename = 'objects'),
 'privilegios_padrao', (select json_agg(json_build_object('dono', d.defaclrole::regrole::text, 'schema', d.defaclnamespace::regnamespace::text, 'objeto', d.defaclobjtype, 'acl', d.defaclacl::text[]))
   from pg_default_acl d),
 'gatilhos_de_evento', (select json_agg(json_build_object('nome', e.evtname, 'evento', e.evtevent, 'funcao', e.evtfoid::regproc::text, 'ligado', e.evtenabled <> 'D')) from pg_event_trigger e),
 'extensoes', (select json_agg(json_build_object('nome', x.extname, 'versao', x.extversion, 'schema', x.extnamespace::regnamespace::text) order by x.extname) from pg_extension x),
 'schema_public_anon', has_schema_privilege('anon', 'public', 'USAGE'),
 'tamanho_do_banco', pg_database_size(current_database())
) as retrato;
