// node --test apps/studio/src/lib/save-outcome.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { asOutcome, FINAL_STATUSES, NO_ANSWER, planFlush, readSaveOutcome, refusalMessage, stillToSend } from "./save-outcome.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a 2xx answer is a save", async () => {
  assert.deepEqual(await readSaveOutcome(json(200, { ok: true })), { ok: true, status: 200 });
  assert.equal((await readSaveOutcome(new Response(null, { status: 204 }))).ok, true);
});

test("401 says signed out, and is tried again (not final)", async () => {
  const o = await readSaveOutcome(json(401, { error: "Unauthorized" }));
  assert.equal(o.ok, false);
  assert.equal(o.signedOut, true);
  assert.equal(o.final, undefined);
});

test("403 and 404 are final and carry the route's own words", async () => {
  const forbidden = await readSaveOutcome(json(403, { error: "Only admin can change the purchase price" }));
  assert.deepEqual(forbidden, {
    ok: false,
    status: 403,
    final: true,
    message: "Only admin can change the purchase price.",
  });
  const gone = await readSaveOutcome(json(404, { error: "Maker not found, or not yours to edit" }));
  assert.equal(gone.final, true);
  assert.equal(gone.message, "Maker not found, or not yours to edit.");
});

test("a bare route text gives the default sentence for the status", async () => {
  assert.equal((await readSaveOutcome(json(403, { error: "Forbidden" }))).message, "Your role cannot change this.");
  assert.match((await readSaveOutcome(json(404, { error: "Not found" }))).message ?? "", /not found/i);
  // No JSON body at all.
  const plain = await readSaveOutcome(new Response("<html>nope</html>", { status: 403 }));
  assert.equal(plain.final, true);
  assert.equal(plain.message, "Your role cannot change this.");
});

test("validation refusals are final too, so a bad value is not resent every 30 s", async () => {
  for (const s of [400, 409, 410, 413, 422]) assert.equal(FINAL_STATUSES.has(s), true, String(s));
  const o = await readSaveOutcome(json(400, { error: "Name is required" }));
  assert.equal(o.final, true);
  assert.equal(o.message, "Name is required.");
});

test("server errors, timeouts and rate limits are retried", async () => {
  for (const s of [500, 502, 503, 504, 408, 429]) {
    const o = await readSaveOutcome(json(s, { error: "boom" }));
    assert.equal(o.ok, false, String(s));
    assert.equal(o.final, undefined, String(s));
    assert.equal(o.signedOut, undefined, String(s));
  }
});

test("refusalMessage trims, caps and ends the sentence", () => {
  assert.equal(refusalMessage(403, "  You can't edit\n this  "), "You can't edit this.");
  assert.equal(refusalMessage(403, "Done!"), "Done!");
  assert.equal(refusalMessage(418, undefined), "The server refused it.");
  assert.equal(refusalMessage(400, 42), "The server did not accept these values.");
  assert.ok(refusalMessage(400, "x".repeat(500)).length <= 201);
});

test("asOutcome reads the old boolean answers and a missing one", () => {
  assert.deepEqual(asOutcome(true), { ok: true });
  assert.deepEqual(asOutcome(false), { ok: false });
  assert.deepEqual(asOutcome(null), { ok: false });
  assert.deepEqual(asOutcome({ ok: false, final: true, message: "x." }), { ok: false, final: true, message: "x." });
});

test("stillToSend: a failure that may pass keeps the edit unsaved; a refusal for good does not", async () => {
  assert.equal(stillToSend(NO_ANSWER), true);
  assert.equal(stillToSend(await readSaveOutcome(json(503, { error: "busy" }))), true);
  assert.equal(stillToSend(await readSaveOutcome(json(401, { error: "Unauthorized" }))), true);
  for (const s of [400, 403, 404]) {
    assert.equal(stillToSend(await readSaveOutcome(json(s, { error: "No" }))), false, String(s));
  }
  assert.equal(stillToSend({ ok: true }), false);
});

test("planFlush: a waiting edit is sent, a refused form is not, a clean one has nothing to send", () => {
  assert.equal(planFlush({ waiting: true, unsaved: true, refused: false }), "send");
  // An edit typed after an older save was refused still goes out.
  assert.equal(planFlush({ waiting: true, unsaved: true, refused: true }), "send");
  assert.equal(planFlush({ waiting: false, unsaved: true, refused: false }), "send");
  assert.equal(planFlush({ waiting: false, unsaved: true, refused: true }), "refused");
  assert.equal(planFlush({ waiting: false, unsaved: false, refused: false }), "clean");
});

test("one refused save followed by several blurs sends no further PATCH", async () => {
  // AutosaveForm's loop in miniature, flushed through planFlush as its blur
  // handler is: one edit, a 403 for good, then focus moving through the
  // form five times with no edit, then Done, then a new edit.
  let patches = 0;
  const s = { waiting: false, unsaved: false, refused: false };
  const send = async (): Promise<boolean> => {
    s.waiting = false;
    patches += 1;
    const o = await readSaveOutcome(json(403, { error: "Your role cannot change this record" }));
    s.refused = Boolean(o.final);
    return o.ok;
  };
  const flush = async (): Promise<boolean> => {
    const plan = planFlush(s);
    if (plan === "refused") return false;
    if (plan === "clean") return true;
    return send();
  };
  const edit = () => {
    s.unsaved = true;
    s.waiting = true;
    s.refused = false;
  };
  edit();
  await send(); // the debounce
  assert.equal(patches, 1);
  for (let i = 0; i < 5; i++) await flush();
  assert.equal(patches, 1, "a blur resent a refused form");
  // Done sends nothing and stays (false), the reason on the line.
  assert.equal(await flush(), false);
  assert.equal(patches, 1);
  // A new edit clears the refusal and is sent once.
  edit();
  await flush();
  assert.equal(patches, 2);
});

// The editors keep their loops in React components, which node --test cannot
// render; these check that they flush through the helpers above rather than
// resending a refused save on a blur, Enter, Done or Send.
const component = (name: string) => readFileSync(new URL(`../components/${name}`, import.meta.url), "utf8");

test("AutosaveForm: flush answers false for a refused form; a save queued behind a refusal sends nothing", () => {
  const src = component("autosave-form.tsx");
  const flush = src.match(/const flush = useCallback\(\(\): Promise<boolean> => \{[\s\S]*?\n  \}, \[save\]\);/)?.[0] ?? "";
  assert.match(flush, /planFlush\(\{ waiting, unsaved: dirty\.current, refused: refused\.current \}\)/);
  assert.match(flush, /if \(plan === "refused"\) return Promise\.resolve\(false\);/);
  assert.match(src, /if \(refused\.current\) return false;\n\s+setStatus\("saving"\);/);
  // Only the form that was refused counts as refused, not an edit typed since.
  assert.match(src, /refused\.current = formRef\.current \? serialise\(formRef\.current\) === sent : true;/);
});

test("MakerProfileEditor: a refusal for good leaves the profile text clean, so a blur sends nothing", () => {
  const src = component("maker-profile-editor.tsx");
  assert.match(src, /else if \(stillToSend\(outcome\)\) profileDirty\.current = true;/);
  assert.doesNotMatch(src, /else profileDirty\.current = true;/);
});

test("useStateAutosave, ContactEditor and CampaignDesigner do not resend a refusal on Done, Enter or Send", () => {
  const editorSave = component("editor-save.tsx");
  assert.match(editorSave, /refused: refused\.current,\n\s+\}\);\n\s+if \(plan === "refused"\) return Promise\.resolve\(false\);/);
  const contact = component("contact-editor.tsx");
  assert.match(contact, /planFlush\(\{ waiting, unsaved: dirty\.current, refused: refused\.current \}\) === "send"\) void save\(\);/);
  assert.match(contact, /if \(refused\.current\) return false;\n\s+setStatus\("saving"\);/);
  assert.match(contact, /refused\.current = formRef\.current \? serialise\(formRef\.current\) === sent : true;/);
  const campaign = component("campaign-designer.tsx");
  assert.match(campaign, /if \(plan === "refused"\) return false;/);
  assert.match(campaign, /refused\.current = !editedSince;/);
});
