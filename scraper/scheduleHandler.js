const activeSchedules = new Map();

function buildExecutionTimes(scheduleArray) {
  const executionTimes = [];

  scheduleArray.forEach((segment) => {
    const start = Number.parseInt(segment.startTime, 10);
    const end = Number.parseInt(segment.endTime, 10);
    const frequency = Number.parseInt(segment.frequency, 10);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(frequency) ||
      frequency <= 0 ||
      end <= start
    ) {
      return;
    }

    for (let minuteOffset = start + frequency; minuteOffset <= end; minuteOffset += frequency) {
      executionTimes.push(minuteOffset * 60 * 1000);
    }
  });

  return executionTimes.sort((a, b) => a - b);
}

function clearSchedule(scheduleId) {
  const scheduleState = activeSchedules.get(scheduleId);
  if (!scheduleState) {
    return;
  }

  scheduleState.timers.forEach((timerId) => clearTimeout(timerId));
  activeSchedules.delete(scheduleId);
}

export function startSchedule(scheduleArray, options, runJob) {
  const executionTimes = buildExecutionTimes(scheduleArray);
  if (executionTimes.length === 0) {
    throw new Error("No valid schedule windows were provided.");
  }

  if (typeof runJob !== "function") {
    throw new Error("A schedule job runner is required.");
  }

  const scheduleId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const scheduleState = {
    id: scheduleId,
    options,
    timers: [],
    startedAt: new Date().toISOString(),
  };

  const baseTime = Date.now();

  executionTimes.forEach((timeInMs, index) => {
    const timerId = setTimeout(async () => {
      try {
        await runJob({
          ...options,
          scheduleId,
          runIndex: index,
        });
      } catch (error) {
        console.error(`Scheduled scrape ${scheduleId} run ${index} failed:`, error);
      } finally {
        const currentState = activeSchedules.get(scheduleId);
        if (!currentState) {
          return;
        }

        currentState.timers = currentState.timers.filter((currentTimer) => currentTimer !== timerId);
        if (currentState.timers.length === 0) {
          activeSchedules.delete(scheduleId);
        }
      }
    }, Math.max(0, baseTime + timeInMs - Date.now()));

    scheduleState.timers.push(timerId);
  });

  activeSchedules.set(scheduleId, scheduleState);

  return {
    scheduleId,
    scheduledRuns: executionTimes.length,
    nextRunAt: new Date(baseTime + executionTimes[0]).toISOString(),
  };
}

export function stopSchedule(scheduleId) {
  clearSchedule(scheduleId);
}

export function getActiveSchedules() {
  return Array.from(activeSchedules.values()).map((schedule) => ({
    id: schedule.id,
    postUrl: schedule.options?.postUrl,
    email: schedule.options?.email || "",
    startedAt: schedule.startedAt,
    remainingRuns: schedule.timers.length,
  }));
}
