# Basic Chatrooms PR Plan

## Repository findings and planning rules

- The repository is an npm workspace with a NestJS/PostgreSQL backend and a React/Vite frontend.
- Authentication already exists for HTTP and Socket.IO. The browser keeps the JWT in `sessionStorage`; the WebSocket handshake accepts it through `handshake.auth.token`.
- The current `ChatGateway` authenticates connections but has no room events. The frontend has no Socket.IO client dependency or dashboard yet.
- PostgreSQL access uses small repositories over `DatabaseService`; migrations are ordered TypeScript files called by `migrate.ts`.
- The global HTTP JWT guard makes new controllers protected unless marked `@Public()`.
- Jest is the normal unit/component/database test runner. PostgreSQL tests run when `TEST_DATABASE_URL` is present in CI. Existing Playwright tests cover browser session behavior.
- Existing uncommitted files (`README.md`, scanner output, and `todo.md`) are outside this feature and must not be touched by these PRs.

The PRs below are intentionally sequential: create each branch from `main` after its predecessor has merged. “Independently mergeable” means each PR delivers one bounded behavior, contains its own tests, and leaves the repository green; it does not mean later PRs can be merged before their declared dependencies.

LOC estimates count meaningful added or modified source, test, configuration, and migration lines. Generated output and mechanical `package-lock.json` changes do not count. If a PR reaches 150 meaningful lines during implementation, reduce test duplication or split it; never exceed 200.

Every PR must pass:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Frontend interaction PRs must also pass the relevant `npm run test:browser --workspace frontend` cases.

## Architecture decisions

- `chatrooms`, `user_chatrooms`, and `chats` use UUID primary keys to match the existing `users.id`. The migration seeds `General`, `Development`, and `Random`, so the initial catalog is useful but still database-backed.
- `chatroom_name` is required and unique. Active-user counts are never stored in PostgreSQL.
- `user_chatrooms` is historical membership with an open interval (`left_datetime IS NULL`) for the current logical membership. The first socket for a user/room opens the interval; the last socket closes it. Before opening a new interval, the repository closes any stale open interval, making reconnects safe after an unclean process exit. This table is audit history, not the live-presence authority.
- Live presence is an in-memory, single-node index keyed by room, user, and socket. Counts mean **unique authenticated users**, not connected sockets. Socket.IO/this index is authoritative for current membership. Redis and horizontal fan-out remain out of scope.
- A second tab for the same user joins the Socket.IO room but does not increase the count, open another logical membership interval, or emit a second user-joined notification. A leave notification is emitted only when that user's final socket leaves.
- Room names and message senders use `username ?? email` when read from PostgreSQL. Because registration currently does not collect a username and JWTs contain email, live notifications use email as the safe display identity; adding profile management is out of scope.
- Socket room keys are derived only on the server (for example, `chatroom:<uuid>`). Clients send stable chatroom UUIDs, never Socket.IO room names.
- Socket commands use acknowledgement envelopes: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. This is the smallest consistent error convention because the repository has no existing event-error contract.
- Joining happens before history is queried, and the `joinRoom` acknowledgement carries the latest 50 messages. This avoids a second REST endpoint and fits the existing Socket.IO gateway. The client de-duplicates by message ID if a `newMessage` arrives while history is loading.
- `roomNotification` is room-scoped and is not persisted. `newMessage` is emitted only to the Socket.IO room. `roomUserCountUpdated` is emitted to all authenticated namespace clients because every dashboard sidebar shows every room's count.
- Messages are trimmed, must contain 1–2,000 characters, and receive sender identity and timestamps from the server. Client validation is only a usability aid; backend validation remains authoritative.
- No router dependency is needed. `AuthPage` remains the session boundary and swaps to the dashboard only after successful login or a successful `/auth/me` restoration probe.

---

## PR 1 — Create the relational chat schema

**Branch:** `feat/chat-schema`

**PR title:** `feat(database): add the basic chatroom schema`

**Goal:** Add the three related PostgreSQL tables, constraints, indexes, and initial rooms as one atomic schema foundation.

**Description:** Introduce migration `002` after the existing users migration. It creates `chatrooms`, `user_chatrooms`, and `chats` with UUID foreign keys, timestamps, a unique room name, an open-membership uniqueness constraint, message length protection, and a room/time history index. Seed the three starter rooms with conflict-safe inserts. The down path drops dependent tables in reverse order.

**Files:**

- `packages/backend/src/modules/database/migrations/002-create-chat-schema.ts` (new)
- `packages/backend/src/modules/database/migrate.ts`
- `packages/backend/test/chat-schema-migration.spec.ts` (new)
- `packages/backend/test/migrate.spec.ts`

**Estimated meaningful LOC:** 130–150

**Commits:**

1. `feat(database): define chatroom membership and chat tables`
2. `test(database): verify chat schema constraints and seed rooms`

**Acceptance criteria:**

- Migration order is users first, chat schema second.
- Exact duplicate chatroom names are rejected by PostgreSQL.
- All foreign keys reference the existing UUID user and chatroom IDs.
- `number_of_users`, usernames, and room names are not duplicated into membership/message rows.
- The integration test creates the schema, verifies starter rooms/default timestamps, rejects invalid references and duplicate names, then cleans up in reverse order.

## PR 2 — Query the persisted chatroom catalog

**Branch:** `feat/chatroom-catalog-repository`

**PR title:** `feat(chatrooms): add database-backed room catalog queries`

**Goal:** Provide one repository abstraction for listing rooms and validating a stable room ID.

**Description:** Add typed row mapping and parameterized queries for `listChatrooms()` and `findChatroomById()`. Ordering is deterministic by room name and no active count is read from the database. Register the repository in the existing chat module for later HTTP and WebSocket consumers.

**Files:**

- `packages/backend/src/modules/chat/chatroom.types.ts` (new)
- `packages/backend/src/modules/chat/chatrooms.repository.ts` (new)
- `packages/backend/src/modules/chat/chat.module.ts`
- `packages/backend/test/chatrooms.repository.spec.ts` (new)

**Estimated meaningful LOC:** 105–140

**Commits:**

1. `feat(chatrooms): query rooms by catalog order and id`
2. `test(chatrooms): cover database room lookup and mapping`

**Acceptance criteria:**

- Returned rooms come from PostgreSQL and contain only stable ID, name, and creation time.
- ID lookup is parameterized and returns `null` for a nonexistent room.
- A PostgreSQL-backed test proves seeded rooms load from the database.

## PR 3 — Track unique live room presence

**Branch:** `feat/unique-room-presence`

**PR title:** `feat(chat): track unique users across room sockets`

**Goal:** Add the in-memory authority used to answer membership and unique-user count questions.

**Description:** Introduce a focused presence service that indexes room/user/socket membership. Its join, leave, and disconnect operations are idempotent and report first-user/last-user transitions plus the resulting unique count. It stores no database data and emits no events, keeping this PR to one testable behavior.

**Files:**

- `packages/backend/src/modules/chat/room-presence.service.ts` (new)
- `packages/backend/src/modules/chat/chat.module.ts`
- `packages/backend/test/room-presence.service.spec.ts` (new)

**Estimated meaningful LOC:** 105–140

**Commits:**

1. `feat(chat): index room presence by user and socket`
2. `test(chat): cover unique counts and idempotent transitions`

**Acceptance criteria:**

- Two sockets for one user count as one active user.
- Rejoining the same socket is a no-op.
- Removing one of several sockets does not mark the user inactive.
- Disconnect returns every affected room and leaves no stale socket membership.

## PR 4 — Expose the protected chatroom list

**Branch:** `feat/chatroom-list-api`

**PR title:** `feat(chatrooms): expose the authenticated room catalog`

**Goal:** Let authenticated clients fetch database rooms with current unique-user counts.

**Description:** Add `GET /chatrooms` through the globally protected Nest controller. Compose persisted room metadata with the presence service's live count; do not persist or cache counts. Keep response mapping in a small service so the controller remains transport-only.

**Files:**

- `packages/backend/src/modules/chat/chatrooms.service.ts` (new)
- `packages/backend/src/modules/chat/chatrooms.controller.ts` (new)
- `packages/backend/src/modules/chat/chat.module.ts`
- `packages/backend/test/chatrooms.service.spec.ts` (new)
- `packages/backend/test/chatrooms.controller.spec.ts` (new)

**Estimated meaningful LOC:** 90–125

**Commits:**

1. `feat(chatrooms): return persisted rooms with live counts`
2. `test(chatrooms): cover protected catalog responses`

**Acceptance criteria:**

- An authenticated request receives rooms sorted by the repository and a `numberOfUsers` for each.
- An unauthenticated request is rejected by the existing global JWT guard.
- The service never reads a stored count column.

## PR 5 — Record historical user-room membership

**Branch:** `feat/chat-membership-history`

**PR title:** `feat(chat): record logical room membership intervals`

**Goal:** Open and close historical membership intervals for first/last unique-user presence transitions.

**Description:** Add a membership repository with transactional `beginMembership` and `endMembership` methods. Beginning closes any stale open interval before inserting the new interval; ending updates only the current open interval. The gateway is wired in a later PR, so this change is independently verified at repository/database level.

**Files:**

- `packages/backend/src/modules/chat/user-chatrooms.repository.ts` (new)
- `packages/backend/src/modules/chat/chat.module.ts`
- `packages/backend/test/user-chatrooms.repository.spec.ts` (new)

**Estimated meaningful LOC:** 120–150

**Commits:**

1. `feat(chat): persist membership history intervals`
2. `test(chat): cover stale reconnect and interval closure`

**Acceptance criteria:**

- A first join creates an open interval using `user_id` and `chatroom_id`.
- Reconnect closes a stale interval before opening a new one.
- Leave closes the open interval without deleting history.
- Repository tests cover missing/invalid foreign keys and transaction rollback.

## PR 6 — Persist authoritative chat messages

**Branch:** `feat/chat-message-persistence`

**PR title:** `feat(chat): persist server-authored room messages`

**Goal:** Save a validated message with server-selected user, room, and timestamp.

**Description:** Add the write side of the chat repository. The insert accepts only trusted `userId`, `chatroomId`, and normalized message text, then returns the saved public message with its generated ID/timestamp and database-derived sender display name.

**Files:**

- `packages/backend/src/modules/chat/chat-message.types.ts` (new)
- `packages/backend/src/modules/chat/chats.repository.ts` (new)
- `packages/backend/src/modules/chat/chat.module.ts`
- `packages/backend/test/chats.repository.spec.ts` (new)

**Estimated meaningful LOC:** 100–135

**Commits:**

1. `feat(chat): persist authoritative room messages`
2. `test(chat): verify message ownership and timestamps`

**Acceptance criteria:**

- The caller cannot provide a sender label or timestamp.
- The saved message references existing user and room IDs.
- The returned message contains ID, room ID, sender, message, and server timestamp.
- Database constraints reject blank/overlong content as defense in depth.

## PR 7 — Load isolated latest-room history

**Branch:** `feat/chat-history-query`

**PR title:** `feat(chat): query the latest 50 room messages`

**Goal:** Return only one room's newest 50 persisted messages in chronological display order.

**Description:** Extend the chat repository with the read-side history query. Select the newest 50 by descending timestamp/ID inside a subquery, then return that window ascending for display. Join users only to calculate `username ?? email`.

**Files:**

- `packages/backend/src/modules/chat/chats.repository.ts`
- `packages/backend/test/chats.repository.spec.ts`

**Estimated meaningful LOC:** 75–110

**Commits:**

1. `feat(chat): query bounded chronological room history`
2. `test(chat): cover history limit order and room isolation`

**Acceptance criteria:**

- At most 50 messages are returned.
- The result is chronological even though the latest records are selected.
- Another room's messages never appear.
- Empty rooms return an empty array.

## PR 8 — Join a validated Socket.IO room

**Branch:** `feat/ws-join-room`

**PR title:** `feat(chat): add authenticated joinRoom handling`

**Goal:** Allow an authenticated socket to join an existing chatroom exactly once.

**Description:** Define the shared backend event/ack types and add `joinRoom` handling. Validate the UUID payload, confirm the room in PostgreSQL, join the server-derived Socket.IO room, update presence, and open membership history only on the first unique-user socket. Roll back socket/presence state if persistence fails.

**Files:**

- `packages/backend/package.json`
- `packages/backend/src/modules/chat/chat-events.types.ts` (new)
- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`
- `packages/backend/test/chat-gateway.e2e-spec.mjs`

**Estimated meaningful LOC:** 125–150

**Commits:**

1. `feat(chat): handle validated room joins`
2. `test(chat): run socket authentication and joinRoom coverage`

**Acceptance criteria:**

- A connected authenticated socket can join an existing chatroom by UUID.
- Missing, malformed, and nonexistent room IDs receive stable error acknowledgements.
- A socket cannot invoke the handler without passing the existing handshake authentication.
- Duplicate joins do not duplicate Socket.IO or persisted membership.
- The existing Socket.IO connection test is added to the backend test script so this authentication boundary runs in CI.

## PR 9 — Return history in the join acknowledgement

**Branch:** `feat/ws-join-history`

**PR title:** `feat(chat): return room history from joinRoom`

**Goal:** Give a newly joined socket the selected room's latest messages without another endpoint.

**Description:** After a successful join, query the repository and include its chronological messages in the success acknowledgement. If history loading fails, return a stable failure and undo the new membership so the client is not left in a half-joined state.

**Files:**

- `packages/backend/src/modules/chat/chat-events.types.ts`
- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`

**Estimated meaningful LOC:** 60–90

**Commits:**

1. `feat(chat): include history in join acknowledgement`
2. `test(chat): cover joined-room history and rollback`

**Acceptance criteria:**

- Successful `joinRoom` data contains only the requested room and its latest 50 messages.
- Message order matches the chronological repository contract.
- A history failure does not leave a new room membership active.

## PR 10 — Announce first-user joins and counts

**Branch:** `feat/ws-join-presence`

**PR title:** `feat(chat): publish unique-user join presence`

**Goal:** Publish correct join notifications and active counts when a user first becomes active in a room.

**Description:** On the zero-to-one socket transition for a user, emit `roomNotification` to other room members and `roomUserCountUpdated` to authenticated clients. Generate notification text/time on the server. Additional tabs receive join success but produce neither duplicate notifications nor inflated counts.

**Files:**

- `packages/backend/src/modules/chat/chat-events.types.ts`
- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`
- `packages/backend/test/chatrooms.service.spec.ts`

**Estimated meaningful LOC:** 85–120

**Commits:**

1. `feat(chat): emit join notifications and unique counts`
2. `test(chat): prevent duplicate presence from extra sockets`

**Acceptance criteria:**

- Existing room members, but not the joining socket, receive one `user_joined` notification.
- All authenticated dashboards can receive the new unique-user count.
- Server identity and datetime cannot be supplied or spoofed by the client.
- A second socket for the same user leaves the count unchanged and emits no misleading join notice.

## PR 11 — Leave a room explicitly

**Branch:** `feat/ws-leave-room`

**PR title:** `feat(chat): add validated leaveRoom handling`

**Goal:** Remove a socket from a room and close logical membership on the user's final socket.

**Description:** Add `leaveRoom` validation and idempotent state cleanup. A valid member socket leaves the Socket.IO room immediately. On the last socket for that user, close membership history, notify remaining members, and publish the unique count; leaving one of multiple tabs performs only socket cleanup.

**Files:**

- `packages/backend/src/modules/chat/chat-events.types.ts`
- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`

**Estimated meaningful LOC:** 115–150

**Commits:**

1. `feat(chat): handle explicit room departure`
2. `test(chat): cover final-socket leave effects`

**Acceptance criteria:**

- Malformed/nonexistent rooms and nonmembers receive stable error acknowledgements.
- A member socket is removed from the Socket.IO room.
- Remaining members receive one `user_left` notification only after the user's final socket leaves.
- Membership history closes and the namespace-wide unique count updates.
- The departed socket no longer receives room broadcasts.

## PR 12 — Clean up unexpected disconnects

**Branch:** `fix/ws-disconnect-cleanup`

**PR title:** `fix(chat): reconcile room presence on disconnect`

**Goal:** Apply leave semantics to every room when a socket disappears unexpectedly.

**Description:** Implement `OnGatewayDisconnect` using the presence service's reverse socket index. Close only memberships that became inactive, emit room-scoped leave notifications to surviving sockets, and publish counts. Socket.IO performs transport-room removal; the application reconciles its own presence/history.

**Files:**

- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`

**Estimated meaningful LOC:** 105–140

**Commits:**

1. `fix(chat): clean application presence on disconnect`
2. `test(chat): cover disconnects reconnects and multiple tabs`

**Acceptance criteria:**

- Tab close, refresh, connection loss, and socket close all use disconnect cleanup.
- Every joined room gets a corrected count.
- Closing one of a user's multiple sockets does not close logical membership or announce a leave.
- Closing the last socket closes history and emits exactly one leave notice.
- A subsequent reconnect can open one clean membership interval.

## PR 13 — Validate, save, and broadcast sent messages

**Branch:** `feat/ws-send-message`

**PR title:** `feat(chat): add authoritative sendMessage delivery`

**Goal:** Accept valid messages only from current room members, persist them, and deliver the saved record to that room.

**Description:** Add `sendMessage` with strict payload validation, a 2,000-character limit, room existence/member checks, and server-owned identity/time. Persist first; only then emit `newMessage` through `server.to(room)`, including the sender. Failures use acknowledgement errors and never broadcast.

**Files:**

- `packages/backend/src/modules/chat/chat-events.types.ts`
- `packages/backend/src/modules/chat/chat.gateway.ts`
- `packages/backend/test/chat-gateway.spec.ts`

**Estimated meaningful LOC:** 135–150

**Commits:**

1. `feat(chat): validate persist and broadcast sendMessage`
2. `test(chat): enforce membership ownership and room isolation`

**Acceptance criteria:**

- Joined users can send trimmed nonempty messages of at most 2,000 characters.
- Nonmembers, nonexistent rooms, empty messages, wrong types, and overlong messages are rejected.
- Extra sender/timestamp fields are ignored; saved sender and time are server-derived.
- Persistence occurs before emission.
- Sender and other members of the correct room receive exactly one `newMessage`; unrelated rooms do not.
- A socket that left the room receives no later room messages.

## PR 14 — Gate the dashboard with a verified session

**Branch:** `feat/authenticated-dashboard`

**PR title:** `feat(frontend): show the dashboard only for valid sessions`

**Goal:** Transition successful logins to a dashboard boundary and prevent stale/invalid sessions from seeing it.

**Description:** Add a typed `/auth/me` client and a small dashboard page boundary. A just-completed login or a restored token must resolve the current identity before the dashboard renders. Failed restoration clears the token and returns to login; logout disconnect behavior is added later with the socket client.

**Files:**

- `packages/frontend/src/api/auth.ts`
- `packages/frontend/src/features/auth/AuthPage.tsx`
- `packages/frontend/src/features/chat/DashboardPage.tsx` (new)
- `packages/frontend/test/api/auth.spec.ts`
- `packages/frontend/test/features/auth/AuthPage.spec.tsx`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx` (new)

**Estimated meaningful LOC:** 125–150

**Commits:**

1. `feat(frontend): gate dashboard rendering by current user`
2. `test(frontend): reject invalid restored dashboard sessions`

**Acceptance criteria:**

- Successful login leads to a page headed `Welcome to LF-Chat`.
- A valid restored tab session reaches the same page after `/auth/me` succeeds.
- Missing, invalid, or expired sessions never render dashboard content and are cleared.
- The current user's email is displayed and logout returns to login.

## PR 15 — Render the database-backed room sidebar

**Branch:** `feat/dashboard-chatroom-sidebar`

**PR title:** `feat(frontend): render chatrooms from the protected API`

**Goal:** Build the basic two-column dashboard and load its sidebar rooms/counts from PostgreSQL via the API.

**Description:** Add the protected chatroom API client and render loading, error, empty, and populated sidebar states. Complete the simple semantic dashboard frame (header, sidebar, selected-room main area, message region, composer placeholder) with responsive CSS; do not hardcode room data in React.

**Files:**

- `packages/frontend/src/api/chatrooms.ts` (new)
- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/src/index.css`
- `packages/frontend/test/api/chatrooms.spec.ts` (new)
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 125–150

**Commits:**

1. `feat(frontend): load and render the room sidebar`
2. `test(frontend): cover room loading empty and error states`

**Acceptance criteria:**

- Room ID, name, and `numberOfUsers` come only from `GET /chatrooms`.
- Every room is a selectable button showing its active count.
- The requested sidebar/main/messages/input/send structure exists with simple responsive styling.
- Fetch errors are visible but do not expose the token.

## PR 16 — Connect one authenticated dashboard socket

**Branch:** `feat/dashboard-socket-session`

**PR title:** `feat(frontend): manage the authenticated chat socket lifecycle`

**Goal:** Connect Socket.IO while an authenticated dashboard is mounted and close it on logout/unmount.

**Description:** Add `socket.io-client` as a frontend runtime dependency and a small socket factory/hook. It uses the API origin plus the current session token, exposes connection status, relies on Socket.IO reconnection, and guarantees listener cleanup/disconnect when the dashboard session ends.

**Files:**

- `packages/frontend/package.json`
- `package-lock.json` (mechanical)
- `packages/frontend/src/realtime/chat-socket.ts` (new)
- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/test/realtime/chat-socket.spec.ts` (new)
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 105–140 (lockfile excluded)

**Commits:**

1. `feat(frontend): add authenticated Socket.IO client lifecycle`
2. `test(frontend): cover connect cleanup and token handoff`

**Acceptance criteria:**

- No socket is created for an unauthenticated page.
- The handshake uses only the token from `sessionStorage`.
- Dashboard unmount/logout removes listeners and disconnects the socket.
- Connection failures render a nonsecret status and leave logout usable.

## PR 17 — Select, switch, and rejoin rooms

**Branch:** `feat/dashboard-room-selection`

**PR title:** `feat(frontend): join the selected chatroom`

**Goal:** Make sidebar selection control server membership and the main room heading.

**Description:** Select the first loaded room by default, emit `joinRoom`, and render acknowledgement errors. Switching rooms waits for `leaveRoom` before joining the next room and clears stale timeline state. On Socket.IO reconnect, rejoin the selected room once so refresh/network recovery restores membership without duplicate client listeners.

**Files:**

- `packages/frontend/src/realtime/chat-events.types.ts` (new)
- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 115–145

**Commits:**

1. `feat(frontend): synchronize selected room membership`
2. `test(frontend): cover switching errors and reconnect joins`

**Acceptance criteria:**

- First room and clicked rooms are joined by stable ID, never by display name.
- The main area names only the currently selected room.
- Switching leaves the old room before joining the new one.
- Failed joins show an error and do not display the failed room as active.
- Reconnect joins the current room once.

## PR 18 — Display joined-room history

**Branch:** `feat/dashboard-chat-history`

**PR title:** `feat(frontend): display chat history from joinRoom`

**Goal:** Render the selected room's acknowledgement history with sender, text, and timestamp.

**Description:** Store only the successful `joinRoom` acknowledgement for the active selection and render accessible message items in chronological order. Ignore late acknowledgements from a previously selected room and clear history during switches to prevent cross-room leakage.

**Files:**

- `packages/frontend/src/realtime/chat-events.types.ts`
- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 80–115

**Commits:**

1. `feat(frontend): render selected-room message history`
2. `test(frontend): prevent stale and cross-room history display`

**Acceptance criteria:**

- Every history item displays sender, message, and formatted timestamp.
- The latest-50 server order is preserved.
- History from another or formerly selected room is never rendered.
- Empty history has a clear empty state.

## PR 19 — Send messages from the composer

**Branch:** `feat/dashboard-send-message`

**PR title:** `feat(frontend): send selected-room messages`

**Goal:** Make the dashboard input/send button issue valid `sendMessage` commands.

**Description:** Wire the controlled composer to the selected room. Trim for empty checks, cap input at 2,000 characters, prevent double submit while awaiting acknowledgement, clear only on success, and show safe server rejection text while retaining failed content for correction.

**Files:**

- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/src/index.css`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 90–125

**Commits:**

1. `feat(frontend): submit messages for the selected room`
2. `test(frontend): cover composer validation and acknowledgements`

**Acceptance criteria:**

- Submit payload contains only `chatroomId` and `message`.
- Empty/whitespace input cannot be submitted; UI enforces the 2,000-character convenience limit.
- Successful acknowledgement clears the input; failure retains it and displays an error.
- The client never supplies sender identity or timestamp.

## PR 20 — Receive live room messages

**Branch:** `feat/dashboard-live-messages`

**PR title:** `feat(frontend): append live messages for the active room`

**Goal:** Append `newMessage` events only to the currently selected room timeline.

**Description:** Register one scoped listener, filter defensively by active room ID, append saved server records, and de-duplicate by message ID against history and prior events. Remove the listener during socket/session cleanup and keep the timeline chronological.

**Files:**

- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 80–115

**Commits:**

1. `feat(frontend): append active-room newMessage events`
2. `test(frontend): filter and deduplicate live messages`

**Acceptance criteria:**

- Sender and peers see the authoritative saved message once.
- Events for unrelated rooms are ignored.
- A race between history and a live event does not duplicate a message.
- Switching/leaving prevents later old-room events from appearing.

## PR 21 — Display transient room notifications

**Branch:** `feat/dashboard-room-notifications`

**PR title:** `feat(frontend): render join and leave notifications`

**Goal:** Show nonpersisted join/leave notices in the active room timeline.

**Description:** Listen for `roomNotification`, filter by active room, and render an accessible system-style timeline item distinct from chat messages. Notifications remain local/transient and are cleared on room switch; they are never added to history or sent through `sendMessage`.

**Files:**

- `packages/frontend/src/realtime/chat-events.types.ts`
- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/src/index.css`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`

**Estimated meaningful LOC:** 80–115

**Commits:**

1. `feat(frontend): render transient room notifications`
2. `test(frontend): isolate join and leave notices by room`

**Acceptance criteria:**

- `user_joined` and `user_left` show server message/identity/time as system content.
- Notifications are visually/semantically distinct from persisted chat messages.
- Other-room and post-switch notifications are ignored.
- Reloading history does not restore notifications.

## PR 22 — Keep sidebar counts live

**Branch:** `feat/dashboard-active-counts`

**PR title:** `feat(frontend): update unique room counts in real time`

**Goal:** Reconcile initial REST counts with `roomUserCountUpdated` events.

**Description:** Add one dashboard listener that updates only the matching catalog item by stable room ID. Preserve unknown-room safety and listener cleanup. Add a focused Playwright scenario that mocks login/catalog/socket transitions and proves the visible count changes without a refetch.

**Files:**

- `packages/frontend/src/features/chat/DashboardPage.tsx`
- `packages/frontend/test/features/chat/DashboardPage.spec.tsx`
- `packages/frontend/test/browser/chat-dashboard.spec.ts` (new)

**Estimated meaningful LOC:** 90–125

**Commits:**

1. `feat(frontend): apply live unique-user room counts`
2. `test(frontend): verify real-time dashboard count updates`

**Acceptance criteria:**

- Initial counts come from `GET /chatrooms`.
- Join, explicit leave, and unexpected disconnect updates appear without refetching.
- Counts represent unique users across multiple tabs/sockets.
- Unknown room updates are ignored and no count can become negative in the UI.

---

## Coverage map

| Required behavior | Primary PR/test level |
| --- | --- |
| Database chatroom load and duplicate-name rejection | PRs 1–2, PostgreSQL integration |
| Protected chatroom catalog | PR 4, controller/service plus auth integration |
| Authenticated/nonexistent/idempotent join | PR 8, gateway unit and socket integration |
| Membership history and reconnect safety | PRs 5, 8, 12, database plus gateway |
| Unique counts and multiple sockets | PRs 3, 10–12, unit/gateway |
| Join/leave notifications | PRs 10–12 and 21, gateway/component |
| Member leave and no later delivery | PRs 11 and 13, gateway |
| Message validation, anti-spoofing, persistence, room isolation | PRs 6 and 13, database/gateway |
| Latest 50, chronological order, no cross-room history | PRs 7, 9, and 18, repository/gateway/component |
| Unexpected disconnect cleanup | PR 12, gateway/socket integration |
| Auth-only dashboard | PR 14, API/component/Playwright session coverage |
| Database-backed sidebar and selected room | PRs 15 and 17, API/component |
| Composer, live delivery, notifications, and count rendering | PRs 19–22, component plus focused Playwright |

## Explicitly excluded from all PRs

Private messaging, reactions, typing indicators, read receipts, uploads, voice/video, message edits/deletes, moderation, presence states, search, advanced pagination, Redis, horizontal Socket.IO scaling, profile/username editing, broad refactors, and unrelated formatting.
