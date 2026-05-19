import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  decimal,
  int,
  json,
  boolean,
  date,
  index,
} from "drizzle-orm/mysql-core";

// ─── 1. USERS (OAuth) ──────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── 2. LOCAL USERS (Username/Password Auth) ──────────────────────
export const localUsers = mysqlTable("local_users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["staff", "admin"]).default("staff").notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  profileImage: text("profile_image"),
  status: mysqlEnum("status", ["active", "inactive", "locked"]).default("active").notNull(),
  pfNumber: varchar("pf_number", { length: 50 }),
  pfPercentage: decimal("pf_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  employeeId: varchar("employee_id", { length: 50 }),
  lastLoginAt: timestamp("last_login_at"),
  loginAttempts: int("login_attempts").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_local_users_email").on(table.email),
  index("idx_local_users_role").on(table.role),
  index("idx_local_users_status").on(table.status),
]);

export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// ─── 3. PROPERTY TYPES ─────────────────────────────────────────────
export const propertyTypes = mysqlTable("property_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  requiresBuildingDocs: boolean("requires_building_docs").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PropertyType = typeof propertyTypes.$inferSelect;
export type InsertPropertyType = typeof propertyTypes.$inferInsert;

// ─── 4. PROPERTIES ─────────────────────────────────────────────────
export const properties = mysqlTable("properties", {
  id: serial("id").primaryKey(),
  propertyName: varchar("property_name", { length: 255 }).notNull(),
  propertyTypeId: bigint("property_type_id", { mode: "number", unsigned: true }).notNull().references(() => propertyTypes.id, { onDelete: "restrict" }),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  ownerName: varchar("owner_name", { length: 255 }).notNull(),
  ownerCID: varchar("owner_cid", { length: 11 }).notNull(),
  ownerPhone: varchar("owner_phone", { length: 20 }).notNull(),
  ownerAddress: text("owner_address").notNull(),
  buyerName: varchar("buyer_name", { length: 255 }),
  buyerCID: varchar("buyer_cid", { length: 11 }),
  buyerPhone: varchar("buyer_phone", { length: 20 }),
  buyerAddress: text("buyer_address"),
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull(),
  realEstateFee: decimal("real_estate_fee", { precision: 15, scale: 2 }).notNull(),
  currentStep: int("current_step").default(1).notNull(),
  approvalStatus: mysqlEnum("approval_status", [
    "draft",
    "submitted",
    "pending_review",
    "approved",
    "rejected",
    "completed",
    "cancelled",
  ]).default("draft").notNull(),
  workflowStatus: mysqlEnum("workflow_status", [
    "pending",
    "processing",
    "approved",
    "rejected",
    "completed",
    "cancelled",
  ]).default("pending").notNull(),
  listedById: bigint("listed_by_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  noObjectionLetter: text("no_objection_letter"),
  adminNotes: text("admin_notes"),
  rejectionComments: text("rejection_comments"),
  completedAt: timestamp("completed_at"),
  isSold: boolean("is_sold").default(false).notNull(),
  features: json("features"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_properties_status").on(table.approvalStatus),
  index("idx_properties_workflow").on(table.workflowStatus),
  index("idx_properties_listed_by").on(table.listedById),
  index("idx_properties_owner_cid").on(table.ownerCID),
  index("idx_properties_step").on(table.currentStep),
]);

export type Property = typeof properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// ─── 5. PROPERTY AGREEMENTS ────────────────────────────────────────
export const propertyAgreements = mysqlTable("property_agreements", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  agreementFile: text("agreement_file"),
  paymentScreenshot: text("payment_screenshot"),
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }),
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }),
  approvalStatus: mysqlEnum("approval_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_agreements_property").on(table.propertyId),
]);

export type PropertyAgreement = typeof propertyAgreements.$inferSelect;

// ─── 6. PROPERTY DOCUMENTS ─────────────────────────────────────────
export const propertyDocuments = mysqlTable("property_documents", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  gewogCertification: text("gewog_certification"),
  internalAgreement: text("internal_agreement"),
  occupancyCertificate: text("occupancy_certificate"),
  plrVerification: text("plr_verification"),
  remainingPaymentScreenshot: text("remaining_payment_screenshot"),
  remainingPaymentAmount: decimal("remaining_payment_amount", { precision: 15, scale: 2 }),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvalStatus: mysqlEnum("approval_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_docs_property").on(table.propertyId),
]);

export type PropertyDocument = typeof propertyDocuments.$inferSelect;

// ─── 7. VERIFICATION PROCESSES ─────────────────────────────────────
export const verificationProcesses = mysqlTable("verification_processes", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  lagthramStatus: mysqlEnum("lagthram_status", ["pending", "processing", "completed"]).default("pending").notNull(),
  loanStatus: mysqlEnum("loan_status", ["pending", "processing", "completed"]).default("pending").notNull(),
  lagthramCompletedAt: timestamp("lagthram_completed_at"),
  loanCompletedAt: timestamp("loan_completed_at"),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_verification_property").on(table.propertyId),
]);

export type VerificationProcess = typeof verificationProcesses.$inferSelect;

// ─── 8. FINAL LAGTHRAM ─────────────────────────────────────────────
export const finalLagthrams = mysqlTable("final_lagthrams", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  finalDocument: text("final_document"),
  completionCertificate: text("completion_certificate"),
  approvalStatus: mysqlEnum("approval_status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  comments: text("comments"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_final_lagthram_property").on(table.propertyId),
]);

export type FinalLagthram = typeof finalLagthrams.$inferSelect;

// ─── 9. ATTENDANCE ─────────────────────────────────────────────────
export const attendance = mysqlTable("attendance", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  status: mysqlEnum("status", ["present", "absent", "late", "half_day"]).default("absent").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_attendance_user").on(table.userId),
  index("idx_attendance_date").on(table.date),
]);

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

// ─── 10. PAYROLL ───────────────────────────────────────────────────
export const payroll = mysqlTable("payroll", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  baseSalary: decimal("base_salary", { precision: 12, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 12, scale: 2 }).default("0").notNull(),
  deduction: decimal("deduction", { precision: 12, scale: 2 }).default("0").notNull(),
  netSalary: decimal("net_salary", { precision: 12, scale: 2 }).notNull(),
  pfDeduction: decimal("pf_deduction", { precision: 12, scale: 2 }).default("0").notNull(),
  pfPercentage: decimal("pf_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "paid"]).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  paidBy: bigint("paid_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_payroll_user").on(table.userId),
  index("idx_payroll_month").on(table.month),
]);

export type Payroll = typeof payroll.$inferSelect;
export type InsertPayroll = typeof payroll.$inferInsert;

// ─── 11. APPROVAL HISTORY ──────────────────────────────────────────
export const approvalHistory = mysqlTable("approval_history", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  step: int("step").notNull(),
  action: mysqlEnum("action", ["submitted", "approved", "rejected", "resubmitted", "completed"]).notNull(),
  adminId: bigint("admin_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_approval_history_property").on(table.propertyId),
  index("idx_approval_history_admin").on(table.adminId),
  index("idx_approval_history_created").on(table.createdAt),
]);

export type ApprovalHistory = typeof approvalHistory.$inferSelect;

// ─── 12. ACTIVITY LOGS ─────────────────────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  metadata: json("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_activity_user").on(table.userId),
  index("idx_activity_created").on(table.createdAt),
  index("idx_activity_entity").on(table.entityType, table.entityId),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;

// ─── 13. NOTIFICATIONS ─────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error", "approval"]).default("info").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_read").on(table.isRead),
]);

export type Notification = typeof notifications.$inferSelect;

// ─── 14. SYSTEM SETTINGS ───────────────────────────────────────────
export const systemSettings = mysqlTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedBy: bigint("updated_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// ─── 15. PASSWORD RESET TOKENS ────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_reset_tokens_token").on(table.token),
  index("idx_reset_tokens_user").on(table.userId),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ─── 16. PROPERTY IMAGES ───────────────────────────────────────────
export const propertyImages = mysqlTable("property_images", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  publicId: varchar("public_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_property_images_property").on(table.propertyId),
]);

export type PropertyImage = typeof propertyImages.$inferSelect;
export type InsertPropertyImage = typeof propertyImages.$inferInsert;

// ─── 17. CHAT CONVERSATIONS ─────────────────────────────────────────
export const chatConversations = mysqlTable("chat_conversations", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).default("New Conversation").notNull(),
  model: varchar("model", { length: 100 }).default("openai/gpt-4o").notNull(),
  systemPrompt: text("system_prompt"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_chat_conv_user").on(table.userId),
  index("idx_chat_conv_updated").on(table.updatedAt),
]);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// ─── 18. CHAT MESSAGES ──────────────────────────────────────────────
export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: bigint("conversation_id", { mode: "number", unsigned: true }).notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["user", "assistant", "system", "tool"]).notNull(),
  content: text("content").notNull(),
  toolCalls: json("tool_calls"),
  toolCallId: varchar("tool_call_id", { length: 255 }),
  toolName: varchar("tool_name", { length: 100 }),
  metadata: json("metadata"),
  tokensUsed: int("tokens_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_chat_msg_conv").on(table.conversationId),
  index("idx_chat_msg_created").on(table.createdAt),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
