import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User, LocalUser } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { authenticateLocalRequest } from "./local-auth-router";

export type UnifiedUser = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  avatar?: string | null;
  authType: "oauth" | "local";
  status?: string;
  pfNumber?: string | null;
  pfPercentage?: string | null;
  employeeId?: string | null;
};

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  localUser?: LocalUser | null;
  unifiedUser?: UnifiedUser;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try OAuth first
  try {
    const oauthUser = await authenticateRequest(opts.req.headers);
    if (oauthUser) {
      ctx.user = oauthUser;
      ctx.unifiedUser = {
        id: oauthUser.id,
        name: oauthUser.name || "User",
        email: oauthUser.email,
        role: oauthUser.role,
        avatar: oauthUser.avatar,
        authType: "oauth",
      };
    }
  } catch {
    // OAuth not available
  }

  // Try local auth
  if (!ctx.unifiedUser) {
    try {
      const localUser = await authenticateLocalRequest(opts.req.headers);
      ctx.localUser = localUser;
      if (localUser) {
        ctx.unifiedUser = {
          id: localUser.id,
          name: localUser.fullName,
          email: localUser.email,
          role: localUser.role,
          avatar: localUser.profileImage,
          authType: "local",
          status: localUser.status,
          pfNumber: localUser.pfNumber,
          pfPercentage: localUser.pfPercentage,
          employeeId: localUser.employeeId,
        };
      }
    } catch {
      // Local auth not available
    }
  }

  return ctx;
}
