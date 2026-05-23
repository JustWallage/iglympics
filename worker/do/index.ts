export { ScoreboardDO } from "./ScoreboardDO";
export { ChessGameDO } from "./ChessGameDO";

export default {
  async fetch(): Promise<Response> {
    return new Response("This Worker only hosts Durable Objects", {
      status: 200,
    });
  },
};
