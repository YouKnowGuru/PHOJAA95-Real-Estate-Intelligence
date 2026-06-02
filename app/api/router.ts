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
import { documentLibraryRouter } from "./document-library-router";
import { softwareProductRouter } from "./software-product-router";
import { softwareCustomerRouter } from "./software-customer-router";
import { softwareProjectRouter } from "./software-project-router";
import { softwareSaleRouter } from "./software-sale-router";
import { softwarePaymentRouter } from "./software-payment-router";
import { softwareInvoiceRouter } from "./software-invoice-router";
import { softwareCertificateRouter } from "./software-certificate-router";
import { softwareDashboardRouter } from "./software-dashboard-router";
import { softwareDocumentRouter } from "./software-document-router";
import { softwareReportRouter } from "./software-report-router";
import { architectureCategoryRouter } from "./architecture-category-router";
import { architectureProjectRouter } from "./architecture-project-router";
import { architectureCustomerRouter } from "./architecture-customer-router";
import { architectureOrderRouter } from "./architecture-order-router";
import { architecturePaymentRouter } from "./architecture-payment-router";
import { architectureInvoiceRouter, architectureCertificateRouter } from "./architecture-invoice-router";
import { architectureDashboardRouter, architectureDocumentRouter } from "./architecture-dashboard-router";
import { architectureReportRouter } from "./architecture-report-router";
import { architecturePortalRouter } from "./architecture-portal-router";
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
  documentLibrary: documentLibraryRouter,
  softwareProduct: softwareProductRouter,
  softwareCustomer: softwareCustomerRouter,
  softwareProject: softwareProjectRouter,
  softwareSale: softwareSaleRouter,
  softwarePayment: softwarePaymentRouter,
  softwareInvoice: softwareInvoiceRouter,
  softwareCertificate: softwareCertificateRouter,
  softwareDashboard: softwareDashboardRouter,
  softwareDocument: softwareDocumentRouter,
  softwareReport: softwareReportRouter,
  architectureCategory: architectureCategoryRouter,
  architectureProject: architectureProjectRouter,
  architectureCustomer: architectureCustomerRouter,
  architectureOrder: architectureOrderRouter,
  architecturePayment: architecturePaymentRouter,
  architectureInvoice: architectureInvoiceRouter,
  architectureCertificate: architectureCertificateRouter,
  architectureDashboard: architectureDashboardRouter,
  architectureReport: architectureReportRouter,
  architectureDocument: architectureDocumentRouter,
  architecturePortal: architecturePortalRouter,
});

export type AppRouter = typeof appRouter;
