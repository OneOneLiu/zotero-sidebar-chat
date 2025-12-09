import { config } from "../../package.json";

export function getLocaleID(id: string) {
  return `${config.addonRef}-${id}`;
}

