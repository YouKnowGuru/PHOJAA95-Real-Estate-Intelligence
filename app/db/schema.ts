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
  role: mysqlEnum("role", ["staff", "admin", "developer", "architecture_staff"]).default("staff").notNull(),
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
  // ── Land Pricing Fields ────────────────────────────────────────────
  pricePerDecimal: decimal("price_per_decimal", { precision: 15, scale: 4 }),
  landSizeDecimal: decimal("land_size_decimal", { precision: 15, scale: 4 }),
  negotiatedPrice: decimal("negotiated_price", { precision: 15, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }),
  finalSellingPrice: decimal("final_selling_price", { precision: 15, scale: 2 }),
  loanAmount: decimal("loan_amount", { precision: 15, scale: 2 }),
  priceOverrideBy: bigint("price_override_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  priceOverrideAt: timestamp("price_override_at"),
  priceOverrideReason: text("price_override_reason"),
  // ── Land Document Fields ───────────────────────────────────────────
  thramNumber: varchar("thram_number", { length: 100 }),
  plotNumber: varchar("plot_number", { length: 100 }),
  // ── Property Details ───────────────────────────────────────────────
  yearOfConstruction: int("year_of_construction"),
  // ────────────────────────────────────────────────────────────────────
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
  // Search optimization indexes
  index("idx_properties_name").on(table.propertyName),
  index("idx_properties_owner_name").on(table.ownerName),
  index("idx_properties_owner_phone").on(table.ownerPhone),
  index("idx_properties_thram").on(table.thramNumber),
  index("idx_properties_plot").on(table.plotNumber),
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
  // Single "Total Amount Paid" value collected in Step 2 (nullable so legacy 50%/remaining records are untouched)
  totalAmountPaid: decimal("total_amount_paid", { precision: 15, scale: 2 }),
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
  deductionNotes: text("deduction_notes"),
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
  deductionNotes: text("deduction_notes"),
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

// ─── 14. PROPERTY PRICE HISTORY ────────────────────────────────────
export const propertyPriceHistory = mysqlTable("property_price_history", {
  id: serial("id").primaryKey(),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).notNull().references(() => properties.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name", { length: 50 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: bigint("changed_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  changedByName: varchar("changed_by_name", { length: 255 }),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_price_history_property").on(table.propertyId),
  index("idx_price_history_created").on(table.createdAt),
]);

export type PropertyPriceHistory = typeof propertyPriceHistory.$inferSelect;
export type InsertPropertyPriceHistory = typeof propertyPriceHistory.$inferInsert;

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

// ─── 19. LIBRARY DOCUMENTS (shared document storage) ─────────────────
export const libraryDocuments = mysqlTable("library_documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).default("General").notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull(),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_library_docs_category").on(table.category),
  index("idx_library_docs_uploaded_by").on(table.uploadedBy),
  index("idx_library_docs_created").on(table.createdAt),
]);

export type LibraryDocument = typeof libraryDocuments.$inferSelect;
export type InsertLibraryDocument = typeof libraryDocuments.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════
// SOFTWARE DEVELOPMENT MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════════════════════

// ─── SOFTWARE PRODUCTS ───────────────────────────────────────────────
export const softwareProducts = mysqlTable("software_products", {
  id: serial("id").primaryKey(),
  productCode: varchar("product_code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "website",
    "web_application",
    "android_application",
    "ios_application",
    "desktop_software",
    "erp_system",
    "pos_system",
    "crm_system",
    "ecommerce_platform",
    "saas_platform",
    "api_service",
    "custom_software",
    "other",
  ]).notNull(),
  shortDescription: text("short_description"),
  detailedDescription: text("detailed_description"),
  features: json("features"),
  technologiesUsed: text("technologies_used"),
  estimatedDuration: varchar("estimated_duration", { length: 100 }),
  price: decimal("price", { precision: 15, scale: 2 }).default("0").notNull(),
  thumbnail: text("thumbnail"),
  screenshots: json("screenshots"),
  demoUrl: text("demo_url"),
  documentationUrl: text("documentation_url"),
  version: varchar("version", { length: 50 }).default("1.0.0"),
  warrantyPeriod: int("warranty_period").default(0),
  maintenancePeriod: int("maintenance_period").default(0),
  status: mysqlEnum("status", [
    "draft",
    "pending_approval",
    "approved",
    "under_development",
    "testing",
    "completed",
    "published",
    "archived",
    "rejected",
  ]).default("draft").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_products_status").on(table.status),
  index("idx_software_products_category").on(table.category),
  index("idx_software_products_created_by").on(table.createdBy),
  index("idx_software_products_code").on(table.productCode),
]);

export type SoftwareProduct = typeof softwareProducts.$inferSelect;
export type InsertSoftwareProduct = typeof softwareProducts.$inferInsert;

// ─── SOFTWARE PRODUCT FEATURES (additional features for sales) ───────
export const softwareProductFeatures = mysqlTable("software_product_features", {
  id: serial("id").primaryKey(),
  productId: bigint("product_id", { mode: "number", unsigned: true }).notNull().references(() => softwareProducts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 15, scale: 2 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spf_product").on(table.productId),
]);

export type SoftwareProductFeature = typeof softwareProductFeatures.$inferSelect;

// ─── SOFTWARE CUSTOMERS ──────────────────────────────────────────────
export const softwareCustomers = mysqlTable("software_customers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  alternatePhone: varchar("alternate_phone", { length: 20 }),
  email: varchar("email", { length: 320 }).notNull(),
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  address: text("address"),
  postalCode: varchar("postal_code", { length: 20 }),
  taxNumber: varchar("tax_number", { length: 100 }),
  notes: text("notes"),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_customers_email").on(table.email),
  index("idx_software_customers_phone").on(table.phone),
  index("idx_software_customers_customer_id").on(table.customerId),
]);

export type SoftwareCustomer = typeof softwareCustomers.$inferSelect;
export type InsertSoftwareCustomer = typeof softwareCustomers.$inferInsert;

// ─── SOFTWARE PROJECTS ───────────────────────────────────────────────
export const softwareProjects = mysqlTable("software_projects", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => softwareCustomers.id, { onDelete: "restrict" }),
  productId: bigint("product_id", { mode: "number", unsigned: true }).notNull().references(() => softwareProducts.id, { onDelete: "restrict" }),
  description: text("description"),
  scopeOfWork: text("scope_of_work"),
  requirements: text("requirements"),
  estimatedBudget: decimal("estimated_budget", { precision: 15, scale: 2 }),
  estimatedDuration: varchar("estimated_duration", { length: 100 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assignedDeveloperId: bigint("assigned_developer_id", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  status: mysqlEnum("status", [
    "draft",
    "pending_approval",
    "approved",
    "in_progress",
    "testing",
    "uat",
    "completed",
    "delivered",
    "rejected",
    "cancelled",
  ]).default("draft").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  completionNotes: text("completion_notes"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_projects_status").on(table.status),
  index("idx_software_projects_customer").on(table.customerId),
  index("idx_software_projects_product").on(table.productId),
  index("idx_software_projects_developer").on(table.assignedDeveloperId),
  index("idx_software_projects_project_id").on(table.projectId),
]);

export type SoftwareProject = typeof softwareProjects.$inferSelect;
export type InsertSoftwareProject = typeof softwareProjects.$inferInsert;

// ─── SOFTWARE PROJECT FILES ──────────────────────────────────────────
export const softwareProjectFiles = mysqlTable("software_project_files", {
  id: serial("id").primaryKey(),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).notNull().references(() => softwareProjects.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull(),
  category: mysqlEnum("category", [
    "proposal",
    "quotation",
    "contract",
    "agreement",
    "requirements",
    "design",
    "screenshot",
    "apk",
    "executable",
    "zip",
    "source_code",
    "invoice",
    "certificate",
    "other",
  ]).default("other").notNull(),
  version: varchar("version", { length: 20 }).default("1.0"),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spf_project").on(table.projectId),
  index("idx_spf_category").on(table.category),
]);

export type SoftwareProjectFile = typeof softwareProjectFiles.$inferSelect;

// ─── SOFTWARE SALES ──────────────────────────────────────────────────
export const softwareSales = mysqlTable("software_sales", {
  id: serial("id").primaryKey(),
  saleNumber: varchar("sale_number", { length: 50 }).notNull().unique(),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => softwareCustomers.id, { onDelete: "restrict" }),
  productId: bigint("product_id", { mode: "number", unsigned: true }).notNull().references(() => softwareProducts.id, { onDelete: "restrict" }),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).references(() => softwareProjects.id, { onDelete: "set null" }),
  basePrice: decimal("base_price", { precision: 15, scale: 2 }).notNull(),
  additionalFeaturesCost: decimal("additional_features_cost", { precision: 15, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  grandTotal: decimal("grand_total", { precision: 15, scale: 2 }).notNull(),
  paymentType: mysqlEnum("payment_type", ["full", "advance_50", "milestone"]).default("full").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["pending", "partially_paid", "paid", "refunded", "cancelled"]).default("pending").notNull(),
  advanceAmount: decimal("advance_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  totalPaid: decimal("total_paid", { precision: 15, scale: 2 }).default("0").notNull(),
  outstandingBalance: decimal("outstanding_balance", { precision: 15, scale: 2 }).notNull(),
  status: mysqlEnum("status", [
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "payment_pending",
    "partially_paid",
    "fully_paid",
    "completed",
  ]).default("draft").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  revisionNotes: text("revision_notes"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_sales_status").on(table.status),
  index("idx_software_sales_customer").on(table.customerId),
  index("idx_software_sales_product").on(table.productId),
  index("idx_software_sales_number").on(table.saleNumber),
]);

export type SoftwareSale = typeof softwareSales.$inferSelect;
export type InsertSoftwareSale = typeof softwareSales.$inferInsert;

// ─── SOFTWARE SALE FEATURES ──────────────────────────────────────────
export const softwareSaleFeatures = mysqlTable("software_sale_features", {
  id: serial("id").primaryKey(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true }).notNull().references(() => softwareSales.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ssf_sale").on(table.saleId),
]);

export type SoftwareSaleFeature = typeof softwareSaleFeatures.$inferSelect;

// ─── SOFTWARE PAYMENTS ───────────────────────────────────────────────
export const softwarePayments = mysqlTable("software_payments", {
  id: serial("id").primaryKey(),
  paymentNumber: varchar("payment_number", { length: 50 }).notNull().unique(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true }).notNull().references(() => softwareSales.id, { onDelete: "restrict" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => softwareCustomers.id, { onDelete: "restrict" }),
  invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).references(() => softwareInvoices.id, { onDelete: "set null" }),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: mysqlEnum("payment_method", [
    "cash",
    "bank_transfer",
    "mobile_banking",
    "cheque",
    "online_payment",
  ]).notNull(),
  referenceNumber: varchar("reference_number", { length: 255 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  recordedBy: bigint("recorded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_software_payments_sale").on(table.saleId),
  index("idx_software_payments_number").on(table.paymentNumber),
]);

// ─── SOFTWARE INVOICES ───────────────────────────────────────────────
export const softwareInvoices = mysqlTable("software_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true }).notNull().references(() => softwareSales.id, { onDelete: "restrict" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => softwareCustomers.id, { onDelete: "restrict" }),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).default("0").notNull(),
  outstandingAmount: decimal("outstanding_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  status: mysqlEnum("status", [
    "draft",
    "sent",
    "partially_paid",
    "paid",
    "overdue",
    "cancelled",
  ]).default("draft").notNull(),
  termsAndConditions: text("terms_and_conditions"),
  generatedBy: bigint("generated_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  sentAt: timestamp("sent_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_invoices_status").on(table.status),
  index("idx_software_invoices_sale").on(table.saleId),
  index("idx_software_invoices_number").on(table.invoiceNumber),
]);

export type SoftwareInvoice = typeof softwareInvoices.$inferSelect;
export type InsertSoftwareInvoice = typeof softwareInvoices.$inferInsert;

// ─── SOFTWARE INVOICE ITEMS ──────────────────────────────────────────
export const softwareInvoiceItems = mysqlTable("software_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull().references(() => softwareInvoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sii_invoice").on(table.invoiceId),
]);

export type SoftwareInvoiceItem = typeof softwareInvoiceItems.$inferSelect;

// ─── SOFTWARE CERTIFICATES ───────────────────────────────────────────
export const softwareCertificates = mysqlTable("software_certificates", {
  id: serial("id").primaryKey(),
  certificateNumber: varchar("certificate_number", { length: 50 }).notNull().unique(),
  certificateType: mysqlEnum("certificate_type", [
    "project_completion",
    "software_ownership",
  ]).notNull(),
  saleId: bigint("sale_id", { mode: "number", unsigned: true }).notNull().references(() => softwareSales.id, { onDelete: "restrict" }),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).references(() => softwareProjects.id, { onDelete: "set null" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => softwareCustomers.id, { onDelete: "restrict" }),
  productId: bigint("product_id", { mode: "number", unsigned: true }).notNull().references(() => softwareProducts.id, { onDelete: "restrict" }),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  companyName: varchar("company_name", { length: 255 }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productVersion: varchar("product_version", { length: 50 }),
  completionDate: date("completion_date").notNull(),
  warrantyPeriod: int("warranty_period").default(0),
  maintenancePeriod: int("maintenance_period").default(0),
  developerName: varchar("developer_name", { length: 255 }),
  verificationNumber: varchar("verification_number", { length: 100 }).notNull().unique(),
  generatedBy: bigint("generated_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_software_certificates_number").on(table.certificateNumber),
  index("idx_software_certificates_verification").on(table.verificationNumber),
  index("idx_software_certificates_sale").on(table.saleId),
]);

export type SoftwareCertificate = typeof softwareCertificates.$inferSelect;
export type InsertSoftwareCertificate = typeof softwareCertificates.$inferInsert;

// ─── SOFTWARE DOCUMENTS ──────────────────────────────────────────────
export const softwareDocuments = mysqlTable("software_documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "proposal",
    "quotation",
    "contract",
    "agreement",
    "requirements",
    "design",
    "screenshot",
    "apk",
    "executable",
    "zip",
    "source_code",
    "invoice",
    "certificate",
    "other",
  ]).default("other").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull(),
  version: varchar("version", { length: 20 }).default("1.0"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_software_docs_category").on(table.category),
  index("idx_software_docs_entity").on(table.entityType, table.entityId),
  index("idx_software_docs_uploaded_by").on(table.uploadedBy),
]);

export type SoftwareDocument = typeof softwareDocuments.$inferSelect;
export type InsertSoftwareDocument = typeof softwareDocuments.$inferInsert;

// ─── SOFTWARE NOTIFICATIONS (module-specific) ────────────────────────
export const softwareNotifications = mysqlTable("software_notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", [
    "product_approved",
    "product_rejected",
    "project_approved",
    "project_rejected",
    "sale_approved",
    "sale_rejected",
    "invoice_generated",
    "payment_received",
    "project_completed",
    "certificate_generated",
    "info",
    "warning",
  ]).default("info").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_software_notif_user").on(table.userId),
  index("idx_software_notif_read").on(table.isRead),
  index("idx_software_notif_type").on(table.type),
]);

export type SoftwareNotification = typeof softwareNotifications.$inferSelect;

// ─── SOFTWARE ACTIVITY LOGS ──────────────────────────────────────────
export const softwareActivityLogs = mysqlTable("software_activity_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_software_activity_user").on(table.userId),
  index("idx_software_activity_created").on(table.createdAt),
  index("idx_software_activity_entity").on(table.entityType, table.entityId),
]);

export type SoftwareActivityLog = typeof softwareActivityLogs.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// ARCHITECTURE MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════════════════

// ─── ARCHITECTURE CATEGORIES ─────────────────────────────────────────
export const architectureCategories = mysqlTable("architecture_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_arch_categories_active").on(table.isActive),
]);

export type ArchitectureCategory = typeof architectureCategories.$inferSelect;
export type InsertArchitectureCategory = typeof architectureCategories.$inferInsert;

// ─── ARCHITECTURE PROJECTS (portfolio / design submissions) ──────────
export const architectureProjects = mysqlTable("architecture_projects", {
  id: serial("id").primaryKey(),
  projectCode: varchar("project_code", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  categoryId: bigint("category_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCategories.id, { onDelete: "restrict" }),
  description: text("description"),
  designConcept: text("design_concept"),
  projectLocation: varchar("project_location", { length: 255 }),
  landSize: varchar("land_size", { length: 100 }),
  buildingSize: varchar("building_size", { length: 100 }),
  numberOfFloors: int("number_of_floors"),
  estimatedCompletionTime: varchar("estimated_completion_time", { length: 100 }),
  estimatedCost: decimal("estimated_cost", { precision: 15, scale: 2 }),
  features: json("features"),
  specialFeatures: text("special_features"),
  notes: text("notes"),
  status: mysqlEnum("status", [
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "in_progress",
    "completed",
  ]).default("draft").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_arch_projects_status").on(table.status),
  index("idx_arch_projects_category").on(table.categoryId),
  index("idx_arch_projects_created_by").on(table.createdBy),
  index("idx_arch_projects_code").on(table.projectCode),
]);

export type ArchitectureProject = typeof architectureProjects.$inferSelect;
export type InsertArchitectureProject = typeof architectureProjects.$inferInsert;

// ─── ARCHITECTURE PROJECT FILES ──────────────────────────────────────
export const architectureProjectFiles = mysqlTable("architecture_project_files", {
  id: serial("id").primaryKey(),
  projectId: bigint("project_id", { mode: "number", unsigned: true }).notNull().references(() => architectureProjects.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull(),
  category: mysqlEnum("category", [
    "pdf_drawing",
    "autocad",
    "image",
    "render",
    "video",
    "document",
    "floor_plan",
    "design_2d",
    "design_3d",
    "attachment",
    "other",
  ]).default("other").notNull(),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_files_project").on(table.projectId),
  index("idx_arch_files_category").on(table.category),
]);

export type ArchitectureProjectFile = typeof architectureProjectFiles.$inferSelect;

// ─── ARCHITECTURE CUSTOMERS ──────────────────────────────────────────
export const architectureCustomers = mysqlTable("architecture_customers", {
  id: serial("id").primaryKey(),
  customerId: varchar("customer_id", { length: 50 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  alternatePhone: varchar("alternate_phone", { length: 20 }),
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  address: text("address"),
  postalCode: varchar("postal_code", { length: 20 }),
  mapLocation: text("map_location"),
  notes: text("notes"),
  portalToken: varchar("portal_token", { length: 128 }).unique(),
  portalTokenExpiresAt: timestamp("portal_token_expires_at"),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_arch_customers_email").on(table.email),
  index("idx_arch_customers_phone").on(table.phone),
  index("idx_arch_customers_portal").on(table.portalToken),
]);

export type ArchitectureCustomer = typeof architectureCustomers.$inferSelect;
export type InsertArchitectureCustomer = typeof architectureCustomers.$inferInsert;

// ─── ARCHITECTURE ORDERS (sales) ─────────────────────────────────────
export const architectureOrders = mysqlTable("architecture_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCustomers.id, { onDelete: "restrict" }),
  portfolioProjectId: bigint("portfolio_project_id", { mode: "number", unsigned: true }).references(() => architectureProjects.id, { onDelete: "set null" }),
  categoryId: bigint("category_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCategories.id, { onDelete: "restrict" }),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectType: varchar("project_type", { length: 100 }),
  description: text("description"),
  features: json("features"),
  extraFeatures: text("extra_features"),
  estimatedCompletionDate: date("estimated_completion_date"),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  finalAmount: decimal("final_amount", { precision: 15, scale: 2 }).notNull(),
  advancePayment: decimal("advance_payment", { precision: 15, scale: 2 }).default("0").notNull(),
  remainingPayment: decimal("remaining_payment", { precision: 15, scale: 2 }).notNull(),
  totalPaid: decimal("total_paid", { precision: 15, scale: 2 }).default("0").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["unpaid", "partially_paid", "fully_paid"]).default("unpaid").notNull(),
  developmentStage: mysqlEnum("development_stage", [
    "planning",
    "draft_design",
    "review",
    "revision",
    "final_design",
    "completed",
  ]).default("planning").notNull(),
  progressPercentage: int("progress_percentage").default(0).notNull(),
  status: mysqlEnum("status", [
    "draft",
    "pending_approval",
    "approved",
    "rejected",
    "payment_pending",
    "in_progress",
    "completed",
    "cancelled",
  ]).default("draft").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  approvedBy: bigint("approved_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_arch_orders_status").on(table.status),
  index("idx_arch_orders_customer").on(table.customerId),
  index("idx_arch_orders_number").on(table.orderNumber),
  index("idx_arch_orders_created_by").on(table.createdBy),
  index("idx_arch_orders_payment").on(table.paymentStatus),
]);

export type ArchitectureOrder = typeof architectureOrders.$inferSelect;
export type InsertArchitectureOrder = typeof architectureOrders.$inferInsert;

// ─── ARCHITECTURE ORDER PROGRESS TIMELINE ────────────────────────────
export const architectureOrderProgress = mysqlTable("architecture_order_progress", {
  id: serial("id").primaryKey(),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => architectureOrders.id, { onDelete: "cascade" }),
  stage: mysqlEnum("stage", [
    "planning",
    "draft_design",
    "review",
    "revision",
    "final_design",
    "completed",
  ]).notNull(),
  progressPercentage: int("progress_percentage").default(0).notNull(),
  notes: text("notes"),
  updatedBy: bigint("updated_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_progress_order").on(table.orderId),
]);

export type ArchitectureOrderProgress = typeof architectureOrderProgress.$inferSelect;

// ─── ARCHITECTURE PAYMENTS ───────────────────────────────────────────
export const architecturePayments = mysqlTable("architecture_payments", {
  id: serial("id").primaryKey(),
  paymentNumber: varchar("payment_number", { length: 50 }).notNull().unique(),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => architectureOrders.id, { onDelete: "restrict" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCustomers.id, { onDelete: "restrict" }),
  paymentType: mysqlEnum("payment_type", ["advance", "final", "other"]).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: mysqlEnum("payment_method", [
    "cash",
    "bank_transfer",
    "mobile_banking",
    "cheque",
    "online_payment",
  ]).notNull(),
  referenceNumber: varchar("reference_number", { length: 255 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  proofDocumentUrl: text("proof_document_url"),
  notes: text("notes"),
  recordedBy: bigint("recorded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_payments_order").on(table.orderId),
  index("idx_arch_payments_number").on(table.paymentNumber),
]);

export type ArchitecturePayment = typeof architecturePayments.$inferSelect;

// ─── ARCHITECTURE PAYMENT VERIFICATIONS ──────────────────────────────
export const architecturePaymentVerifications = mysqlTable("architecture_payment_verifications", {
  id: serial("id").primaryKey(),
  paymentId: bigint("payment_id", { mode: "number", unsigned: true }).notNull().references(() => architecturePayments.id, { onDelete: "cascade" }),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => architectureOrders.id, { onDelete: "restrict" }),
  status: mysqlEnum("status", ["pending_verification", "verified", "rejected"]).default("pending_verification").notNull(),
  verificationNotes: text("verification_notes"),
  verifiedBy: bigint("verified_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_verifications_payment").on(table.paymentId),
  index("idx_arch_verifications_status").on(table.status),
]);

export type ArchitecturePaymentVerification = typeof architecturePaymentVerifications.$inferSelect;

// ─── ARCHITECTURE INVOICES ───────────────────────────────────────────
export const architectureInvoices = mysqlTable("architecture_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => architectureOrders.id, { onDelete: "restrict" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCustomers.id, { onDelete: "restrict" }),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 15, scale: 2 }).default("0").notNull(),
  remainingAmount: decimal("remaining_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  paymentStatus: mysqlEnum("payment_status", ["unpaid", "partially_paid", "fully_paid"]).default("unpaid").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"]).default("draft").notNull(),
  generatedBy: bigint("generated_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_arch_invoices_order").on(table.orderId),
  index("idx_arch_invoices_number").on(table.invoiceNumber),
]);

export type ArchitectureInvoice = typeof architectureInvoices.$inferSelect;

// ─── ARCHITECTURE INVOICE ITEMS ──────────────────────────────────────
export const architectureInvoiceItems = mysqlTable("architecture_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: bigint("invoice_id", { mode: "number", unsigned: true }).notNull().references(() => architectureInvoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_invoice_items").on(table.invoiceId),
]);

export type ArchitectureInvoiceItem = typeof architectureInvoiceItems.$inferSelect;

// ─── ARCHITECTURE CERTIFICATES ─────────────────────────────────────────
export const architectureCertificates = mysqlTable("architecture_certificates", {
  id: serial("id").primaryKey(),
  certificateNumber: varchar("certificate_number", { length: 50 }).notNull().unique(),
  orderId: bigint("order_id", { mode: "number", unsigned: true }).notNull().references(() => architectureOrders.id, { onDelete: "restrict" }),
  customerId: bigint("customer_id", { mode: "number", unsigned: true }).notNull().references(() => architectureCustomers.id, { onDelete: "restrict" }),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  projectName: varchar("project_name", { length: 255 }).notNull(),
  projectCategory: varchar("project_category", { length: 255 }).notNull(),
  projectLocation: varchar("project_location", { length: 255 }),
  completionDate: date("completion_date").notNull(),
  staffName: varchar("staff_name", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  verificationNumber: varchar("verification_number", { length: 100 }).notNull().unique(),
  validationUrl: text("validation_url"),
  generatedBy: bigint("generated_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_certificates_number").on(table.certificateNumber),
  index("idx_arch_certificates_verification").on(table.verificationNumber),
]);

export type ArchitectureCertificate = typeof architectureCertificates.$inferSelect;

// ─── ARCHITECTURE DOCUMENTS ──────────────────────────────────────────
export const architectureDocuments = mysqlTable("architecture_documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "pdf_drawing",
    "autocad",
    "image",
    "render",
    "video",
    "document",
    "floor_plan",
    "design_2d",
    "design_3d",
    "invoice",
    "certificate",
    "other",
  ]).default("other").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: int("file_size").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  uploadedBy: bigint("uploaded_by", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_docs_entity").on(table.entityType, table.entityId),
  index("idx_arch_docs_category").on(table.category),
]);

export type ArchitectureDocument = typeof architectureDocuments.$inferSelect;

// ─── ARCHITECTURE ACTIVITY LOGS ──────────────────────────────────────
export const architectureActivityLogs = mysqlTable("architecture_activity_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: bigint("entity_id", { mode: "number", unsigned: true }),
  previousValue: json("previous_value"),
  newValue: json("new_value"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_arch_activity_user").on(table.userId),
  index("idx_arch_activity_entity").on(table.entityType, table.entityId),
  index("idx_arch_activity_created").on(table.createdAt),
]);

export type ArchitectureActivityLog = typeof architectureActivityLogs.$inferSelect;

// ─── WORK PROGRESS REPORTS ───────────────────────────────────────────
export const workProgressReports = mysqlTable("work_progress_reports", {
  id: serial("id").primaryKey(),
  reportNumber: varchar("report_number", { length: 30 }).notNull().unique(),
  staffId: bigint("staff_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "restrict" }),
  staffName: varchar("staff_name", { length: 255 }).notNull(),
  project: varchar("project", { length: 255 }).notNull(),
  feature: varchar("feature", { length: 255 }).notNull(),
  reportDate: varchar("report_date", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed", "approved"]).default("draft").notNull(),
  featureOverview: text("feature_overview"),
  objectives: json("objectives").$type<string[]>().default([]),
  scopeOfWork: json("scope_of_work").$type<{ module: string; description: string }[]>().default([]),
  completedItems: json("completed_items").$type<string[]>().default([]),
  inProgressItems: json("in_progress_items").$type<string[]>().default([]),
  timeline: json("timeline").$type<{ phase: string; targetCompletion: string; status: "completed" | "pending" | "in_progress" }[]>().default([]),
  adminNotes: text("admin_notes"),
  reviewedBy: bigint("reviewed_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  reviewedByName: varchar("reviewed_by_name", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_wpr_staff").on(table.staffId),
  index("idx_wpr_status").on(table.status),
  index("idx_wpr_date").on(table.reportDate),
  index("idx_wpr_number").on(table.reportNumber),
]);

export type WorkProgressReport = typeof workProgressReports.$inferSelect;
export type InsertWorkProgressReport = typeof workProgressReports.$inferInsert;

// ─── PUSH SUBSCRIPTIONS (web push for salary reminders etc.) ───────
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  endpoint: varchar("endpoint", { length: 512 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_push_subs_user").on(table.userId),
]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ─── SALARY NOTICE LOG (persistent reminders until salaries are paid) ──
export const salaryNoticeLog = mysqlTable("salary_notice_log", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => localUsers.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM the notice is about
  pushSent: boolean("push_sent").default(false).notNull(), // at least one push delivered
  pushSentAt: timestamp("push_sent_at"), // first successful push
  lastPushAt: timestamp("last_push_at"), // latest push — used for nag throttling
  seenAt: timestamp("seen_at"), // last popup dismissal (acts as a 30-min snooze)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_salary_notice_user").on(table.userId),
  index("idx_salary_notice_month").on(table.month),
]);

export type SalaryNoticeLog = typeof salaryNoticeLog.$inferSelect;
export type InsertSalaryNoticeLog = typeof salaryNoticeLog.$inferInsert;

// ─── CLIENTS (mailing-list contacts for email campaigns) ─────────────
export const clients = mysqlTable("clients", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  groupName: varchar("group_name", { length: 100 }).default("General").notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "unsubscribed"]).default("active").notNull(),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_clients_email").on(table.email),
  index("idx_clients_group").on(table.groupName),
  index("idx_clients_name").on(table.fullName),
]);

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── EMAIL LOGS (one row per recipient of a campaign send) ────────────
export const emailLogs = mysqlTable("email_logs", {
  id: serial("id").primaryKey(),
  batchId: varchar("batch_id", { length: 36 }).notNull(), // groups all recipients of one send
  clientId: bigint("client_id", { mode: "number", unsigned: true }).references(() => clients.id, { onDelete: "set null" }),
  propertyId: bigint("property_id", { mode: "number", unsigned: true }).references(() => properties.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 500 }).notNull(),
  toEmail: varchar("to_email", { length: 320 }).notNull(),
  toName: varchar("to_name", { length: 255 }),
  status: mysqlEnum("status", ["sent", "failed"]).notNull(),
  error: text("error"),
  sentBy: bigint("sent_by", { mode: "number", unsigned: true }).references(() => localUsers.id, { onDelete: "set null" }),
  sentByName: varchar("sent_by_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_logs_batch").on(table.batchId),
  index("idx_email_logs_created").on(table.createdAt),
  index("idx_email_logs_property").on(table.propertyId),
  index("idx_email_logs_recipient").on(table.toEmail),
]);

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;