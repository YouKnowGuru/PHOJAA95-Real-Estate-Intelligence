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
