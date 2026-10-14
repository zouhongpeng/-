import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, timestamp, integer, jsonb, index, date, serial, boolean,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 系统表：禁止删除
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============ 人物档案 ============
export const people = pgTable(
  "people",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 64 }).notNull(),
    relationship: varchar("relationship", { length: 64 }).notNull().default(""),
    background: text("background").default(""),
    avatar_color: varchar("avatar_color", { length: 32 }).default(""),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("people_created_at_idx").on(table.created_at),
  ]
);

// ============ 重要日期 ============
export const importantDates = pgTable(
  "important_dates",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    person_id: varchar("person_id", { length: 36 }).notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    // 存 "MM-DD"（如 11-02），配合年份可选；month_day 便于提前提醒计算
    month_day: varchar("month_day", { length: 5 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("important_dates_person_id_idx").on(table.person_id),
  ]
);

// ============ 分析记录 / 时间线 ============
export const analysisRecords = pgTable(
  "analysis_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    person_id: varchar("person_id", { length: 36 }).notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    chat_input: text("chat_input").default(""),
    thought_input: text("thought_input").default(""),
    // 结构化分析结果：对面在想什么 / 建议回复 / 注意事项 / 温度标签
    result: jsonb("result").notNull(),
    temp_label: varchar("temp_label", { length: 4 }).notNull(), // 热/温/冷
    temp_reason: text("temp_reason").default(""),
    // 进度：生成中 → 完成
    status: varchar("status", { length: 16 }).notNull().default("done"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("analysis_records_person_id_idx").on(table.person_id),
    index("analysis_records_created_at_idx").on(table.created_at),
  ]
);

// ============ 关系温度（独立趋势点，与分析联动）============
export const temperaturePoints = pgTable(
  "temperature_points",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    person_id: varchar("person_id", { length: 36 }).notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 4 }).notNull(), // 热/温/冷
    reason: text("reason").default(""),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("temperature_points_person_id_idx").on(table.person_id),
  ]
);

// ============ 沟通周报 ============
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    week_start: date("week_start").notNull(),
    content: jsonb("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("weekly_reports_week_start_idx").on(table.week_start),
  ]
);

// ============ 设置（单行配置：PIN + 成长模式）============
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    pin_hash: varchar("pin_hash", { length: 128 }).notNull(),
    growth_mode: varchar("growth_mode", { length: 16 }).notNull().default("canned"), // canned/hint/critique
    moderation: boolean("moderation").notNull().default(false), // 节制机制开关（默认关闭）
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const insertPersonSchema = createCoercedInsertSchema(people).pick({ name: true, relationship: true, background: true, avatar_color: true });
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;

export const insertImportantDateSchema = createCoercedInsertSchema(importantDates).pick({ person_id: true, name: true, month_day: true });
export type ImportantDate = typeof importantDates.$inferSelect;

export const insertAnalysisRecordSchema = createCoercedInsertSchema(analysisRecords).pick({ person_id: true, chat_input: true, thought_input: true, result: true, temp_label: true, temp_reason: true, status: true });
export type AnalysisRecord = typeof analysisRecords.$inferSelect;

export const insertTemperaturePointSchema = createCoercedInsertSchema(temperaturePoints).pick({ person_id: true, label: true, reason: true });
export type TemperaturePoint = typeof temperaturePoints.$inferSelect;

export const insertWeeklyReportSchema = createCoercedInsertSchema(weeklyReports).pick({ week_start: true, content: true });
export type WeeklyReport = typeof weeklyReports.$inferSelect;

export const insertSettingsSchema = createCoercedInsertSchema(settings).pick({ pin_hash: true, growth_mode: true });
export type SettingsRow = typeof settings.$inferSelect;