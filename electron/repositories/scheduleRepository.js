import path from "path";
import * as fs from "node:fs/promises";

function normalizeOptions(options = {}) {
  return {
    postId: options.postId || "",
    postUrl: options.postUrl || "",
    email: options.email || "",
  };
}

export function createScheduleRepository(dataPath) {
  async function ensureDataDir() {
    await fs.mkdir(dataPath, { recursive: true });
  }

  async function writeScheduleFile(schedule) {
    await ensureDataDir();
    const filePath = path.join(dataPath, `${schedule.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(schedule, null, 2), "utf8");
  }

  async function readScheduleFile(filePath) {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  async function saveActiveSchedule({ id, schedules, options, startedAt, status = "active" }) {
    if (!id) {
      throw new Error("Schedule id is required.");
    }
    const payload = {
      id,
      schedules: schedules || [],
      options: normalizeOptions(options),
      startedAt: startedAt || new Date().toISOString(),
      status,
      lastRunAt: "",
      remainingRuns: null,
    };
    await writeScheduleFile(payload);
    return payload;
  }

  async function updateSchedule(id, updates = {}) {
    await ensureDataDir();
    const filePath = path.join(dataPath, `${id}.json`);
    const current = await readScheduleFile(filePath);
    const payload = {
      ...current,
      ...updates,
      options: normalizeOptions({ ...current.options, ...updates.options }),
    };
    await writeScheduleFile(payload);
    return payload;
  }

  async function listActiveSchedules() {
    await ensureDataDir();
    const files = await fs.readdir(dataPath);
    const schedules = [];

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }
      try {
        const data = await readScheduleFile(path.join(dataPath, file));
        if (data.status === "active") {
          schedules.push(data);
        }
      } catch (error) {
        console.error(`Error reading active schedule ${file}:`, error);
      }
    }

    return schedules;
  }

  return {
    saveActiveSchedule,
    updateSchedule,
    listActiveSchedules,
  };
}
