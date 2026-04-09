/**
 * Timezone Data Export Utility
 *
 * Provides utilities to export country timezone data in various formats
 * for testing, documentation, and external system integration.
 */

import { COUNTRY_TIMEZONES } from "./country-timezones";
import { executeQuery } from "../db/postgres";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Export format options
 */
export type ExportFormat = "json" | "csv" | "sql" | "markdown";

/**
 * Export source options
 */
export type ExportSource = "memory" | "database";

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  source: ExportSource;
  count: number;
  data?: string;
  filePath?: string;
  error?: string;
}

/**
 * Export country timezones from memory (data file)
 *
 * @param format Export format (json, csv, sql, markdown)
 * @param filePath Optional file path to save export
 * @returns Promise<ExportResult> Export result with data
 */
export async function exportTimezonesFromMemory(
  format: ExportFormat = "json",
  filePath?: string,
): Promise<ExportResult> {
  const result: ExportResult = {
    success: false,
    format,
    source: "memory",
    count: COUNTRY_TIMEZONES.length,
  };

  try {
    let data: string;

    switch (format) {
      case "json":
        data = JSON.stringify(COUNTRY_TIMEZONES, null, 2);
        break;

      case "csv":
        data = convertToCSV(COUNTRY_TIMEZONES);
        break;

      case "sql":
        data = convertToSQL(COUNTRY_TIMEZONES);
        break;

      case "markdown":
        data = convertToMarkdown(COUNTRY_TIMEZONES);
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    result.data = data;

    // Save to file if path provided
    if (filePath) {
      await fs.writeFile(filePath, data, "utf-8");
      result.filePath = filePath;
    }

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Export country timezones from database
 *
 * @param format Export format (json, csv, sql, markdown)
 * @param filePath Optional file path to save export
 * @returns Promise<ExportResult> Export result with data
 */
export async function exportTimezonesFromDatabase(
  format: ExportFormat = "json",
  filePath?: string,
): Promise<ExportResult> {
  const result: ExportResult = {
    success: false,
    format,
    source: "database",
    count: 0,
  };

  try {
    // Fetch all records from database
    const rows = await executeQuery(`
      SELECT
        country_code,
        country_name,
        default_timezone,
        business_hours_start,
        business_hours_end,
        weekend_days
      FROM country_timezones
      ORDER BY country_name ASC
    `);

    result.count = rows.length;

    let data: string;

    switch (format) {
      case "json":
        data = JSON.stringify(rows, null, 2);
        break;

      case "csv":
        data = convertToCSV(rows);
        break;

      case "sql":
        data = convertToSQL(rows);
        break;

      case "markdown":
        data = convertToMarkdown(rows);
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    result.data = data;

    // Save to file if path provided
    if (filePath) {
      await fs.writeFile(filePath, data, "utf-8");
      result.filePath = filePath;
    }

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Export statistics and summary
 *
 * @returns Promise<Object> Summary statistics
 */
export async function exportTimezoneStats(): Promise<{
  totalCountries: number;
  weekendPatterns: Record<string, number>;
  businessHoursRanges: Record<string, number>;
  timezones: Record<string, number>;
}> {
  const stats = {
    totalCountries: COUNTRY_TIMEZONES.length,
    weekendPatterns: {} as Record<string, number>,
    businessHoursRanges: {} as Record<string, number>,
    timezones: {} as Record<string, number>,
  };

  // Count weekend patterns
  COUNTRY_TIMEZONES.forEach((country) => {
    const pattern = country.weekend_days.sort().join(", ");
    stats.weekendPatterns[pattern] = (stats.weekendPatterns[pattern] || 0) + 1;

    // Count business hours ranges
    const range = `${country.business_hours_start}-${country.business_hours_end}`;
    stats.businessHoursRanges[range] =
      (stats.businessHoursRanges[range] || 0) + 1;

    // Count timezones
    stats.timezones[country.default_timezone] =
      (stats.timezones[country.default_timezone] || 0) + 1;
  });

  return stats;
}

/**
 * Convert timezone data to CSV format
 */
function convertToCSV(data: any[]): string {
  const headers = [
    "country_code",
    "country_name",
    "default_timezone",
    "business_hours_start",
    "business_hours_end",
    "weekend_days",
  ];

  const csvRows = [
    headers.join(","),
    ...data.map((row) => {
      const values = [
        row.country_code,
        `"${row.country_name}"`,
        row.default_timezone,
        row.business_hours_start,
        row.business_hours_end,
        `"${row.weekend_days.join("; ")}"`,
      ];
      return values.join(",");
    }),
  ];

  return csvRows.join("\n");
}

/**
 * Convert timezone data to SQL INSERT statements
 */
function convertToSQL(data: any[]): string {
  const statements = data.map((row) => {
    return `INSERT INTO country_timezones (country_code, country_name, default_timezone, business_hours_start, business_hours_end, weekend_days) VALUES ('${row.country_code}', '${row.country_name.replace(/'/g, "''")}', '${row.default_timezone}', '${row.business_hours_start}', '${row.business_hours_end}', ARRAY[${row.weekend_days.map((d: string) => `'${d}'`).join(", ")}]) ON CONFLICT (country_code) DO UPDATE SET country_name = EXCLUDED.country_name, default_timezone = EXCLUDED.default_timezone, business_hours_start = EXCLUDED.business_hours_start, business_hours_end = EXCLUDED.business_hours_end, weekend_days = EXCLUDED.weekend_days;`;
  });

  return `-- Country Timezones SQL Export\n-- Generated: ${new Date().toISOString()}\n\n${statements.join("\n")}`;
}

/**
 * Convert timezone data to Markdown table
 */
function convertToMarkdown(data: any[]): string {
  const markdown = [
    "# Country Timezones Reference",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Total Countries: ${data.length}`,
    "",
    "| Country Code | Country Name | Timezone | Business Hours | Weekend |",
    "|--------------|--------------|----------|----------------|---------|",
  ];

  data.forEach((row) => {
    markdown.push(
      `| ${row.country_code} | ${row.country_name} | ${row.default_timezone} | ${row.business_hours_start}-${row.business_hours_end} | ${row.weekend_days.join(", ")} |`,
    );
  });

  return markdown.join("\n");
}

/**
 * Validate timezone data integrity
 *
 * @param source Data source ('memory' or 'database')
 * @returns Promise<{valid: boolean, errors: string[]}>
 */
export async function validateTimezoneData(
  source: ExportSource = "memory",
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const result = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
  };

  try {
    const data =
      source === "memory"
        ? COUNTRY_TIMEZONES
        : await executeQuery("SELECT * FROM country_timezones");

    // Validate required fields
    data.forEach((row: any, index: number) => {
      if (!row.country_code || row.country_code.length !== 2) {
        result.errors.push(
          `Row ${index}: Invalid country_code '${row.country_code}'`,
        );
        result.valid = false;
      }

      if (!row.country_name) {
        result.errors.push(`Row ${index}: Missing country_name`);
        result.valid = false;
      }

      if (!row.default_timezone) {
        result.errors.push(`Row ${index}: Missing default_timezone`);
        result.valid = false;
      }

      // Validate timezone format
      try {
        Intl.DateTimeFormat(undefined, { timeZone: row.default_timezone });
      } catch {
        result.errors.push(
          `Row ${index}: Invalid IANA timezone '${row.default_timezone}'`,
        );
        result.valid = false;
      }

      // Validate business hours format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(row.business_hours_start)) {
        result.errors.push(
          `Row ${index}: Invalid business_hours_start '${row.business_hours_start}'`,
        );
        result.valid = false;
      }
      if (!timeRegex.test(row.business_hours_end)) {
        result.errors.push(
          `Row ${index}: Invalid business_hours_end '${row.business_hours_end}'`,
        );
        result.valid = false;
      }

      // Validate weekend days
      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      if (!Array.isArray(row.weekend_days) || row.weekend_days.length === 0) {
        result.errors.push(
          `Row ${index}: weekend_days must be a non-empty array`,
        );
        result.valid = false;
      } else {
        row.weekend_days.forEach((day: string) => {
          if (!validDays.includes(day)) {
            result.errors.push(`Row ${index}: Invalid weekend day '${day}'`);
            result.valid = false;
          }
        });
      }

      // Warnings for unusual patterns
      if (row.weekend_days.length === 1 && row.weekend_days[0] !== "Sunday") {
        result.warnings.push(
          `Row ${index}: Single-day weekend '${row.weekend_days[0]}' is unusual`,
        );
      }
    });
  } catch (error) {
    result.valid = false;
    result.errors.push(`Validation error: ${error}`);
  }

  return result;
}

/**
 * Quick export helper - exports JSON to console or file
 *
 * @param filePath Optional file path
 */
export async function quickExport(filePath?: string): Promise<void> {
  const result = await exportTimezonesFromMemory("json", filePath);

  if (result.success) {
    console.log(`✅ Exported ${result.count} countries`);
    if (result.filePath) {
      console.log(`📁 Saved to: ${result.filePath}`);
    }
  } else {
    console.error(" Export failed:", result.error);
  }
}
