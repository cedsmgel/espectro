import { cachedPage } from "../_shared/seo";
import { postPage, SeoPagesEnv } from "../_shared/seoPages";

export const onRequestGet: PagesFunction<SeoPagesEnv> = async (context) => {
  try {
    return await cachedPage(context.request, () => postPage(context, String(context.params.id)));
  } catch {
    // Qualquer falha: entrega o app normal, sem meta específica
    return context.env.ASSETS.fetch(new Request(new URL("/", context.request.url).toString()));
  }
};
