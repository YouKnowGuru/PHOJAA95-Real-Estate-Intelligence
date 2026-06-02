import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { architectureActivityLogs, notifications, localUsers } from "@db/schema";

type NotificationType = "info" | "success" | "warning" | "error" | "approval";

export async function logArchitectureActivity({
  userId,
  userName,
  action,
  entityType,
  entityId,
  previousValue,
  newValue,
  ipAddress,
}: {
  userId?: number;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}) {
  try {
    const db = getDb();
    await db.insert(architectureActivityLogs).values({
      userId,
      userName,
      action,
      entityType,
      entityId,
      previousValue: previousValue ? JSON.stringify(previousValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      ipAddress,
    });
  } catch {
    // Audit logging should never break business logic
  }
}

export async function createArchitectureNotification({
  userId,
  title,
  message,
  type,
  entityType,
  entityId,
}: {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: number;
}) {
  try {
    const db = getDb();
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      entityType,
      entityId,
    });
  } catch {
    // Notifications should never break business logic
  }
}

async function getActiveAdminIds(): Promise<number[]> {
  const db = getDb();
  const admins = await db
    .select({ id: localUsers.id })
    .from(localUsers)
    .where(and(eq(localUsers.role, "admin"), eq(localUsers.status, "active")));
  return admins.map((a) => a.id);
}

export async function notifyAdminsForArchitectureApproval({
  submitterName,
  entityType,
  entityName,
  entityId,
}: {
  submitterName: string;
  entityType: "Project" | "Order" | "Payment";
  entityName: string;
  entityId: number;
}) {
  try {
    const adminIds = await getActiveAdminIds();
    if (adminIds.length === 0) return;

    const entityKey = `architecture_${entityType.toLowerCase()}`;

    await Promise.all(
      adminIds.map((userId) =>
        createArchitectureNotification({
          userId,
          title: `Architecture ${entityType} Pending Review`,
          message: `${submitterName} submitted ${entityType.toLowerCase()} "${entityName}" for your review.`,
          type: "approval",
          entityType: entityKey,
          entityId,
        })
      )
    );
  } catch {
    // Silently fail
  }
}

export async function notifyArchitectureCreator({
  creatorId,
  entityType,
  entityName,
  action,
  reason,
  entityId,
}: {
  creatorId: number;
  entityType: string;
  entityName: string;
  action: "approved" | "rejected" | "completed" | "generated" | "verified" | "payment_request";
  reason?: string;
  entityId?: number;
}) {
  const titleMap: Record<string, string> = {
    approved: `${entityType} Approved`,
    rejected: `${entityType} Rejected`,
    completed: `${entityType} Completed`,
    generated: `${entityType} Generated`,
    verified: `Payment Verified`,
    payment_request: `Payment Required`,
  };

  const messageMap: Record<string, string> = {
    approved: `Your ${entityType.toLowerCase()} "${entityName}" has been approved.${reason ? ` Note: ${reason}` : ""}`,
    rejected: `Your ${entityType.toLowerCase()} "${entityName}" has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    completed: `The ${entityType.toLowerCase()} "${entityName}" has been marked as completed.`,
    generated: `A new ${entityType.toLowerCase()} has been generated for "${entityName}".`,
    verified: `Payment for "${entityName}" has been verified by admin.`,
    payment_request: `Payment is required for "${entityName}". Please submit your payment.`,
  };

  const typeMap: Record<string, NotificationType> = {
    approved: "success",
    rejected: "warning",
    completed: "success",
    generated: "info",
    verified: "success",
    payment_request: "warning",
  };

  await createArchitectureNotification({
    userId: creatorId,
    title: titleMap[action],
    message: messageMap[action],
    type: typeMap[action],
    entityType: `architecture_${entityType.toLowerCase()}`,
    entityId,
  });
}

export function generateArchitectureCode(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generatePortalToken(): string {
  return randomBytes(32).toString("hex");
}
