import { eq, and } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { softwareActivityLogs, notifications, localUsers } from "@db/schema";

type NotificationType = "info" | "success" | "warning" | "error" | "approval";

// ─── AUDIT LOGGING ────────────────────────────────────────────────────

export async function logActivity({
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
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
}) {
  try {
    const db = getDb();
    await db.insert(softwareActivityLogs).values({
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
    // Silently fail — audit logging should never break business logic
  }
}

// ─── NOTIFICATIONS (main app notifications table) ─────────────────────

export async function createNotification({
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
    // Silently fail — notifications should never break business logic
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

/** Notify all admins when a developer submits an item for approval. */
export async function notifyAdminsForApproval({
  submitterName,
  entityType,
  entityName,
  entityId,
}: {
  submitterName: string;
  entityType: "Product" | "Project" | "Sale";
  entityName: string;
  entityId: number;
}) {
  try {
    const adminIds = await getActiveAdminIds();
    if (adminIds.length === 0) return;

    const entityKey = entityType.toLowerCase();

    await Promise.all(
      adminIds.map((userId) =>
        createNotification({
          userId,
          title: `${entityType} Pending Approval`,
          message: `${submitterName} submitted ${entityKey} "${entityName}" for your review.`,
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

/** Notify the creator of an entity about approval/rejection/status changes. */
export async function notifyCreator({
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
  action: "approved" | "rejected" | "completed" | "generated";
  reason?: string;
  entityId?: number;
}) {
  const titleMap: Record<string, string> = {
    approved: `${entityType} Approved`,
    rejected: `${entityType} Rejected`,
    completed: `${entityType} Completed`,
    generated: `${entityType} Generated`,
  };

  const messageMap: Record<string, string> = {
    approved: `Your ${entityType.toLowerCase()} "${entityName}" has been approved.${reason ? ` Note: ${reason}` : ""}`,
    rejected: `Your ${entityType.toLowerCase()} "${entityName}" has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    completed: `The ${entityType.toLowerCase()} "${entityName}" has been marked as completed.`,
    generated: `A new ${entityType.toLowerCase()} has been generated for "${entityName}".`,
  };

  const typeMap: Record<string, NotificationType> = {
    approved: "success",
    rejected: "warning",
    completed: "success",
    generated: "info",
  };

  await createNotification({
    userId: creatorId,
    title: titleMap[action],
    message: messageMap[action],
    type: typeMap[action],
    entityType: entityType.toLowerCase(),
    entityId,
  });
}
