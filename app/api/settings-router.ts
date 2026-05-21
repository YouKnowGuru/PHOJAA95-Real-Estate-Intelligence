import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { systemSettings } from "@db/schema";
import { DEFAULT_SITE_TAGLINE } from "@contracts/constants";

export const settingsRouter = createRouter({
  getPublicSettings: publicQuery.query(async () => {
    const db = getDb();
    const settings = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["site_name", "site_logo", "site_tagline"]));

    const result: Record<string, string> = {
      site_name: "PHOJAA95",
      site_logo: "",
      site_tagline: DEFAULT_SITE_TAGLINE,
    };

    settings.forEach((s) => {
      if (s.key && s.value) {
        result[s.key] = s.value;
      }
    });

    return result;
  }),

  getAllSettings: adminQuery.query(async () => {
    const db = getDb();
    return await db.select().from(systemSettings);
  }),

  updateSetting: adminQuery
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.unifiedUser!.id;

      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, input.key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({
            value: input.value,
            updatedBy: userId,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, input.key));
      } else {
        await db.insert(systemSettings).values({
          key: input.key,
          value: input.value,
          updatedBy: userId,
        });
      }

      return { success: true };
    }),
});
