import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

export type AltrixRequest = Request & {
  altrixUserId?: string;
  altrixProfile?: typeof userProfilesTable.$inferSelect;
};

export async function ensureProfile(userId: string) {
  const identity = await clerkClient.users.getUser(userId);
  const primary = identity.emailAddresses.find(
    (item) => item.id === identity.primaryEmailAddressId,
  );
  const email = primary?.emailAddress?.trim().toLowerCase();
  if (!email) {
    throw new Error("A verified primary email is required");
  }
  const verified = Boolean(primary?.verification?.status === "verified");
  const configuredAdminEmail = process.env.ALTRIX_ADMIN_EMAIL?.trim().toLowerCase();
  const eligibleForAdmin = Boolean(
    configuredAdminEmail &&
      verified &&
      email === configuredAdminEmail &&
      identity.publicMetadata?.["altrixRole"] === "admin",
  );
  const name =
    [identity.firstName, identity.lastName].filter(Boolean).join(" ") ||
    identity.username ||
    "Patient";

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, userId))
      .limit(1);
    const [currentAdmin] = await tx
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.role, "admin"))
      .limit(1);

    let role = existing?.role === "admin" ? "admin" : "patient";
    if (eligibleForAdmin) {
      if (currentAdmin && currentAdmin.id !== userId) {
        await tx
          .update(userProfilesTable)
          .set({ role: "patient" })
          .where(
            and(
              eq(userProfilesTable.id, currentAdmin.id),
              eq(userProfilesTable.role, "admin"),
            ),
          );
      }
      role = "admin";
    }

    const [profile] = await tx
      .insert(userProfilesTable)
      .values({
        id: userId,
        email,
        name,
        role,
        locale: existing?.locale ?? "en",
      })
      .onConflictDoUpdate({
        target: userProfilesTable.id,
        set: {
          email,
          name,
          role,
          lastSeenAt: new Date(),
        },
      })
      .returning();

    return profile;
  });
}

export async function requireSignedIn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const profile = await ensureProfile(userId);
    (req as AltrixRequest).altrixUserId = userId;
    (req as AltrixRequest).altrixProfile = profile;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to load authenticated patient profile");
    res.status(401).json({ error: "Unable to verify the signed-in account" });
  }
}

export async function requirePatient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireSignedIn(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const profile = (req as AltrixRequest).altrixProfile;
    if (profile?.role !== "patient") {
      res.status(403).json({ error: "Patient access required" });
      return;
    }
    next();
  });
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireSignedIn(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const profile = (req as AltrixRequest).altrixProfile;
    if (profile?.role !== "admin") {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}
