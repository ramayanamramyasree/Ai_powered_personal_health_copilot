import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const languagesTable = pgTable(
  "altrix_languages",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    nativeName: text("native_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (table) => [uniqueIndex("altrix_languages_code_idx").on(table.code)],
);

export const userProfilesTable = pgTable(
  "altrix_user_profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull().default("Patient"),
    locale: text("locale").notNull().default("en"),
    role: text("role").notNull().default("patient"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("altrix_only_one_admin").on(table.role).where(sql`${table.role} = 'admin'`),
    index("altrix_profiles_created_at_idx").on(table.createdAt),
  ],
);

export const medicalDocumentsTable = pgTable(
  "altrix_medical_documents",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => userProfilesTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    documentType: text("document_type").notNull(),
    status: text("status").notNull().default("uploaded"),
    extractedText: text("extracted_text"),
    summary: text("summary"),
    translatedSummary: text("translated_summary"),
    summaryLocale: text("summary_locale"),
    extraction: jsonb("extraction").$type<Record<string, unknown> | null>(),
    confidence: real("confidence"),
    requiresReview: boolean("requires_review").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("altrix_documents_owner_created_idx").on(table.ownerId, table.createdAt),
    index("altrix_documents_status_idx").on(table.status),
  ],
);

export const patientFeedbackTable = pgTable(
  "altrix_patient_feedback",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => userProfilesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("other"),
    rating: integer("rating"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("altrix_feedback_created_idx").on(table.createdAt)],
);

export const translationsTable = pgTable(
  "altrix_translations",
  {
    id: text("id").primaryKey(),
    locale: text("locale").notNull(),
    translationKey: text("translation_key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("altrix_translation_locale_key_idx").on(table.locale, table.translationKey),
  ],
);

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  createdAt: true,
  lastSeenAt: true,
});
export const insertLanguageSchema = createInsertSchema(languagesTable);
export const insertMedicalDocumentSchema = createInsertSchema(medicalDocumentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertPatientFeedbackSchema = createInsertSchema(patientFeedbackTable).omit({
  createdAt: true,
});
export const insertTranslationSchema = createInsertSchema(translationsTable).omit({
  updatedAt: true,
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type Language = typeof languagesTable.$inferSelect;
export type MedicalDocument = typeof medicalDocumentsTable.$inferSelect;
export type PatientFeedback = typeof patientFeedbackTable.$inferSelect;
export type Translation = typeof translationsTable.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type InsertMedicalDocument = z.infer<typeof insertMedicalDocumentSchema>;
export type InsertPatientFeedback = z.infer<typeof insertPatientFeedbackSchema>;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
