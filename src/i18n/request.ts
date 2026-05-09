import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}

export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
