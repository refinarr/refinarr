import { LogSource as _LS } from "@/shared/types/models";
export const LogSource = _LS;
export type LogSource = (typeof _LS)[keyof typeof _LS];
