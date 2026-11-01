import { cachedPage } from "../_shared/seo";
import { tagPage, SeoPagesEnv } from "../_shared/seoPages";

export const onRequestGet: PagesFunction<SeoPagesEnv> = async (context) => {
  try {
    return await cachedPage(context.request, () => tagPage(context, String(context.params.tag)));
  } catch {
    // Qualquer falha: entrega o app normal, sem meta específica
    return context.env.ASSETS.fetch(new Request(new URL("/", context.request.url).toString()));
  }
};
