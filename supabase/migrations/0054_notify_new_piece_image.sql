-- 0054: wake the image worker immediately on new/re-queued images.
--
-- The worker LISTENs on 'new_piece_image' and expects a notify per pending
-- row, but that trigger was never created — so every image waited up to the
-- 60s poll interval. Fire the notify on insert, and on any update that puts a
-- row back to 'pending' (re-queue), so processing starts within ~a second.

create or replace function public.notify_new_piece_image()
returns trigger
language plpgsql
as $$
begin
  if new.processing_status = 'pending'
     and (tg_op = 'INSERT' or new.processing_status is distinct from old.processing_status) then
    perform pg_notify('new_piece_image', new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piece_images_notify on public.piece_images;
create trigger trg_piece_images_notify
  after insert or update of processing_status on public.piece_images
  for each row execute function public.notify_new_piece_image();

notify pgrst, 'reload schema';
