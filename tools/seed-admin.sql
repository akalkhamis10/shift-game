-- Add the owner. Replace the email with the address you'll sign in with.
insert into admins (email, role)
values ('REPLACE_ME@example.com', 'owner')
on conflict (email) do update set role = excluded.role;
