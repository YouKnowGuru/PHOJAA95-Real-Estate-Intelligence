import { relations } from "drizzle-orm";
import {
  users,
  localUsers,
  propertyTypes,
  properties,
  propertyAgreements,
  propertyDocuments,
  verificationProcesses,
  finalLagthrams,
  attendance,
  payroll,
  approvalHistory,
  activityLogs,
  notifications,
  systemSettings,
  passwordResetTokens,
  propertyImages,
  chatConversations,
  chatMessages,
  softwareProducts,
  softwareProductFeatures,
  softwareCustomers,
  softwareProjects,
  softwareProjectFiles,
  softwareSales,
  softwareSaleFeatures,
  softwarePayments,
  softwareInvoices,
  softwareInvoiceItems,
  softwareCertificates,
  softwareDocuments,
} from "./schema";

// ─── USERS ─────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  activityLogs: many(activityLogs),
}));

// ─── LOCAL USERS ───────────────────────────────────────────────────
export const localUsersRelations = relations(localUsers, ({ many }) => ({
  properties: many(properties, { relationName: "listedBy" }),
  attendance: many(attendance),
  payroll: many(payroll),
  approvedProperties: many(properties, { relationName: "approvedBy" }),
}));

// ─── PROPERTY TYPES ────────────────────────────────────────────────
export const propertyTypesRelations = relations(propertyTypes, ({ many }) => ({
  properties: many(properties),
}));

// ─── PROPERTIES ────────────────────────────────────────────────────
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  propertyType: one(propertyTypes, {
    fields: [properties.propertyTypeId],
    references: [propertyTypes.id],
  }),
  listedBy: one(localUsers, {
    fields: [properties.listedById],
    references: [localUsers.id],
  }),
  agreement: one(propertyAgreements, {
    fields: [properties.id],
    references: [propertyAgreements.propertyId],
  }),
  documents: one(propertyDocuments, {
    fields: [properties.id],
    references: [propertyDocuments.propertyId],
  }),
  verification: one(verificationProcesses, {
    fields: [properties.id],
    references: [verificationProcesses.propertyId],
  }),
  finalLagthram: one(finalLagthrams, {
    fields: [properties.id],
    references: [finalLagthrams.propertyId],
  }),
  approvalHistory: many(approvalHistory),
  images: many(propertyImages),
}));

// ─── PROPERTY AGREEMENTS ───────────────────────────────────────────
export const propertyAgreementsRelations = relations(propertyAgreements, ({ one }) => ({
  property: one(properties, {
    fields: [propertyAgreements.propertyId],
    references: [properties.id],
  }),
}));

// ─── PROPERTY DOCUMENTS ────────────────────────────────────────────
export const propertyDocumentsRelations = relations(propertyDocuments, ({ one }) => ({
  property: one(properties, {
    fields: [propertyDocuments.propertyId],
    references: [properties.id],
  }),
}));

// ─── VERIFICATION PROCESSES ────────────────────────────────────────
export const verificationProcessesRelations = relations(verificationProcesses, ({ one }) => ({
  property: one(properties, {
    fields: [verificationProcesses.propertyId],
    references: [properties.id],
  }),
}));

// ─── FINAL LAGTHRAMS ───────────────────────────────────────────────
export const finalLagthramsRelations = relations(finalLagthrams, ({ one }) => ({
  property: one(properties, {
    fields: [finalLagthrams.propertyId],
    references: [properties.id],
  }),
}));

// ─── ATTENDANCE ────────────────────────────────────────────────────
export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(localUsers, {
    fields: [attendance.userId],
    references: [localUsers.id],
  }),
}));

// ─── PAYROLL ───────────────────────────────────────────────────────
export const payrollRelations = relations(payroll, ({ one }) => ({
  user: one(localUsers, {
    fields: [payroll.userId],
    references: [localUsers.id],
  }),
}));

// ─── APPROVAL HISTORY ──────────────────────────────────────────────
export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  property: one(properties, {
    fields: [approvalHistory.propertyId],
    references: [properties.id],
  }),
}));

// ─── CHAT CONVERSATIONS ────────────────────────────────────────────
export const chatConversationsRelations = relations(chatConversations, ({ many }) => ({
  messages: many(chatMessages),
}));

// ─── CHAT MESSAGES ─────────────────────────────────────────────────
export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════
// SOFTWARE DEVELOPMENT RELATIONS
// ═══════════════════════════════════════════════════════════════════════

export const softwareProductsRelations = relations(softwareProducts, ({ one, many }) => ({
  createdByUser: one(localUsers, {
    fields: [softwareProducts.createdBy],
    references: [localUsers.id],
  }),
  approvedByUser: one(localUsers, {
    fields: [softwareProducts.approvedBy],
    references: [localUsers.id],
  }),
  features: many(softwareProductFeatures),
  projects: many(softwareProjects),
  sales: many(softwareSales),
}));

export const softwareProductFeaturesRelations = relations(softwareProductFeatures, ({ one }) => ({
  product: one(softwareProducts, {
    fields: [softwareProductFeatures.productId],
    references: [softwareProducts.id],
  }),
}));

export const softwareCustomersRelations = relations(softwareCustomers, ({ many }) => ({
  projects: many(softwareProjects),
  sales: many(softwareSales),
}));

export const softwareProjectsRelations = relations(softwareProjects, ({ one, many }) => ({
  customer: one(softwareCustomers, {
    fields: [softwareProjects.customerId],
    references: [softwareCustomers.id],
  }),
  product: one(softwareProducts, {
    fields: [softwareProjects.productId],
    references: [softwareProducts.id],
  }),
  assignedDeveloper: one(localUsers, {
    fields: [softwareProjects.assignedDeveloperId],
    references: [localUsers.id],
  }),
  createdByUser: one(localUsers, {
    fields: [softwareProjects.createdBy],
    references: [localUsers.id],
  }),
  files: many(softwareProjectFiles),
}));

export const softwareProjectFilesRelations = relations(softwareProjectFiles, ({ one }) => ({
  project: one(softwareProjects, {
    fields: [softwareProjectFiles.projectId],
    references: [softwareProjects.id],
  }),
  uploadedByUser: one(localUsers, {
    fields: [softwareProjectFiles.uploadedBy],
    references: [localUsers.id],
  }),
}));

export const softwareSalesRelations = relations(softwareSales, ({ one, many }) => ({
  customer: one(softwareCustomers, {
    fields: [softwareSales.customerId],
    references: [softwareCustomers.id],
  }),
  product: one(softwareProducts, {
    fields: [softwareSales.productId],
    references: [softwareProducts.id],
  }),
  project: one(softwareProjects, {
    fields: [softwareSales.projectId],
    references: [softwareProjects.id],
  }),
  createdByUser: one(localUsers, {
    fields: [softwareSales.createdBy],
    references: [localUsers.id],
  }),
  features: many(softwareSaleFeatures),
  payments: many(softwarePayments),
  invoices: many(softwareInvoices),
}));

export const softwareSaleFeaturesRelations = relations(softwareSaleFeatures, ({ one }) => ({
  sale: one(softwareSales, {
    fields: [softwareSaleFeatures.saleId],
    references: [softwareSales.id],
  }),
}));

export const softwarePaymentsRelations = relations(softwarePayments, ({ one }) => ({
  sale: one(softwareSales, {
    fields: [softwarePayments.saleId],
    references: [softwareSales.id],
  }),
  customer: one(softwareCustomers, {
    fields: [softwarePayments.customerId],
    references: [softwareCustomers.id],
  }),
  invoice: one(softwareInvoices, {
    fields: [softwarePayments.invoiceId],
    references: [softwareInvoices.id],
  }),
}));

export const softwareInvoicesRelations = relations(softwareInvoices, ({ one, many }) => ({
  sale: one(softwareSales, {
    fields: [softwareInvoices.saleId],
    references: [softwareSales.id],
  }),
  customer: one(softwareCustomers, {
    fields: [softwareInvoices.customerId],
    references: [softwareCustomers.id],
  }),
  items: many(softwareInvoiceItems),
  payments: many(softwarePayments),
}));

export const softwareInvoiceItemsRelations = relations(softwareInvoiceItems, ({ one }) => ({
  invoice: one(softwareInvoices, {
    fields: [softwareInvoiceItems.invoiceId],
    references: [softwareInvoices.id],
  }),
}));

export const softwareCertificatesRelations = relations(softwareCertificates, ({ one }) => ({
  sale: one(softwareSales, {
    fields: [softwareCertificates.saleId],
    references: [softwareSales.id],
  }),
  project: one(softwareProjects, {
    fields: [softwareCertificates.projectId],
    references: [softwareProjects.id],
  }),
  customer: one(softwareCustomers, {
    fields: [softwareCertificates.customerId],
    references: [softwareCustomers.id],
  }),
  product: one(softwareProducts, {
    fields: [softwareCertificates.productId],
    references: [softwareProducts.id],
  }),
}));
