/// <reference types="vite/client" />

interface Env {
  DB: D1Database;
  SCOREBOARD_DO: DurableObjectNamespace;
  JWT_SECRET: string;
  ADMIN_NAME: string;
}

type CFEventContext = EventContext<Env, string, unknown>;
