import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../api/router";
import type { inferRouterOutputs } from "@trpc/server";

export const trpc = createTRPCReact<AppRouter>();
export type RouterOutputs = inferRouterOutputs<AppRouter>;
