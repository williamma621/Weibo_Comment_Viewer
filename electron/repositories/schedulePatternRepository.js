import path from "path";
import * as fs from "node:fs/promises";

function sanitizeFileName(name) {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function normalizeSchedules(schedules = []) {
  return schedules.map((schedule) => ({
    id: schedule.id || Date.now() + Math.random(),
    startTime: String(schedule.startTime ?? ""),
    endTime: String(schedule.endTime ?? ""),
    frequency: String(schedule.frequency ?? ""),
    unit: schedule.unit || "minutes",
  }));
}

export function createSchedulePatternRepository(dataPath) {
  async function ensureDataDir() {
    await fs.mkdir(dataPath, { recursive: true });
  }

  async function savePattern({ name, schedules }) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      throw new Error("Schedule pattern name is required.");
    }

    await ensureDataDir();

    const payload = {
      id: Date.now().toString(),
      name: trimmedName,
      schedules: normalizeSchedules(schedules),
      updatedAt: new Date().toISOString(),
    };

    const safeFileName = sanitizeFileName(trimmedName) || payload.id;
    const filePath = path.join(dataPath, `${safeFileName}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  }

  async function listPatterns() {
    await ensureDataDir();
    const files = await fs.readdir(dataPath);
    const patterns = [];

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }

      try {
        const content = await fs.readFile(path.join(dataPath, file), "utf8");
        const data = JSON.parse(content);
        patterns.push({
          id: data.id || file.replace(/\.json$/i, ""),
          name: data.name || file.replace(/\.json$/i, ""),
          schedules: normalizeSchedules(data.schedules),
          updatedAt: data.updatedAt || "",
        });
      } catch (error) {
        console.error(`Error reading schedule pattern ${file}:`, error);
      }
    }

    return patterns.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  return {
    ensureDataDir,
    savePattern,
    listPatterns,
  };
}
