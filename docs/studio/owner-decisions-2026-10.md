# Studio redesign: decisions and new features (October 2026)

The studio is being brought into the website's design family and its bugs
fixed, without removing any function. Part 1 is what is being done now and
needs no decision. Part 2 lists the changes that alter what the studio,
a client or the accountant sees, so they need your yes. Part 3 is new
functionality, ordered by how much it would help day to day.

**How to answer:** reply "all as recommended", or give the numbers you want
otherwise (for example "3: Dear collector; 17: clear it automatically").
Nothing in Part 2 or 3 is built until you answer.

## Part 1: under way now (no decision needed)

I will confirm each of these once it is live.

- **One design with the website.** White ground, the website's four text
  greys, Noto Sans, square corners. The orange becomes the website's orange
  and is used only to show where you are, what is selected and keyboard
  focus, never for warnings or decoration. Dark mode stays. This is done
  through the shared colour and type settings, so every page changes at
  once and no page loses a field or a button.
- **London time.** Some studio pages show times in UTC, so appointments read
  an hour early until the clocks change on 25 October.
- **Trash and the website.** A work moved to Trash stays on the website until
  the 30-day purge. It will come off at once, and return if restored.
- **Failed emails.** When Resend refuses an offer, newsletter, test email or
  invitation, the studio reports success. It will say it failed.
- **Newsletter sent twice.** A double click or a retry can mail everyone
  twice. Each send will be locked so each person receives it once.
- **Offer replies.** A client's "interested" reply to a private offer is
  stored but never shown. It will appear on that recipient's row.
- **Offer works editor.** Typing "12,000" clears the price, and reordering
  fails on iPad and with the keyboard.
- **Inventory.**
  - Exports ignore the search, list and flag filters and the sort order.
  - The record arrows (←/→) can land on trashed works.
  - List counts are wrong.
  - The flag pills clear the other filters.
  - The "Finish" badge cannot be cleared; a "Mark catalogued" control is
    added.
  - The record header can show the back photograph.
  - The record page downloads full-size images for small thumbnails, which
    is slow on a phone.
  - A double tap creates two drafts.
- **Contacts.**
  - The list stops at 500 without saying so.
  - The data-subject export misses list membership and offer page views.
  - A contact list, including the automatic interest lists, can be deleted
    with one click.
- **Saving.**
  - Leaving a field saves the whole record even when nothing changed.
  - "Done" can leave before the save lands.
  - An expired sign-in looks as if it saved.

  Done will wait for the save, the page will warn before you leave with
  unsaved edits, and an expired sign-in will say so. After signing in you
  return to the page you asked for. Password forms will say 12 characters,
  as the server already requires.
- **Stock book CSV.** Negative figures turn into text in Excel, and the
  margin working line does not add up.
- **Dashboard.** Unconfirmed booking requests are shown as if confirmed.
- **Safety net.** A check now fails the build if any form field's name
  changes, because autosave depends on those names and a renamed field would
  silently stop saving. There is also a short checklist for staff to run
  through after each release.

## Part 2: decisions

### Newsletters and private offers

**1. Confirm before sending a newsletter.** Today Send goes at once. Proposed:
"Send ‘Autumn at Frieze’ to 212 contacts with consent (of 340 on the list)?"
with Send and Cancel. *Recommend: yes.*

**2. Tell the gallery when a client is interested in an offer.** Proposed: an
email to the gallery, with the client's note and a link to the offer in the
studio. *Recommend: yes, to the same address as website enquiries (Joost's).
That address must also be set as `GALLERY_NOTIFICATIONS_EMAIL` on jvb-studio
in Vercel; today it is set only on jvb-web.*

**3. Offer greeting.** Today the greeting uses the first name and ignores
the salutation you entered, and a contact with a salutation but no first name
gets "Dear Dear Professor Tanaka". Proposed: the salutation as written if
there is one ("Dear Professor Tanaka"), else "Dear" and the first name, else
a fixed fallback. *Recommend the fallback "Dear Sir or
Madam". The alternative is "Dear collector".*

**4. Sold and reserved works on an offer page.** Today a client opening an
older offer still sees sold works with their prices. *Recommend: sold,
gifted and written-off works are hidden. A reserved work shows "Reserved" in
place of the price. Before sending, the studio warns "2 works are no longer
available. Remove them?".*

**5. Offer "views".** Today the views figure counts email opens, which Apple
Mail inflates by opening every email itself. Proposed: separate columns,
"Email opened" and "Page views", and a newsletter recipient who clicked no
longer drops back to "opened". *Recommend: yes. The figures shown will fall,
but they will be real.*

**6. Offer sending rules.**
- An expired offer cannot be sent until it is extended ("Extend to send").
- Offer settings save as you type, like the work editor.
- Each recipient row gets:
  - "Copy link"
  - "Preview", which does not count as a view
  - "Mark sent by hand", for links sent from Joost's own email or phone

*Recommend: yes.*

**7. Client email colours follow the website.** Offers, newsletters and
confirmations use the website's white, greys and orange; buttons are white on
the darker orange so they pass accessibility contrast. *Recommend: yes. I test
in Gmail, Outlook and Apple Mail, light and dark, before switching.*

### Contacts and compliance

**8. Keep anti-money-laundering records when a contact is erased.** Today an
erasure request deletes the in-house AML check of a client who has bought
nothing, although AML evidence must normally be kept for five years and an
erasure request does not override that. An erased contact can also still be
typed into. *Recommend: AML checks are kept under the legal hold, everything
else is erased, and an erased contact becomes read-only with "Erased on
<date>". Please confirm with whoever acts as the data-protection lead.*

**9. "Do not mail (post)" and bounced emails.**
- Today:
  - ticking "Do not mail (post)" also stops newsletters;
  - an email that bounces ticks "Do not mail", which then also drops the
    contact from printed invitations;
  - bounced addresses are not left out of newsletters.
- Proposed:
  - the post box stops post only;
  - a bounce stops email only, and the contact shows "Email bounced
    3 Oct";
  - a new email address clears it.

*Recommend: yes. Before changing the data, I give you the list of contacts
whose post box was ticked by a bounce rather than by a person, for you to
check.*

**10. New contacts, duplicates and merging.** Today "New contact" creates an
empty record at once, and duplicates cannot be merged. Proposed:
- a short form that checks name and email first ("Tanaka Hiroshi already
  exists. Open it?");
- a Merge that moves sales, enquiries, offers, appointments, lists and
  history onto one record;
- a contact with nothing linked to it can be deleted (today a contact can
  only be erased through data protection).

*Recommend: yes.*

**11. Consent visible on the contact.** The marketing checkbox becomes a line
such as "Subscribed · consented 3 Oct via website enquiry", "Unsubscribed
12 Sep" or "Address bounced". Re-subscribing someone asks how they gave
consent and records it. *Recommend: yes.*

### Works, images and the website

**12. Condition and document photos stay off the website.** Today every
photograph of a work is published, including those marked "condition" or
"document". *Recommend: yes. Before switching, I list any work whose only
photographs are condition or document shots, since it would then publish
without a picture.*

**13. Confirm before deleting a list or an image.** Today both go with one
click. *Recommend: yes.*

**14. Photographs on the phone and the cover image.**
- On a phone, offer "Take photo" and "Choose photos". Today the phone opens
  the camera directly, so existing photos cannot be added.
- Each photograph gets its role and caption in place (today the role is set
  once per upload and cannot be changed), and a "Make cover" button. The first photograph is labelled "Cover · website square".
- Deleting a photograph asks first and also deletes the file; today it
  removes only the entry and leaves the file in storage.
- Today the studio thumbnail and the website square can come from different
  photographs. One rule for both: the first photograph in the images page
  order. A few studio thumbnails will change to match the website.

*Recommend: yes.*

**15. Quick changes without opening the editor.** Status, location and the
website switch on the record page itself. Bulk edit gains website on/off,
category, maker and website square, still asking you to confirm the count.
*Recommend: yes, after item 16.*

**16. Two people editing the same work.** Today, if a colleague moves a
work's location while Joost has the editor open, Joost's next keystroke puts
the old location back. Proposed: each save writes only the fields that person
changed, and the editor warns "Changed elsewhere. Reload?" if someone else
saved in between. This changes the core of autosave, so it comes in the next
phase with a two-browser test. *Recommend: yes.*

**17. The "Finish" badge.** A "Mark catalogued" button is being added (Part 1).
It could also clear itself once a work has a title, maker, category and
photograph. *Recommend: keep it manual, so a work with a placeholder title is
not marked catalogued by accident.*

### Sales and the stock book

**18. Trashed works out of the stock book.** Today the stock book and its
exports still count works in Trash. *Recommend: yes, after you and the
accountant check the list of trashed works that appear in it (the query is
in the appendix). Any that is a real sale is restored first. The totals then
change by exactly those rows.*

**19. "Record sale" in one place.** One dialog on the record and in the
editor:
- sold date (today by default);
- price and currency, with the pound figure converted at the sale-date rate
  as now;
- buyer;
- VAT treatment, with VAT due and net worked out as you type;
- the consignment share;
- the sale invoice.

Saving sets the status to Sold. "Undo sale" reverses it. *Recommend: yes.*

### Navigation and the daily overview

**20. Navigation by job.** The top row becomes Today · Works · Clients ·
Logistics · Finance · Website · Admin. Each has its own second row, for
example Clients: Contacts, Enquiries, Offers, Appointments, Contact lists,
Newsletters. Password, passkeys, theme and sign-out move to an account menu.
Every existing address keeps working, and who sees what does not change.
*Recommend: yes.*

**21. The dashboard becomes "Today".**
- A single "Needs attention" list, hidden when empty:
  - overdue data requests
  - sanctions matches
  - bookings to confirm
  - open enquiries and offer interest
  - offers expiring this week
  - AML checks due
  - works to finish
  - reserved works
  - works on temporary export
  - missing purchase prices
- Then the next ten days, watched works and your recent edits.

Each line opens the matching filtered list. The website chart and the
nationality chart move to Website › Analytics. *Recommend: yes.*

### Appointments

**22. Appointment outcomes and confirmations.**
- Before an appointment: Confirm and Cancel. Confirm emails the visitor a
  confirmation with an updated calendar entry; Cancel sends the
  cancellation. Today the website tells visitors "We will confirm", but
  confirming in the studio sends nothing.
- After it: Completed or No-show (today these are offered before the visit
  and not after it).
- "New appointment" in the studio, for a client, also put in the shared
  calendar.

*Recommend: yes. I send you the confirmation email's wording before it goes
live.*

### Look and technical

**23. No serif in the studio.** The studio uses the Newsreader serif in a few
places (AI drafts, the newsletter designer preview); the website uses none.
It is being replaced with Noto Sans. Client-facing PDFs and emails keep
their own fonts. *Say if you would rather keep it.*

**24. One form reader.** The work form is read by two pieces of code that must
be kept in step; one is unused. It is removed and the project notes updated.
No visible change. *Recommend: yes.*

## Part 3: new functionality

Sizes: small is a day or less, medium a few days, large a week or more.

### Build next, with the redesign

- **N1 Enquiries inbox** (medium). Website and phone enquiries in one list,
  open ones first, each with the work's thumbnail. From an enquiry:
  - Reply, which opens your email with the work and the quoted message and
    marks the enquiry replied;
  - Start offer;
  - Book appointment;
  - Log note.

  "Log an enquiry" records phone and fair conversations. Today website
  enquiries exist only as emails. *Decision: the status words; I propose
  Open, Replied, Closed.*
- **N3 Website square in the studio** (small). The piece form shows the exact
  square the website will show, or "Renders on next sync". Studio thumbnails
  follow the same rule. Read-only.
- **N7 Duplicate a work** (small). For pairs, sets and series. Copies the
  cataloguing and dimensions only, never stock number, prices, photographs or
  website state.
- **N2 Contact history** (medium). One timeline per contact (sales, offers,
  enquiries, appointments, newsletters, notes) with a one-line "Log a call or
  meeting". Needs a retention rule for notes, which I add with it.
- **N14 Find anything** (medium, with item 20). ⌘K finds works, contacts,
  makers, lists, offers, documents and shipments; an exact stock number
  comes first. It also runs commands (new work, new contact, new offer, log
  enquiry), and "?" shows the keyboard shortcuts.
- **N8 Cataloguing worklists** (medium). Filter works by maker, by "no
  category / no location / no maker", by "no photograph" and by "on the
  website without a photograph", and save any of these as a list. This also
  helps with the website content tasks.
- **N11 Help at the point of sale** (medium, with item 19). Create a new buyer
  from the sale form. When a sale reaches €10,000 and the buyer's AML check
  is not complete, the form says "AML check required" with a link to the
  contact.

### Before TEFAF Maastricht (March 2027)

- **N16 Fair mode on the phone** (large). A phone layout with a bottom bar
  (Today · Search · Fair · Contacts · More). It offers:
  - stock-number search;
  - the flagged selection as large cards;
  - a "Client view" that hides cost, margin and notes;
  - a full-screen swipe viewer;
  - Reserve for a client;
  - Log interest;
  - "Quick lead" with consent ticks.

  *Decision: yes or no. It adds a new way of collecting personal data, so
  the privacy notice gains a line.*
- **N10 Scan-to-open labels and stock-take** (medium). A small QR code on work
  labels opens the record. A stock-take per location: tick or scan each work,
  see what is missing, move strays in one step. The Avery sheet is still
  chosen first.
- **N4 Follow-ups and "reserved for"** (medium). Reminders on contacts, shown
  on Today. A work reserved for a named client until a date. It is
  suggested after an offer has been viewed for five days without reply.
  *Decision: yes or no. Personal data, so retention, erasure and the privacy
  notice are updated with it.*
- **N5 Faster offers** (small). Duplicate an offer (never its recipients),
  offer templates, and "Offer this work" and "Send an offer" on the work, the
  contact and the enquiry.
- **N6 Contact filters and saved lists** (medium). Filter by type, country,
  consent, AML state, interest, tag and "bought in the last two years". Save
  any filter as a live list. Select contacts to add them to a list or offer,
  or print labels.

### Later, or when asked for

- **N9 Provenance editor** (medium). Ownership history line by line, each
  marked public or internal, in order. *Decision needed first: public lines
  name previous owners on the website, often private collectors. I recommend
  internal by default and no living private owner named without their
  agreement.*
- **N12 Shipments with carrier and tracking** (medium). Consignee (prefilled
  from the buyer), shipper, carrier, tracking reference and status. "Create
  export shipment" from a sold work. *Decision: yes or no. It adds personal
  data and possibly a carrier as a data processor.*
- **N13 Newsletter results per person** (small). Who opened, clicked or
  bounced, and "Make a list from the clickers".
- **N15 Table settings** (medium). One compact or comfortable setting for every
  table, choice of columns, and saved inventory views.
- **N17 CSV exports** (small) for offers, shipments and appointments.
- **N18 Contact import with preview** (small). Shows the column mapping, the
  first rows and the likely duplicates before importing, adds a source note,
  and never assumes consent.

## What I need from you

1. Your answers to Part 2 and the choices in Part 3.
2. **A temporary staff login** (staff role, not admin) for checking every page
   on screen after the redesign. You delete it afterwards.
3. **For item 18:** the result of the query below, run in Supabase Studio's
   SQL editor. It only reads.

## Appendix: trashed works in the stock book (item 18)

```sql
select v.stock_number, v.description, v.vat_treatment,
       v.purchase_date, v.purchase_cost_gbp,
       v.sold_date, v.sold_price_gbp,
       p.deleted_at::date as trashed_on
from public.vw_stock_book_all v
join public.pieces p on p.id = v.piece_id
where p.deleted_at is not null
order by v.sold_date nulls last, v.stock_number;
```

No rows means the stock book totals do not change.
