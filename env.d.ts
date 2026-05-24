/// <reference types="vite/client" />

interface Env {
  DB: D1Database;
  AI: Ai;
  SCOREBOARD_DO?: DurableObjectNamespace;
  CHESS_GAME_DO?: DurableObjectNamespace;
  RACING_GAME_DO?: DurableObjectNamespace;
  STORY_IMAGES: R2Bucket;
  JWT_SECRET: string;
  ADMIN_NAMES: string;
  ALLOW_TEST_RESET?: string;
  USERS_JSON?: string;
}

type CFEventContext = EventContext<Env, string, unknown>;
