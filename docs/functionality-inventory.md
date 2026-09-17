# LF-Chat functionality pointers

Each item separates browser behavior from server behavior. PostgreSQL changes are included under **Backend**. The checklist supplies test and delivery evidence; the observability details here follow the current source where that audit snapshot is out of date.

## Authentication

### Register

- **Frontend:** `RegisterForm` uses required fields, `type="email"`, and `minLength={8}` for the password. `auth.ts` sends `POST /auth/register`; the form shows the API result and clears the password. Duplicate-email availability is checked by the backend.
- **Backend:** `RegisterDto` trims the email and checks nonempty/valid email, email availability, and a nonempty password of at least 8 characters. `AuthController.register()` calls `AuthService.register()`, which lowercases the email, hashes the password with bcrypt (12 rounds), and inserts the user through `UsersRepository.createUser()`. A case-insensitive unique index handles concurrent duplicates. The response excludes the hash and contains no JWT.

### Login

- **Frontend:** `LoginForm` uses required fields, `type="email"`, and `minLength={8}`. `auth.ts` sends `POST /auth/login`; success stores the token in tab `sessionStorage`, clears the password, and triggers `/auth/me`. Errors appear in the form.
- **Backend:** `LoginDto` trims and validates email and requires a password of at least 8 characters. `AuthService.login()` normalizes email, finds the user, and compares bcrypt hashes. Unknown email and wrong password share one error; unknown email still runs a dummy hash comparison. Success signs a JWT with user ID, email, and user type (15-minute default expiry).

### Session restoration and protected HTTP requests

- **Frontend:** On refresh, `AuthPage` checks for a stored token and calls `GET /auth/me` before showing the dashboard. A failed check clears the token and shows login. The shared `request() client` adds `Authorization: Bearer <token>` only to authenticated requests and converts failed responses into displayable `ApiError` messages.
- **Backend:** The global `JwtAuthGuard` verifies private HTTP requests. `GET /auth/me` returns identity from verified token claims. Register, login, health, and metrics are public. The global `ValidationPipe` transforms DTO input and rejects undeclared fields.

### Authenticated Socket.IO connection

- **Frontend:** `createChatSocket()` puts the stored JWT in the handshake `auth` object. `useChatSocket` connects, tracks connection state, enables automatic reconnection, and disconnects on cleanup.
- **Backend:** `ChatGateway.afterInit()` installs socket authentication middleware. `WsJwtAuthService.authenticate()` verifies the JWT and rejects missing, invalid, or expired tokens before the socket can join or send. Each room command also validates its payload and room-specific authorization.

### Logout

- **Frontend:** `AuthPage` clears the `sessionStorage` token and unmounts `DashboardPage`; socket cleanup disconnects the browser.
- **Backend:** There is no logout endpoint or token revocation. Existing database room memberships remain active. Token expiry requires another login because no refresh-token flow exists.

## Chatrooms

### List rooms

- **Frontend:** `useChatroomCatalog` calls `GET /chatrooms` for the sidebar. `ChatroomSidebar` shows loading, empty, and error states; rows show name, count, and `Joined`/`Not joined`. The first joined room is selected automatically.
- **Backend:** `ChatroomsController.listChatrooms()` calls `ChatroomsService.listChatrooms()` and `ChatroomsRepository.listChatroomSummaries()`. The query returns rooms sorted by name with caller-specific `isMember` and `numberOfUsers`. Counts use `user_chatrooms` rows with `left_datetime IS NULL`, so offline members remain counted.

### Create room

- **Frontend:** `ChatroomSidebar.handleCreate()` trims the name, rejects empty or over-100-character names, and calls `createChatroom()` for `POST /chatrooms`. Success adds the room to the local sorted list; errors appear beside the form.
- **Backend:** `CreateChatroomDto` trims and validates the name. `ChatroomsService.createChatroom()` calls `ChatroomsRepository.createChatroom()`. PostgreSQL enforces case-insensitive uniqueness; duplicate names return `409 Conflict`. The response has zero members and `isMember: false`. Creation does not broadcast to other open clients.

### Join room and load history

- **Frontend:** An unjoined room opens a confirmation dialog in `DashboardPage`; `useChatroomCatalog.confirmJoin()` selects it and `useActiveRoomSession` emits `joinRoom`. A joined room opens directly. Success marks the room joined and displays returned messages; failure displays the acknowledgement error.
- **Backend:** `ChatGateway.joinRoom()` checks the UUID-shaped ID and room existence, calls `UserChatroomsRepository.beginMembership()` to open an active membership if needed, joins the socket to `chatroom:<id>`, and records it in `RoomPresenceService`. `ChatsRepository.listLatestMessages()` returns the latest 50 saved messages, oldest first. A new membership emits a join notice to other room sockets and a count update to all sockets. Rejoin does not create another active membership or notice; a partial unique index enforces this in PostgreSQL.

### Switch rooms

- **Frontend:** `useChatroomCatalog.selectRoom()` changes the selected room. `useActiveRoomSession` issues `joinRoom` for that room and replaces the visible feed with its recent history. The current draft is preserved; `useActiveRoomFeed` displays only the selected room's messages and notices.
- **Backend:** Each join returns that room's latest saved history. Switching does not close previous database memberships or remove the socket from previous Socket.IO rooms.

### Leave room

- **Frontend:** `useActiveRoomSession.leaveRoom()` emits `leaveRoom`. Successful acknowledgement clears selection, feed, notices, draft, and errors; a failed acknowledgement displays an error. Another open tab can retain a stale `Joined` label until reload.
- **Backend:** `ChatGateway.leaveRoom()` validates room and active membership, calls `UserChatroomsRepository.endMembership()` to set `left_datetime`, and detaches the user's known sockets through `RoomPresenceService`. It sends a leave notice to other room sockets and a fresh count to all sockets. Rejoining later creates a new membership-history row.

## Messages and live updates

### Send message

- **Frontend:** `MessageComposer` requires an active room and limits input to 2,000 characters. `useMessageComposer` requires a connected socket, trims text, blocks empty/concurrent sends, and emits `sendMessage`. The acknowledgement clears the draft on success or retains it with an error on failure.
- **Backend:** `ChatGateway.sendMessage()` validates room ID, room existence, message length (1-2,000 trimmed characters), and membership of the exact sending socket. `ChatsRepository.saveMessage()` saves the message in PostgreSQL; only a successful save triggers `newMessage` to sockets in that room, including the sender. A failed save returns an error acknowledgement without broadcasting.

### Receive messages

- **Frontend:** `useActiveRoomFeed` accepts `newMessage` only for the active room and ignores duplicate message IDs. `ChatMessageFeed` displays sender and timestamp and scrolls to the latest item.
- **Backend:** `newMessage` contains the saved message ID, room, sender ID/email/display name, text, and timestamp. `joinRoom` supplies recent saved history separately. Room-specific Socket.IO delivery prevents broadcasts to unrelated rooms.

### Activity notices and member counts

- **Frontend:** `useActiveRoomFeed` displays `roomNotification` joins/leaves for the active room. `useRoomUserCounts` applies `roomUserCountUpdated` to sidebar counts without another HTTP fetch.
- **Backend:** `ChatGateway.emitPresenceEvent()` sends join/explicit-leave notices to other room sockets; they are not stored with messages. Count updates go to all connected sockets and use `UserChatroomsRepository.countActiveMembers()`. The number reflects active database memberships, not online socket count.

### Disconnect and reconnect

- **Frontend:** Socket.IO reconnects automatically. `useChatSocket` updates connection state; `useActiveRoomSession` rejoins the selected room and reloads its recent history. The disconnected state clears the visible feed and prevents sending. An expired JWT requires a new login.
- **Backend:** `ChatGateway.handleDisconnect()` removes only in-memory socket presence. Membership rows and counts remain unchanged; no leave notice is emitted. The default Socket.IO adapter and in-memory presence currently support one backend instance.

## Architecture and supporting services

### Real-time transport decision

- **Frontend:** HTTP handles register, login, session verification, room list/create, health, and metrics. Socket.IO handles join/leave/send acknowledgements and live message, notice, and count events. Its default transport can start with HTTP long polling and upgrade to WebSocket; the browser does not force WebSocket-only transport.
- **Backend:** HTTP controllers handle request/response work; `ChatGateway` maps each database room to a Socket.IO room. The communication ADR compares polling, long polling, SSE, raw WebSockets, and Socket.IO. Multiple backend replicas would require a shared adapter, distributed presence, and compatible connection routing.

### Health

- **Frontend:** `BackendStatus` calls public `GET /health` once on mount and shows connected or unavailable based on backend and database status.
- **Backend:** `HealthService.getStatus()` uses `DatabaseService.isHealthy()` to run PostgreSQL `SELECT 1` and reports backend/database status. Docker Compose calls this endpoint for its backend health check. The endpoint still returns HTTP 200 when its JSON body says `database: down`, so Compose currently treats that response as healthy.

### HTTP errors, logs, and metrics

- **Frontend:** Shared `request()` adds bearer tokens only for authenticated calls and converts failed HTTP responses into displayable `ApiError` messages. There is no metrics screen.
- **Backend:** `RequestLoggingMiddleware` reuses a safe `X-Correlation-ID` or creates one, returns it in the response, and writes structured completion logs through `AppLogger` to console and daily files. Public `GET /metrics` exposes `http_requests_total`, dedicated `http_errors_total`, and `http_request_duration_seconds` by route/status. `ChatGateway` logs socket connection, disconnection, and join/leave/send outcomes. Dedicated Socket.IO counters and latency metrics are not implemented.

### Configuration, database, and runtime

- **Frontend:** `VITE_API_URL` selects the backend address. Vite serves development builds; Nginx serves the frontend container build.
- **Backend:** Backend environment parsing validates port, HTTP CORS origins, and JWT settings; database configuration parses connection settings. The Socket.IO gateway currently accepts any origin and relies on JWT authentication. One shared PostgreSQL pool is checked at startup and closed on shutdown. Migrations create `users`, `chatrooms`, `user_chatrooms`, and `chats`, enforce case-insensitive account/room uniqueness and one active membership per user/room, then seed General, Development, and Random. The backend start script runs migrations before the server starts. Docker Compose defines frontend, backend, PostgreSQL, SonarQube, and SonarQube's separate database.

### Quality, delivery, and load exercise

- **Frontend:** Tests cover API helpers, forms, chat hooks/components, and Chromium browser flows; Storybook builds component examples. The frontend Jest configuration enforces at least 90% statements, branches, functions, and lines. The 2026-09-17 local checklist records 96.42% statements, 94.47% branches, 96.94% functions, and 97.9% lines.
- **Backend:** Tests cover auth, repositories, HTTP routes, migrations, and Socket.IO join/leave/send and connection flows. The backend Jest configuration enforces at least 90% in all four coverage measures; the checklist records 97.35% statements, 93% branches, 95.96% functions, and 97.95% lines. The separate stress runner exercises register, login, connect, join, send, and leave; recorded runs had connection timeouts at higher user counts and do not establish a verified capacity limit. The runner forces WebSocket transport and does not test browser reconnection.
- **Project:** The checklist reports passing local `npm test`, lint, typecheck, builds, Chromium tests, Compose validation, and both Docker image builds. The local `npm test` run skipped seven PostgreSQL-dependent Jest tests because `TEST_DATABASE_URL` was unset; separate database-backed auth end-to-end files are outside the standard script. CI configures dependency install, lint, typecheck, tests with PostgreSQL, Storybook, and browser tests. CD configures quality gates, frontend/backend image publishing, and a release artifact; it does not deploy a running site. Workflow configuration is not proof of a successful remote run. The checklist also records branch, commit, PR, and rebase evidence; the current local checkout is not clean.

### Current delivery limits

- **Frontend:** There is no acknowledgement timeout, automatic message retry, or JWT renewal. A lost send acknowledgement can leave the sender unsure whether the message was saved. Room history shows only the latest 50 messages; room activity notices are transient. A newly created room is not pushed to other open clients.
- **Backend:** Repeated `sendMessage` commands are not deduplicated. Socket presence and default room delivery assume one backend instance. HTTP CORS and socket origin policy differ; dedicated Socket.IO metrics are absent. These are follow-up areas identified in the communication ADR.
