// Placeholder so wrangler.jsonc resolves; T068 implements GET /running/api/freshness.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};
