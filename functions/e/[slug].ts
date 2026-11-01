import { communityPage, SeoPagesEnv } from "../_shared/seoPages";

export const onRequestGet: PagesFunction<SeoPagesEnv> = async (context) => {
  try {
    return await communityPage(context, String(context.params.slug));
  } catch {
    // Qualquer falha: entrega o app normal, sem meta específica
    return context.env.ASSETS.fetch(new Request(new URL("/", context.request.url).toString()));
  }
};
