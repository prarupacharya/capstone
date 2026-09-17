# ADR 0005: LF-Chat architecture and real-time communication

Date: 2026-09-15

## Status

Accepted

## Context

LF-Chat needs secure accounts, persistent chatrooms and messages, live updates, and a way to recover after disconnection. These are the main architecture choices in the current application.

## Decisions

### 1. Separate the frontend, backend, and database work

**Decision:** Use a private npm workspace with a React/Vite frontend and a NestJS backend. Backend controllers and the socket gateway handle requests and events; services coordinate behavior; repositories handle SQL. Frontend hooks separately manage the room list, socket, active room, feed, counts, and composer.

**Why:** Each part has one clear responsibility. Chat behavior can be tested without a full browser or live socket, and root scripts can check both packages together.

### 2. Use HTTP for ordinary requests and Socket.IO for live chat

**Decision:** HTTP handles registration, login, session checks, room listing and creation, health, and metrics. Socket.IO handles `joinRoom`, `leaveRoom`, and `sendMessage` with success or error acknowledgements. It delivers `newMessage`, `roomNotification`, and `roomUserCountUpdated` events. Each chatroom maps to a Socket.IO room. The browser allows Socket.IO to start with polling and upgrade to WebSocket.

**Why:** Account and catalog requests need one response; chat needs two-way, room-specific updates. Short polling adds repeated requests and delivery delay. Long polling still needs repeated connections and retry logic. SSE is one-way. Raw WebSockets would require us to build room routing, acknowledgements, and reconnection. Socket.IO provides those behaviors.

### 3. Authenticate HTTP and sockets separately

**Decision:** A global JWT guard protects private HTTP routes; registration and login are public. Registration hashes passwords and returns no token. Login checks bcrypt hashes and issues a short-lived JWT. The browser keeps the token in tab `sessionStorage` and checks it with `GET /auth/me` on reload. The Socket.IO handshake verifies the JWT before connecting. Each room command then validates its input and room access. HTTP DTO validation transforms input and rejects unknown fields.

**Why:** An HTTP guard cannot protect a socket connection. Both the connection and each command need checks before a user joins or sends to a room. Checking `/auth/me` on reload also prevents the browser from trusting a stored but invalid token.

### 4. Keep durable state in PostgreSQL

**Decision:** PostgreSQL stores users, rooms, membership history, and messages. The backend uses one connection pool and runs migrations on startup. Database constraints enforce unique emails and room names regardless of case, one active membership per user and room, and valid message length. Membership changes use transactions and conflict-safe inserts. Room lists calculate the caller's membership and count active membership rows.

**Why:** This data must survive a socket disconnect or process restart. Database constraints protect against concurrent requests that application validation alone cannot safely handle. Membership rows record join and leave history. Room counts include offline members because they count memberships, not connected sockets.

### 5. Keep membership separate from socket presence

**Decision:** `joinRoom` checks the room, opens a membership if needed, joins the socket to the Socket.IO room, records it in `RoomPresenceService`, and returns recent messages. Joining again does not create a second active membership or notice. Explicit `leaveRoom` closes the membership, removes that user's known sockets from the room, and sends a notice and updated count. Disconnect only clears socket presence. Selecting another room does not leave the first one.

**Why:** A refresh or network failure should not remove someone from a room. The user can reconnect without creating another membership or increasing the count. Notices describe explicit membership changes; counts come from PostgreSQL.

### 6. Save a message before broadcasting it

**Decision:** `sendMessage` requires the sender's current socket to have joined the target room. The gateway validates the room and trimmed message (1–2,000 characters), saves it, then broadcasts the saved record to that room, including the sender. If saving fails, it returns an error acknowledgement and sends nothing. `joinRoom` returns the latest 50 saved messages, ordered for display.

**Why:** Clients should not see a message that failed to persist. Checking the exact socket prevents another socket with the same user account from sending into a room it has not joined. The 50-message limit gives reconnecting clients recent history without loading every message.

### 7. Restore the browser view from the server

**Decision:** The frontend keeps its room list, connection, selection, feed, and draft as separate state. A new room join requires confirmation and a successful acknowledgement. After reconnect, the selected room is joined again and its saved history replaces the visible feed. Disconnect clears the feed and blocks sending. The feed accepts events only for the selected room and ignores repeated message IDs. A newly created room is added to the creator's local list.

**Why:** PostgreSQL owns messages and membership; the browser holds a temporary view. Rejoining rebuilds that view after a connection break instead of assuming its old state is still current.

### 8. Expose logs, metrics, and health

**Decision:** HTTP middleware accepts or creates a safe `X-Correlation-ID`, returns it to the caller, and writes structured JSON logs. The gateway logs connections, rejections, disconnects, and command results. Public `/metrics` reports HTTP request counts, errors, and duration. Public `/health` checks backend status and runs PostgreSQL `SELECT 1`.

**Why:** These signals help trace failed requests, inspect socket outcomes, and check whether the database is reachable.

## Consequences

- Users receive room-specific messages and membership updates without repeatedly requesting them. Command acknowledgements let the browser show success or failure.
- Messages and memberships survive disconnects and restarts. Reconnecting sockets must join their selected room again and reload recent history; offline members still count as room members.
- A message is delivered only after PostgreSQL saves it. If the database write fails, the sender gets an error and no room broadcast occurs.
- The live connection adds reconnect and socket authorization paths that need their own tests and monitoring alongside the HTTP API.
