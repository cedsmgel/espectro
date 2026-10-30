import { ChatRoom } from "../../src/durable_objects/ChatRoom";
export { ChatRoom };

export default {
  async fetch(request: Request, env: any) {
    return new Response("Espectro Chat Durable Object Worker Online", { status: 200 });
  }
};
