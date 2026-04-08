export class ScoreboardDO implements DurableObject {
  private sessions: Set<WebSocket> = new Set();

  constructor(
    private state: DurableObjectState,
    private _env: Env,
  ) {
    // Restore any WebSockets that were hibernating
    for (const ws of this.state.getWebSockets()) {
      this.sessions.add(ws);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      this.state.acceptWebSocket(server);
      this.sessions.add(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    // Handle broadcast from Pages Functions
    if (url.pathname === "/broadcast" && request.method === "POST") {
      const message = await request.text();
      this.broadcast(message);
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {
    // Clients don't send messages in this design; server-push only
  }

  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  private broadcast(message: string): void {
    for (const ws of this.sessions) {
      try {
        ws.send(message);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
