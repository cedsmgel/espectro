import { profilePage, SeoPagesEnv } from "../_shared/seoPages";

export const onRequestGet: PagesFunction<SeoPagesEnv> = async (context) => {
  try {
    return await profilePage(context, String(context.params.username));
  } catch {
    // Qualquer falha: entrega o app normal, sem meta específica
    return context.env.ASSETS.fetch(new Request(new URL("/", context.request.url).toString()));
  }
};
