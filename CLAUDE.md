# Project notes for Claude

Gallery management system for Joost van den Bergh (UK dealer, Japanese/Indian art):
a Next.js 15 studio app + public website on a self-hosted Supabase backend.

## Standing rules

- **Label PDFs**: whenever asked to produce mailing/label PDFs, first ask which
  **Avery number** to target (e.g. L7160/L7162/L7163), then generate the PDF to
  that exact label layout and optimise the sheet (margins, pitch, per-label size).
- **Applying DB migrations to the live server**: after running any migration via
  the postgres-meta `/pg/query` endpoint, the change is invisible to the REST API
  until the schema cache reloads. Every migration must end with
  `notify pgrst, 'reload schema';` (or run it separately), or new
  tables/columns/functions return 404/500.
- Autosave forms PATCH `new FormData(formRef)` to an API route on input/change;
  new hidden fields must be parsed on the server route AND the `savePiece` action.

## Money / VAT

Purchase £ is entered by hand; only the sale £ auto-converts from the spot rate
on the sale date. VAT-due display: margin scheme = 1/6 of (sale − total cost);
standard = 1/6 of sale; zero-rated / outside-scope = 0. Net = sale − VAT.
