-- ---------------------------------------------------------------------------
-- Every document attached to a work must have its document_pieces link.
--
-- piece_documents.piece_id became "optional / legacy" in 20260713000028 when
-- documents went many-to-many, and document_pieces took over as the source of
-- truth. Every reader followed: the work edit page, the work detail page and
-- the Documents registry all list documents *through* the link table.
--
-- The writers did not all follow. The FileMaker import and the Quick Capture
-- invoice attach both insert piece_documents rows with a piece_id and no link,
-- so their documents exist, hold their file, and are invisible on the work.
-- The upload panel did write the link, but as a separate unchecked call that
-- could fail on its own and lose the attachment the same way.
--
-- Rather than ask three writers to remember, the database keeps the invariant.
-- ---------------------------------------------------------------------------

create or replace function public.link_document_to_piece()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A document filed against a work is linked to it, always. Documents that
  -- span several works arrive with piece_id null and are linked explicitly.
  if new.piece_id is not null then
    insert into public.document_pieces (document_id, piece_id)
    values (new.id, new.piece_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piece_documents_link on public.piece_documents;
create trigger trg_piece_documents_link
  after insert on public.piece_documents
  for each row execute function public.link_document_to_piece();

-- Repair what the missing invariant already cost. 20260713000028 ran this same
-- backfill on 13 July; the FileMaker import landed on 23 July, after it, so
-- every document imported with a work has been invisible ever since.
insert into public.document_pieces (document_id, piece_id)
select d.id, d.piece_id
  from public.piece_documents d
 where d.piece_id is not null
   and not exists (
     select 1 from public.document_pieces dp
      where dp.document_id = d.id and dp.piece_id = d.piece_id
   )
on conflict do nothing;

notify pgrst, 'reload schema';
