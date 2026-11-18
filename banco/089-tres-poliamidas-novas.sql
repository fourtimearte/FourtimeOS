-- ===========================================================================
-- 089: TRES POLIAMIDAS NOVAS (17/11/2026)
--
-- O Henrique pediu, para o editor V4 e o Fourtime OS ao mesmo tempo:
-- "NOVO TECIDO POLIAMIDA PARA ACRESCENTAR ... Poliamida speed, Poliamida
-- furadinha com elastano light, Poliamida furadinha com elastano plus", e
-- "AS EDICOES EM TECIDO QUE VAMOS FAZER SERAO IGUAIS EM AMBOS, ENTAO NAO PODE
-- FICAR DIFERENTE".
--
-- O nome segue o do Fourtime OS, com o "C/" que ele definiu como certo na
-- 088 ("O DO FOURTIME OS E O CERTO ... PODE SEGUIR NOS 2"). O editor V4
-- 3.383 traz os mesmos tres nomes, letra por letra:
--
--   POLIAMIDA SPEED
--   POLIAMIDA FURADINHA C/ ELASTANO LIGHT
--   POLIAMIDA FURADINHA C/ ELASTANO PLUS
--
-- Os tres entram no tipo POL (Poliamida), no fim da ordem, ativos. A ficha
-- do tecido (composicao e cuidados, da 087) nasce vazia: quem sabe a
-- composicao preenche no Estoque. Nenhuma cor de tecido e criada: as cores
-- entram pelo Estoque, como em qualquer tecido.
--
-- Roda quantas vezes quiser: tecido que ja existe (pelo nome, sem ligar
-- para maiusculas) nao e criado de novo nem alterado.
-- ===========================================================================

do $$
declare
  novos text[] := array['POLIAMIDA SPEED',
                        'POLIAMIDA FURADINHA C/ ELASTANO LIGHT',
                        'POLIAMIDA FURADINHA C/ ELASTANO PLUS'];
  nome_novo text;
  proxima int;
begin
  if not exists (select 1 from public.grupo_de_tecido where cod = 'POL') then
    raise exception 'O tipo POL (Poliamida) nao existe: confira a 009 antes da 089.';
  end if;
  select coalesce(max(ordem), 0) into proxima from public.tecido;
  foreach nome_novo in array novos loop
    if not exists (select 1 from public.tecido where upper(btrim(nome)) = upper(nome_novo)) then
      proxima := proxima + 1;
      insert into public.tecido (nome, grupo, ordem, ativo) values (nome_novo, 'POL', proxima, true);
    end if;
  end loop;
end $$;

-- o relatorio: os tecidos do tipo POL depois da 089
select nome, grupo, ordem, ativo,
       case when nome in ('POLIAMIDA SPEED', 'POLIAMIDA FURADINHA C/ ELASTANO LIGHT',
                          'POLIAMIDA FURADINHA C/ ELASTANO PLUS') then 'NOVO (089)' else '' end as "089"
  from public.tecido
 where grupo = 'POL'
 order by nome;
