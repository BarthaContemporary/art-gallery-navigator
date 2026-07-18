-- New document category "Import Documents" for inventory piece documents.
-- Not an invoice type, so it stays visible to all staff under the existing RLS.
alter type public.doc_type add value if not exists 'import_document';

notify pgrst, 'reload schema';
