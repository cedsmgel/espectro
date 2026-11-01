import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";
import { loadCommunityDetail } from "../../_shared/communityDetail";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { params, request, env } = context;
    const slug = params.slug as string;
    if (!slug) {
      return errorResponse("Slug ou ID da comunidade não informado.", 400);
    }

    const authUser = await getAuthUser(request, getJwtSecret(env));
    const community = await loadCommunityDetail(env.DB, slug, authUser ? authUser.id : null);
    if (!community) {
      return errorResponse("Comunidade não encontrada.", 404);
    }
    return jsonResponse(community);
  } catch (err: unknown) {
    return serverError(err, "communities/[slug]");
  }
};
