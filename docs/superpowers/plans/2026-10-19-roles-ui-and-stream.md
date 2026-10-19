# Roles UI, verified ranks and Stream permission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let everyone share their screen in voice, replace the wall of role menus with one button panel and `/profilo`, and gate high ranks behind a staff approval queue.

**Architecture:** The existing select-menu handlers (`roles:*`, `heroes:*`) stay and are reused inside private (ephemeral) messages opened by four panel buttons. High ranks are requested with a slash command that takes a screenshot; the request becomes a card in a staff channel whose state lives in the card (no storage). Pure logic goes in small modules tested with Node's built-in runner.

**Tech Stack:** Node >= 20, discord.js ^14.27, `node:test` (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-19-roles-ui-and-stream-design.md`

## Global Constraints

- No new npm dependencies; tests use `node --test` and `node:assert/strict`.
- The bot keeps no state on disk: pending requests are recognised from the card message itself.
- A member holds at most one rank role.
- Free ranks: Initiate, Seeker, Alchemist, Arcanist, Ritualist. Verified ranks: Emissary, Archon, Oracle, Phantom, Ascendant, Eternus. The split is one flag (`verify: true`) in `src/template.js`.
- Staff who can approve = `isStaff(member)` in `src/util.js` (ManageMessages).
- Hero mains stay limited to 5 per class; rank list and LFG cards are unchanged (LFG still reads the rank from the role).
- Code style: CommonJS, 2-space indent, single quotes, English user-facing text except `/profilo` and `/verifica-rank` names.

## Review Focus

- A member requests a rank while an earlier request from them is still pending: refused, one card only.
- The attachment is not an image (pdf, zip): refused with a clear message, nothing posted.
- The member already holds the requested rank: refused.
- The approver is the requester (a mod approving their own card): refused.
- The requester left the server before approval: card is closed with a note, no crash.
- The hero API is down when the Heroes button is pressed: friendly ephemeral message, no unhandled rejection.

---

### Task 1: Stream permission

**Files:**
- Create: `src/permissions.js`, `tests/permissions.test.js`
- Modify: `src/setup.js:133-134` (build), `src/setup.js` addTools, `package.json` (scripts)

**Interfaces:**
- Produces: `EVERYONE_PERMS: bigint[]` (the current `@everyone` list plus `PermissionFlagsBits.Stream`); `ensureEveryoneCanStream(guild: Guild): Promise<boolean>` resolves `true` if it had to add the permission, `false` if already present. It adds `Stream` only and never removes or re-grants anything else.

- [ ] **Step 1: Add the test script**

In `package.json` add `"test": "node --test tests/"` to `scripts`.

- [ ] **Step 2: Write the failing tests** in `tests/permissions.test.js`

```js
test('EVERYONE_PERMS includes Stream', () => {
  assert.ok(EVERYONE_PERMS.includes(PermissionFlagsBits.Stream));
});
test('ensureEveryoneCanStream adds only Stream when missing', async () => {
  const calls = [];
  const everyone = { permissions: new PermissionsBitField([PermissionFlagsBits.ViewChannel]),
    setPermissions: async (p) => calls.push(new PermissionsBitField(p)) };
  assert.equal(await ensureEveryoneCanStream({ roles: { everyone } }), true);
  assert.deepEqual(calls[0].toArray().sort(), ['Stream', 'ViewChannel']);
});
test('ensureEveryoneCanStream does nothing when already allowed', async () => {
  const everyone = { permissions: new PermissionsBitField([PermissionFlagsBits.Stream]),
    setPermissions: async () => assert.fail('must not be called') };
  assert.equal(await ensureEveryoneCanStream({ roles: { everyone } }), false);
});
```

- [ ] **Step 3: Run** `npm test` — expected FAIL, module not found.
- [ ] **Step 4: Implement** `src/permissions.js` per the Interfaces block; move the list now inline in `setup.js` `build()` into `EVERYONE_PERMS` (same entries plus `Stream`) and use it there.
- [ ] **Step 5: Wire into `/add-tools`**: in `addTools` (after `R.player` check) call `await ensureEveryoneCanStream(i.guild)`; when it returns true, append "Screen sharing enabled for everyone." to the final reply.
- [ ] **Step 6: Run** `npm test` — expected all PASS.
- [ ] **Step 7: Commit** `fix: let everyone stream in voice channels`

### Task 2: Rank tiers in the template

**Files:**
- Modify: `src/template.js:17-27`, `src/template.js` (new queue channel in THE WAR ROOM)
- Create: `src/ranks.js`, `tests/ranks.test.js`

**Interfaces:**
- Produces: `freeRanks`, `verifiedRanks`: arrays of rank role defs from `roles` (group `'rank'`), split by the `verify` flag; `rankByKey(key): RoleDef | undefined`.
- Template: add `verify: true` to emissary, archon, oracle, phantom, ascendant, eternus. Add channel `{ name: '📥┃rank-queue', type: 'text', special: 'rankqueue' }` to THE WAR ROOM.

- [ ] **Step 1: Write the failing test** `tests/ranks.test.js`

```js
test('free ranks are Initiate..Ritualist', () => {
  assert.deepEqual(freeRanks.map((r) => r.key).sort(),
    ['alchemist', 'arcanist', 'initiate', 'ritualist', 'seeker']);
});
test('verified ranks are Emissary and above', () => {
  assert.deepEqual(verifiedRanks.map((r) => r.key).sort(),
    ['archon', 'ascendant', 'emissary', 'eternus', 'oracle', 'phantom']);
});
test('rankByKey returns undefined for non-ranks', () => {
  assert.equal(rankByKey('eu'), undefined);
});
```

- [ ] **Step 2: Run** `npm test` — expected FAIL.
- [ ] **Step 3: Implement** `src/ranks.js` and the template edits.
- [ ] **Step 4: Run** `npm test` — expected PASS.
- [ ] **Step 5: Commit** `feat: split ranks into free and verified, add rank-queue channel`

### Task 3: Profile panel, sections and `/profilo`

**Files:**
- Create: `src/roleDiff.js`, `tests/roleDiff.test.js`
- Modify: `src/features/roles.js` (panel, handlers, `commands`), `src/features/index.js` (aggregate `legacyTitles`), `src/setup.js` (`refreshPanels` deletes legacy titles)

**Interfaces:**
- Produces: `diffRoles(all: Role[], wanted: Role[], has: (role: Role) => boolean): { add: Role[], remove: Role[] }`.
- Produces from `roles.js`: `commands` (`/profilo`, no options, `setDMPermission(false)`), `legacyTitles: string[]` = `['⚔️ YOUR RANK', '🌍 YOUR REGION', '🐺 PARTY PINGS']` (old menu messages; the old hero class messages are matched separately in Step 8).
- Button ids: `profile:rank`, `profile:region`, `profile:heroes`, `profile:ping` (open a section, ephemeral); `profile:class:<type>` (hero class picker result). Selects keep ids `roles:<group>` and `heroes:<type>:<idx>`.

- [ ] **Step 1: Write the failing test** `tests/roleDiff.test.js`

```js
const r = (id) => ({ id });
test('removes unselected held roles and adds new ones', () => {
  const [a, b, c] = [r('a'), r('b'), r('c')];
  const held = new Set(['a']);
  const { add, remove } = diffRoles([a, b, c], [b], (x) => held.has(x.id));
  assert.deepEqual(add, [b]);
  assert.deepEqual(remove, [a]);
});
test('no change when selection equals what is held', () => {
  const a = r('a');
  const out = diffRoles([a], [a], () => true);
  assert.deepEqual(out, { add: [], remove: [] });
});
```

- [ ] **Step 2: Run** `npm test` — expected FAIL.
- [ ] **Step 3: Implement** `diffRoles` and use it in the existing select handler in `roles.js` (replace the inline `remove`/`add` computation).
- [ ] **Step 4: Run** `npm test` — expected PASS. Commit `refactor: extract diffRoles`.
- [ ] **Step 5: Replace the roles panel.** `panels.roles` returns a single message: the existing "🎭 CHOOSE YOUR PATH" embed (same title, new text: one button per section, "change it any time") and one action row with four buttons (`profile:rank` ⚔️ Rank, `profile:region` 🌍 Region, `profile:heroes` 🦸 Heroes, `profile:ping` 🐺 Pings). Stop calling `ensureHeroRoles` in the panel; call it when the Heroes section opens.
- [ ] **Step 6: Section handlers.** Each button replies ephemerally with the section's select, pre-selected (`default: true`) from the member's current roles:
  - rank: a select of `freeRanks` only (`roles:rank`, min 1, max 1). Its handler considers **all** rank roles as removable, so choosing a free rank replaces any rank, including a verified one. Below the select a text line: "Emissary or higher needs verification: use `/verifica-rank`."
  - region / ping: the existing `roles:region` / `roles:extra` selects.
  - heroes: four class buttons (`profile:class:<type>`); pressing one updates the message with that class's `heroes:<type>:<idx>` selects. If `getHeroes()` throws, reply "Hero list unavailable right now, try again in a minute." (Review Focus).
- [ ] **Step 7: `/profilo`.** Replies ephemerally with an embed listing current rank, regions, ping role and hero mains (from the member's role names) and the same four buttons. Section handlers are shared with the panel buttons.
- [ ] **Step 8: Legacy cleanup.** Aggregate `legacyTitles` in `features/index.js` and in `refreshPanels` also delete bot messages whose first embed title is in it or starts with a hero class emoji+label from `CLASSES` (old hero menus), so `/refresh-panels` leaves only the new panel.
- [ ] **Step 9: Verify by hand** (needs a test server and `DISCORD_TOKEN` in `.env`): run `npm start`, `/refresh-panels`; expect one message with four buttons in `#get-roles`; each button opens a private message; picking Ritualist gives the role and replaces any other rank; `/profilo` shows the current roles.
- [ ] **Step 10: Commit** `feat: button panel and /profilo for roles`

### Task 4: Rank requests and the staff queue

**Files:**
- Create: `src/rankRequest.js`, `tests/rankRequest.test.js`, `src/features/rankrequest.js`
- Modify: `src/features/index.js` (register `./rankrequest`)

**Interfaces:**
- Consumes: `verifiedRanks`, `rankByKey` (Task 2); `isStaff`, `roleMap`, `channelByKey`, `logEvent` (`src/util.js`).
- Produces: `encodeRequest(userId: string, rankKey: string): string` (`"<userId>:<rankKey>"`); `decodeRequest(text: string): { userId: string, rankKey: string } | null`; `checkRequest({ rankKey, contentType, alreadyHasRank, pendingExists }): { ok: true } | { ok: false, reason: string }`, checking in this order: rank not verified, attachment not `image/*`, already has rank, pending exists.
- Command `/verifica-rank` options: `rank` (required string, choices = `verifiedRanks`), `screenshot` (required attachment).
- Card: embed titled `🎖️ Rank request`, footer = `encodeRequest(...)`, image = re-uploaded screenshot, buttons `rankq:ok` and `rankq:no`.

- [ ] **Step 1: Write the failing tests** `tests/rankRequest.test.js`

```js
test('encode/decode round trip', () => {
  assert.deepEqual(decodeRequest(encodeRequest('123', 'oracle')), { userId: '123', rankKey: 'oracle' });
});
test('decode rejects garbage', () => assert.equal(decodeRequest('nope'), null));
const base = { rankKey: 'archon', contentType: 'image/png', alreadyHasRank: false, pendingExists: false };
test('valid request passes', () => assert.deepEqual(checkRequest(base), { ok: true }));
test('free rank is refused', () => assert.equal(checkRequest({ ...base, rankKey: 'seeker' }).ok, false));
test('non-image is refused', () => assert.equal(checkRequest({ ...base, contentType: 'application/pdf' }).ok, false));
test('already held is refused', () => assert.equal(checkRequest({ ...base, alreadyHasRank: true }).ok, false));
test('pending request is refused', () => assert.equal(checkRequest({ ...base, pendingExists: true }).ok, false));
```

- [ ] **Step 2: Run** `npm test` — expected FAIL.
- [ ] **Step 3: Implement** `src/rankRequest.js`; run `npm test` — PASS. Commit `feat: rank request validation`.
- [ ] **Step 4: Command handler** in `features/rankrequest.js`: `pendingExists` is found by scanning the last 100 messages of the queue channel for a bot card with buttons whose footer decodes to the same `userId`. On success post the card (screenshot re-uploaded by passing its URL as a file so it outlives the CDN link) and reply ephemerally "Sent to staff, you'll be notified here". If the queue channel is missing, reply "Run /add-tools first" to the user.
- [ ] **Step 5: Button handlers.** Only `isStaff` members can press; others get an ephemeral refusal. The approver cannot be the requester. On approve: fetch the member (on failure edit the card to "Member left the server", remove buttons, stop); remove all rank roles, add the requested one; edit the card to show "Approved by <@staff>" with no buttons; `logEvent` to the mod-log; try to DM the member and ignore failure. On reject: same card edit with "Rejected by", DM the member, no role change.
- [ ] **Step 6: Verify by hand:** with a non-staff test account run `/verifica-rank rank:Archon` with a png: a card appears in `#rank-queue`; a second identical request is refused; a pdf is refused; approving with another account gives Archon and removes the previous rank; approving your own card is refused.
- [ ] **Step 7: Commit** `feat: staff-approved rank requests`

### Task 5: Docs and server rollout

**Files:**
- Modify: `README.md` (Features list: roles panel, `/profilo`, `/verifica-rank`, rank queue, screen sharing)

- [ ] **Step 1: Update the README features** and the `get-roles` line.
- [ ] **Step 2: Run** `npm test` — all PASS.
- [ ] **Step 3: Commit** `docs: describe new roles flow`
- [ ] **Step 4: Rollout on the real server (owner):** deploy, run `/add-tools` (creates `rank-queue`, enables Stream for `@everyone`), then `/refresh-panels`. Check voice: a normal member sees the Video button. If it still fails, a category or channel override denies Video; remove that override.

## Self-review

- Spec coverage: panel and private windows (Task 3), free vs verified ranks (Task 2), staff queue with approve/reject (Task 4), `/profilo` (Task 3), Stream plus one-time sync (Task 1, wired into `/add-tools`), no migration (none needed).
- Spec asked "scegli il rank e allega uno screenshot": implemented as `/verifica-rank` with an attachment option, because ephemeral menus cannot receive uploads. This is a plan decision.
- Not unit-tested because they need a live Discord client: panel layout, ephemeral flows, card buttons. Covered by the manual steps in Tasks 3, 4 and 5.
