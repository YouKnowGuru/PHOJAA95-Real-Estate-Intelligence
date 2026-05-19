import { authRouter } from "./auth-router";
import { localAuthRouter } from "./local-auth-router";
import { propertyRouter } from "./property-router";
import { propertyTypeRouter } from "./property-type-router";
import { userRouter } from "./user-router";
import { attendanceRouter } from "./attendance-router";
import { payrollRouter } from "./payroll-router";
import { dashboardRouter } from "./dashboard-router";
import { activityLogRouter } from "./activity-log-router";
import { seedRouter } from "./seed-router";
import { uploadRouter } from "./upload-router";
import { notificationRouter } from "./notification-router";
import { reportRouter } from "./report-router";
import { settingsRouter } from "./settings-router";
import { chatbotRouter } from "./chatbot-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  localAuth: localAuthRouter,
  property: propertyRouter,
  propertyType: propertyTypeRouter,
  user: userRouter,
  attendance: attendanceRouter,
  payroll: payrollRouter,
  dashboard: dashboardRouter,
  activityLog: activityLogRouter,
  seed: seedRouter,
  upload: uploadRouter,
  notification: notificationRouter,
  report: reportRouter,
  settings: settingsRouter,
  chatbot: chatbotRouter,
});

export type AppRouter = typeof appRouter;
