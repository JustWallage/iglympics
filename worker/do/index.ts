export { ScoreboardDO } from "./ScoreboardDO";

export default {
  async fetch(): Promise<Response> {
    return new Response("This Worker only hosts Durable Objects", {
      status: 200,
    });
  },
};
