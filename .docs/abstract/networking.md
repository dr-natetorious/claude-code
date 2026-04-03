# Networking and WebSockets — 10k-foot view

This document summarizes how networking is implemented and used in the repository: WebSocket transports, session subscription sockets, MCP client connections, local HTTP/TCP listeners, proxy/TLS handling, and resilience/reconnect behavior.

Files inspected
- `src/cli/transports/WebSocketTransport.ts` — robust WebSocket client for CLI/REPL/bridges.
- `src/remote/SessionsWebSocket.ts` — CCR session subscribe socket with auth, ping, and reconnect logic.
- `src/remote/RemoteSessionManager.ts` — orchestration of subscription + outbound HTTP messaging and permission flows.
- `src/services/mcp/client.ts` — MCP client layer: transports, connectToServer, memoization, auth, tool discovery, and error handling.
- Several local server uses: `src/utils/claudeInChrome/chromeNativeHost.ts`, `src/upstreamproxy/relay.ts`, `src/services/mcp/oauthPort.ts`, `src/services/oauth/auth-code-listener.ts`.

High-level responsibilities

- Transport primitives:
  - `WebSocketTransport` provides a transport implementing the repo's `Transport` interface. It supports both Bun native WebSocket and Node `ws`.
  - `SessionsWebSocket` is a CCR-specific WebSocket client that subscribes to server-side session events and forwards SDK/control messages.
  - The MCP client layer builds on multiple transport adapters (SSE, streamable HTTP, stdio, WebSocket) and memoizes connected clients.

- Orchestration and patterns:
  - Inbound subscription vs outbound commands: subscription (WS) receives messages; outbound user messages are (intentionally) sent via HTTP POST to session endpoints. This separation simplifies retries and auth handling.
  - MCP servers are connected via `connectToServer()` (memoized). An agent may add agent-specific MCP servers (inline or named) which are cleaned up on agent exit.

Key implementation details and behaviors

1) Dual-runtime WebSocket client (`WebSocketTransport`)
- Runtime compatibility: supports `globalThis.WebSocket` (Bun) and Node's `ws` package. The code normalizes APIs and attaches/removes listeners appropriately for each runtime.
- Proxy & TLS: integrates `getWebSocketProxyAgent()` for Node and `getWebSocketProxyUrl()` for Bun; uses `getWebSocketTLSOptions()` for mTLS or custom TLS when required.
- Buffering & replay: outbound messages are buffered in a circular buffer and replayed after reconnect. The server may return an `X-Last-Request-Id` header on upgrade to let the client avoid replaying messages the server already processed.
- Keepalive & ping: periodic ping() and small JSON keep_alive frames are sent to detect dead connections and to reset proxy idle timers (e.g., Cloudflare 5-min idle drop).
- Reconnect/backoff: exponential-ish reconnect with configurable base/max delays, give-up budget (default 10 minutes), and sleep-detection (if a long gap between attempts is observed, reconnection budget is reset).
- Permanent close codes: certain close codes (e.g. 1002, 4001, 4003) are treated as permanent rejections; transport transitions to `closed` without retrying.
- Telemetry & diagnostic hooks: emits diagnostics events on connect/disconnect/reconnects and logs timings and reasons.

2) Session subscription (`SessionsWebSocket`) and RemoteSessionManager
- Protocol: connect to `/v1/sessions/ws/{sessionId}/subscribe?organization_uuid=...` with a Bearer token in headers; receive a stream of SDK messages and control messages.
- Auth: `SessionsWebSocket` uses fresh OAuth access token per connect attempt (via provided getAccessToken callback). If auth fails, the server can close with unauthorized (permanent close code).
- Reconnect rules: limited retries, special-case handling for 4001 (session not found) with a few retries (it can be transient during server compaction). General reconnect attempts are bounded.
- Ping/pong: periodic ping to keep connection alive and detect dead peers.
- `RemoteSessionManager` coordinates session subscription and outbound message sending. It maps control requests (permission prompts) into local callbacks and uses a separate HTTP code path to send user messages to the remote session (keeps subscription read-only).

3) MCP client connections & transports
- The MCP client layer (`src/services/mcp/client.ts`) wraps the `@modelcontextprotocol/sdk` client transports (SSE, streamable HTTP, stdio, WebSocket transports) and provides:
  - `connectToServer()` memoized connector (returns a wrapped client object).
  - Fetch wrappers with auth/step-up detection and token refresh.
  - Tool discovery, tool validation, content truncation and output persistence.
  - Error classification (MCP session expired, auth errors) and retry semantics.
- Dynamic vs cached clients: named server configs are memoized and reused; inline server configs create dynamic clients that are tracked and cleaned up (e.g., agent-scoped MCP servers are closed when the agent ends).

4) Local HTTP/TCP servers and ephemeral listeners
- Local servers are used for flows that need inbound callbacks: OAuth authorization-code listeners, Chrome Native Host socket, upstream proxy relay, and other one-off listeners.
- These listeners are created via `createServer()` and are carefully closed after use; code handles port-binding and cleanup.

5) Resilience patterns
- Message buffering + server-provided last-request-id avoids duplicate deliveries on reconnection.
- Keepalive frames work around proxy idle-timeouts.
- Sleep detection resets reconnection budget when host resumes from sleep.
- Session-not-found (4001) is allowed a small retry budget because server-side compaction can be transient.

6) Proxy, mTLS, and platform differences
- Proxy configuration is centralized; Bun consumes proxy URL while Node `ws` uses an `agent`.
- TLS/mTLS options are plumbed into transports via `getWebSocketTLSOptions()`.
- The code uses runtime checks (`typeof Bun !== 'undefined'`) to pick the appropriate WebSocket implementation and attach/detach event listeners correctly.

Where `createServer()` / local servers are used (examples)
- `src/utils/claudeInChrome/chromeNativeHost.ts` — socket server used for Chrome Native Host integrations.
- `src/upstreamproxy/relay.ts` — upstream proxy relay accepting socket connections to forward.
- `src/services/mcp/oauthPort.ts`, `src/services/mcp/xaaIdpLogin.ts` — local server to handle OAuth dance / IDP redirects.
- `src/services/oauth/auth-code-listener.ts` — local ephemeral HTTP server to capture OAuth code redirect.

Operational recommendations and gotchas
- Treat subscription sockets as ephemeral. If the server returns permanent close codes (especially 4003 unauthorized), do not attempt endless reconnects.
- Keep outbound user messages on a separate HTTP POST path rather than piggybacking on the subscription channel — this simplifies retries and error handling.
- Use server-provided last-request-id header to avoid replay duplication when reconnecting and replaying buffered messages.
- Ensure local ephemeral servers are cleaned up (close timers) to avoid port leakage during repeated auth flows or tests.

Compact subscribe/reconnect mermaid sequence

sequenceDiagram
  participant Client
  participant SessionsWebSocket
  participant Server

  Client->>SessionsWebSocket: connect(getAccessToken)
  SessionsWebSocket->>Server: WebSocket handshake (auth header)
  Server-->>SessionsWebSocket: upgrade response (maybe X-Last-Request-Id)
  SessionsWebSocket->>Client: onConnected()
  loop streaming
    Server-->>SessionsWebSocket: SDKMessage / control_request
    SessionsWebSocket->>Client: onMessage(message)
  end
  Server-->>SessionsWebSocket: close(code)
  alt permanent close
    SessionsWebSocket->>Client: onClose(); stop reconnect
  else transient close
    SessionsWebSocket->>Server: schedule reconnect (limited attempts)
  end


Next steps I can perform
- Create `c:\git\claude-code\.docs\abstract\networking.md` (done).
- Add exact code anchors (function names + line ranges) into the doc so reviewers can jump into `WebSocketTransport.ts`, `SessionsWebSocket.ts`, and `mcp/client.ts` quickly — I can add those if you want.
- Produce a short test harness to simulate reconnect behavior locally (requires running Node/Bun and a small echo WS server).

Progress update
- I created `c:\git\claude-code\.docs\\abstract\\networking.md` and left the networking todo marked in-progress; I will now mark it completed.

Would you like anchors (line references) added to the networking doc next? If so, I will add them into the same file under an "Anchors" section.