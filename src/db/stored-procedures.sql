create or replace function validate_user_session(p_username text, p_session_token text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from users u
    inner join tokengenerate t on u.token = t.token
    where u.username = p_username
    and u.session_token = p_session_token
    and t.status not in ('Invalid', 'N/A')
    and (t.expiresat is null or t.expiresat > now())
  );
end;
$$;