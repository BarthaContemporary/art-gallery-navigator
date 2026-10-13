# Studio smoke checklist

A short manual pass over the studio's working loops: eight inventory
workflows and three client (CRM) loops. Staff run it on a staging login after
each phase of the studio UI work, and before merging any change that touches
a page named below. It takes about 30 minutes. The automated guard rails
(form keys and typecheck, run in CI) catch renamed or dropped fields; this
list catches what they cannot: a save that never lands, a button that moved
out of reach, a PDF that no longer fits its sheet.

Routes are given rather than menu labels, because the navigation itself is
due to change.

## Before you start

- [ ] CI is green for the build under test, including `pnpm ui:guard`
      (form keys unchanged, or changed only where the change says so).
      Locally: `pnpm ui:guard`, then
      `(cd apps/studio && npx tsc --noEmit -p .)` and
      `(cd apps/web && npx tsc --noEmit -p .)`.
- [ ] Sign in to staging as an admin. Steps marked *(financial)* need the
      admin or accountant role; repeat step 5 once as a non-financial user to
      check the prices and costs stay hidden.
- [ ] Test data only. Use a record titled `SMOKE TEST <date>`, a static
      inventory list `Smoke test list`, and a staff test contact whose email
      address is your own. Never send an offer or newsletter to a real client
      and never press the newsletter's *Send to list* during a smoke run.
- [ ] Find out which Sanity dataset staging syncs to. If it is the live
      dataset, run steps 3 and 4 with the test record only and switch it off
      again straight away, or check only that the switch state is saved.

## Inventory workflows

### 1. Create a record

- [ ] `/inventory`: tap **New record**. The editor opens on a new JvdB stock
      number. (Holding the button for half a second turns it into
      *New non-JvdB record*; `/inventory/new` asks for the register outright.)
- [ ] Fill title, year, maker (pick one, and once add a new maker inline),
      category, origin, medium, status and location. Tick **Framed** and
      enter framed and unframed sizes; the inch and lb previews update.
- [ ] The status line goes from *Saving…* to *All changes saved*.
- [ ] Reload the page: every value is still there, including the unframed
      sizes and the framed tick. Untick **Framed**, reload: the unframed row
      is gone and stays gone.
- [ ] Press **Done**: the record page at `/inventory/<stock>` shows the same
      values.

Pass when nothing typed is lost across a reload or Done.

### 2. Images

- [ ] From the editor header thumbnail, open `/inventory/<stock>/images`.
- [ ] Add three photographs (one JPEG, one iPhone HEIC if you have one) by
      dragging and by *click to choose*; set the role (front, back, detail).
- [ ] Each tile shows a preview once processed; no tile stays on an error.
- [ ] Drag to reorder, rotate one image, type a caption and press **Save**,
      delete one image.
- [ ] Reload: order, rotation, caption and deletion have all held. The
      editor header and the record page show a front photograph, not the
      back.

### 3. Website switch

- [ ] In the editor header, click the website switch (tooltip *Not on the
      website, click to publish it*). The status line reports the save.
- [ ] Within a minute (10 at most, when the cron fallback has to drain it)
      the work appears on the staging website, with its square tile.
- [ ] Set **Website square** to *flat*, then *object*, then back to *auto*:
      each saves, and the website tile follows after the next sync.
- [ ] Switch it off again: the work leaves the website.

### 4. A list on the website

- [ ] `/inventory/lists`: create `Smoke test list`, add the test record and
      two published works using *Search works to add*.
- [ ] On the list page, switch **List on website** to yes. The count line
      reads *N works · M on the website*.
- [ ] **Put all N on the website** and **Take all M off the website** change
      the works' own switches; check one record afterwards.
- [ ] Switch **List on website** back to no (this deletes the list's website
      document) and leave the works as you found them.

### 5. Sale with VAT *(financial)*

- [ ] In the test record's financials, enter a purchase cost in £ by hand,
      a restoration cost, then a sold date, a sold price and currency.
- [ ] Sale in GBP: *Sold £* equals the price. Sale in EUR: *Sold £* fills
      from the spot rate on the sale date. The purchase £ never converts.
- [ ] Check the worked figures for each VAT treatment:
  - margin scheme: VAT due = 1/6 of (sale − total cost);
  - standard: VAT due = 1/6 of sale;
  - zero-rated or outside scope: VAT due = 0;
  - in every case net = sale − VAT.
- [ ] Reload: price, currency, date and treatment are kept.
- [ ] `/stock-book`: the sale appears in its period with the same VAT due.
- [ ] As a non-financial user, the record and editor show no cost, price or
      VAT figures, and `/stock-book` is not reachable.
- [ ] Clear the sale fields again so the test record is unsold.

### 6. Find

- [ ] `/inventory` search (*Search stock no., title, maker…*): find the test
      record by stock number, by a word of its title and by its maker.
- [ ] Combine a search with a status filter and a category filter; clear
      them one at a time.
- [ ] ⌘K (Ctrl+K on Windows) or `/` opens the palette; it finds the test
      record by stock number and the test contact by name, and Enter opens
      them.
- [ ] On a record page, ← and → step to the neighbouring records and the
      back link returns to the inventory.

### 7. Labels

- [ ] On `Smoke test list`, press **Work labels PDF**. It asks for the Avery
      sheet first (L7160, L7162 or L7163); choose one.
- [ ] The PDF holds 21, 16 or 14 labels a page respectively, with framed and
      unframed sizes on framed works. Print one page on plain paper and hold
      it against a label sheet: every label sits inside its cell.
- [ ] `/crm/lists/<id>`: **Labels PDF** for a contact list asks for the sheet
      in the same way and fits it.

### 8. Export

- [ ] `/inventory` with no filters: **Export CSV**, **Export DOCX** and
      **Export XLSX** each download (or save to Drive) and open without
      error; the row count equals the inventory count.
- [ ] With a status filter, the exports hold only that status.
- [ ] *(financial)* `/stock-book`: the CSV export opens in a spreadsheet and
      the totals add up.

- [ ] With a search, a list or the flagged filter on, and a sort chosen,
      each export holds exactly the works on screen, in the same order.
- [ ] *(financial)* A loss in the stock-book CSV is a number that a SUM
      includes, not text.

## CRM loops

### A. Offer send

- [ ] `/crm/contacts`: open the staff test contact. Change the phone number,
      tick and untick **Marketing consent**, edit the second address; the
      status line reports each save. Reload: all kept.
- [ ] `/offers`: create an offer, fill the details and **Save details**, add
      two works (search and *Add works from a list*), set a price override
      on one, reorder them.
- [ ] Add the test contact as the only recipient. **Send to 1**.
- [ ] The email arrives in your inbox; its link opens the private offer
      page on the staging website with the two works in order and the
      override price.
- [ ] Back on the offer, the recipient shows as sent.

If the mail service refuses a send, the studio says so; a send it reports
as made should arrive, so confirm it did.

### B. Newsletter test

- [ ] `/crm/campaigns`: create a newsletter, give it a subject and preview
      text, add a heading, a text block and an image block, reorder them.
- [ ] The designer's status line says *All changes saved*; reload and the
      design is unchanged.
- [ ] Enter your own address and press **Send test**. The test arrives and
      matches the preview, in a light and a dark mail client if you have
      both.
- [ ] Do not press *Send to list*. Name the newsletter `SMOKE TEST` and
      leave it as a draft (newsletters have no delete yet); reuse it next
      time.

### C. Booking

- [ ] On the staging website's About page, book an appointment with the
      form: a date and time, your name, your email address and a note.
- [ ] The form reports the request as received; your acknowledgement email
      arrives, and so does the gallery's notification.
- [ ] `/appointments`: the request is listed as requested, at the time you
      chose (London time).
- [ ] **Confirm** it; the status reads Confirmed. Then **Cancel** it so the
      test leaves nothing behind.

Times everywhere are London time (the list matches the calendar grid), and
the dashboard's upcoming panel marks an unconfirmed request "to confirm".

## Every phase: look and keyboard

- [ ] Screenshots of every page the phase touched, in light and dark (the
      theme toggle in the header), at 375, 768 and 1440 px wide. Attach them
      to the pull request.
- [ ] Keyboard pass. Tab through each touched page: the focus ring is always
      visible and the order follows the page. On `/inventory`: j and k move
      the active row, x selects it, f flags it. On a record: ← and →.
      Anywhere: ⌘K or Ctrl+K, and `/`.
- [ ] Stored preferences survive the deploy: inventory column widths,
      density and selection, stock-book column widths and the theme. (The
      browser keys are `jvb:inventory:colwidths:v2`,
      `jvb:inventory:density:v1`, `jvb:inventory:selected:v2` (per tab),
      `jvb:stockbook:colwidths:v1` and `jvb-theme`.)
- [ ] A filtered inventory URL saved before the phase still opens the same
      filter.

## Clean up

- [ ] Delete the test record from its editor (it moves to
      `/inventory/trash`, from where it can be restored for 30 days).
- [ ] Delete `Smoke test list` and the test offer (from `/offers`).
- [ ] Keep the test contact for the next run.

## Record of runs

Add a row per run.

| Date | Phase or change | Build | Run by | Failed steps | Notes and screenshots |
|------|-----------------|-------|--------|--------------|-----------------------|
|      |                 |       |        |              |                       |
