# Use Socket.IO WebSockets for authenticated real-time chat

Date: 2026-09-15

## Status

Accepted

## Context

The project is a full-stack, room-based chat application built as an npm monorepo. The React and Vite frontend supports registration, login, room discovery, room membership, message history, and live conversations. The NestJS backend owns authentication, validation, authorization, persistence, health checks, metrics, and message distribution. PostgreSQL stores users, chat rooms, memberships, and chat messages, while Docker Compose and GitHub Actions provide consistent local and automated environments.

Chat delivery has different requirements from the project's request-and-response operations. Registration, login, room discovery, health checks, and metrics fit HTTP because a client initiates each operation and expects one response. Active conversations require a long-lived, bidirectional channel: clients must send room commands and messages while receiving new messages, presence notifications, and room user-count updates immediately without repeatedly requesting the same data.

The communication strategy must:

- authenticate every live connection with the same JWT identity model used by the HTTP API;
- isolate broadcasts so that a room receives only its own messages;
- support `joinRoom`, `leaveRoom`, and `sendMessage` commands with explicit acknowledgements and errors;
- persist a valid message before publishing it, so clients do not display messages that the system failed to store;
- reconnect after temporary network interruptions and clean up transient presence on disconnect;
- integrate with the existing NestJS and React applications and remain testable in CI and Docker Compose; and
- provide sufficiently low latency without unnecessary polling traffic.

The main alternatives considered were short or long polling, Server-Sent Events (SSE), raw WebSockets, and Socket.IO over WebSockets. Polling is simple and universally understood, but it adds repeated HTTP and database work, introduces polling-delay latency, and becomes increasingly inefficient as the number of rooms and connected users grows. Long polling reduces empty responses but still requires repeated connection turnover and custom retry and ordering behavior. SSE provides efficient server-to-client updates but is one-way, so room commands and outgoing messages would still require a separate HTTP path. Raw WebSockets provide bidirectional communication with minimal protocol overhead, but would require the project to implement reconnection, acknowledgements, event routing, room membership, and transport edge cases itself.

## Decision

Use Socket.IO's WebSocket-based, bidirectional event model for real-time chat, implemented through a NestJS Gateway on the backend and `socket.io-client` on the React frontend. Keep HTTP for registration, login, chat-room discovery, health, and metrics; use the Socket.IO connection only for live room participation and messaging.

The client supplies its access token in the Socket.IO handshake. The gateway verifies the JWT before accepting the connection and stores the authenticated user identity on the socket. Unauthenticated connections are rejected. The gateway validates each event payload and returns a structured acknowledgement for success or failure.

Each chat room maps to a Socket.IO room. A client must successfully emit `joinRoom` before it can send messages to that room. Joining verifies that the room exists, records membership, attaches the socket to the Socket.IO room, and returns recent message history. `leaveRoom` ends the membership and detaches all relevant sockets for that user. Disconnect handling removes transient in-memory presence.

For `sendMessage`, the server verifies the room, confirms that the authenticated socket is currently present, trims and validates the message, and limits it to 2,000 characters. The message is written to PostgreSQL before the gateway broadcasts `newMessage` to that room. The gateway also emits room presence notifications and user-count updates. The frontend owns connection lifecycle state, enables Socket.IO reconnection, subscribes to server events, and removes listeners when the React component lifecycle ends.

The initial deployment uses one backend instance and in-memory live-presence tracking. Persistent application data remains in PostgreSQL. If the backend is scaled horizontally, a shared Socket.IO adapter and distributed presence mechanism, such as Redis, must be introduced so room broadcasts and presence remain consistent across instances.

## Consequences

Users receive messages and room updates immediately through one long-lived connection, and clients do not generate continuous polling traffic. Socket.IO rooms provide a direct boundary for room-specific broadcasts, while event acknowledgements give the UI a consistent way to handle validation, authorization, and persistence failures. Reusing JWTs keeps HTTP and WebSocket identity consistent. Persisting before broadcasting makes PostgreSQL the durable source of truth and allows a joining or reconnecting client to recover recent history.

The system now maintains connection state in addition to ordinary HTTP request state. The frontend and backend must handle reconnects, duplicate lifecycle events, stale tokens, disconnect cleanup, and temporary loss of service. Automated tests must cover handshake authentication, room isolation, membership rules, message validation, persistence ordering, acknowledgements, and reconnection behavior.

Socket.IO adds client and server dependencies and a small protocol overhead compared with raw WebSockets. Clients must use a compatible Socket.IO protocol rather than an arbitrary WebSocket client. Infrastructure must also support connection upgrades, long-lived connections, suitable timeouts, and sticky sessions or a shared adapter when multiple backend replicas are used.

The current in-memory presence model is intentionally limited to a single backend instance and is not durable across restarts. This is acceptable for the present capstone deployment, but horizontal scaling requires Redis-backed fan-out and shared presence before adding replicas. Operational monitoring must continue to use structured logs with correlation information, the `/health` database check, and `/metrics`; WebSocket-specific connection, event, error, and latency metrics should be added as production load and reliability requirements increase.
