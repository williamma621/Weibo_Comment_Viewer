import { useEffect, useState } from "react";

function createEmptySchedule() {
  return {
    id: Date.now() + Math.random(),
    startTime: "",
    endTime: "",
    frequency: "",
    unit: "minutes",
  };
}

export default function EmailSchedule({ isOpen, onClose, postId, postUrl }) {
  const [email, setEmail] = useState("");
  const [schedules, setSchedules] = useState([createEmptySchedule()]);
  const [patternName, setPatternName] = useState("");
  const [savedPatterns, setSavedPatterns] = useState([]);
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [sendingMail, setSendingMail] = useState(false);
  const [startingMonitor, setStartingMonitor] = useState(false);
  const [savingPattern, setSavingPattern] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadPatterns = async () => {
      try {
        const patterns = await window.api.getSavedSchedulePatterns();
        setSavedPatterns(patterns);
        setSelectedPatternId((current) => current || patterns[0]?.id || "");
      } catch (error) {
        console.error("Failed to load saved schedule patterns", error);
      }
    };

    loadPatterns();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const addSchedule = () => {
    setSchedules((current) => [...current, createEmptySchedule()]);
  };

  const removeSchedule = (id) => {
    setSchedules((current) => current.filter((schedule) => schedule.id !== id));
  };

  const updateSchedule = (id, field, value) => {
    setSchedules((current) =>
      current.map((schedule) => (schedule.id === id ? { ...schedule, [field]: value } : schedule)),
    );
  };

  const startMonitor = async () => {
    setStartingMonitor(true);
    setStatus({ type: "", message: "" });

    try {
      const result = await window.api.setSchedule({ schedules, postId, postUrl, email });
      setStatus({
        type: "success",
        message: `监测已启动，已安排 ${result.scheduledRuns} 次执行。`,
      });
    } catch (error) {
      console.error("Failed to start monitor", error);
      setStatus({ type: "error", message: "监测启动失败，请检查邮箱和时间设置。" });
    } finally {
      setStartingMonitor(false);
    }
  };

  const sendMail = async () => {
    setSendingMail(true);
    setStatus({ type: "", message: "" });

    try {
      await window.api.sendMail({ email, postId });
      setStatus({ type: "success", message: "邮件已发送。" });
    } catch (error) {
      console.error("Failed to send mail", error);
      setStatus({ type: "error", message: "邮件发送失败，请确认邮箱和配置。" });
    } finally {
      setSendingMail(false);
    }
  };

  const savePattern = async () => {
    setSavingPattern(true);
    setStatus({ type: "", message: "" });

    try {
      const savedPattern = await window.api.saveSchedulePattern({
        name: patternName,
        schedules,
      });
      const patterns = await window.api.getSavedSchedulePatterns();
      setSavedPatterns(patterns);
      setSelectedPatternId(savedPattern.id);
      setPatternName(savedPattern.name);
      setStatus({ type: "success", message: `已保存排班模板“${savedPattern.name}”。` });
    } catch (error) {
      console.error("Failed to save schedule pattern", error);
      setStatus({ type: "error", message: "模板保存失败，请先输入名称。" });
    } finally {
      setSavingPattern(false);
    }
  };

  const loadPattern = () => {
    const selectedPattern = savedPatterns.find((pattern) => pattern.id === selectedPatternId);
    if (!selectedPattern) {
      setStatus({ type: "error", message: "请先选择一个已保存模板。" });
      return;
    }

    setSchedules(
      selectedPattern.schedules.length > 0
        ? selectedPattern.schedules.map((schedule) => ({
            ...schedule,
            id: Date.now() + Math.random(),
          }))
        : [createEmptySchedule()],
    );
    setPatternName(selectedPattern.name);
    setStatus({ type: "success", message: `已载入模板“${selectedPattern.name}”。` });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
        <div className="flex items-start justify-between gap-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-8 py-6 text-white">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-200">Monitoring</p>
            <h3 className="text-2xl font-bold">邮件提醒与监测设置</h3>
            <p className="max-w-xl text-sm leading-6 text-slate-200">
              发送当前分析邮件，或为这条微博设置定时监测区间。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            关闭
          </button>
        </div>

        <div className="max-h-[calc(90vh-108px)] overflow-y-auto px-8 py-7">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <label className="mb-2 block text-sm font-semibold text-slate-800">提醒邮箱</label>
                <input
                  type="email"
                  value={email}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="you@company.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  当前报告和后续监测提醒都会发送到这里。
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <label className="min-w-0 flex-1 space-y-2 text-sm font-medium text-slate-700">
                    <span>保存当前排班模板</span>
                    <input
                      type="text"
                      value={patternName}
                      onChange={(e) => setPatternName(e.target.value)}
                      placeholder="例如：午间舆情监测"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={savePattern}
                    disabled={savingPattern}
                    className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPattern ? "保存中..." : "保存模板"}
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
                  <label className="min-w-0 flex-1 space-y-2 text-sm font-medium text-slate-700">
                    <span>载入已保存模板</span>
                    <select
                      value={selectedPatternId}
                      onChange={(e) => setSelectedPatternId(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">选择模板</option>
                      {savedPatterns.map((pattern) => (
                        <option key={pattern.id} value={pattern.id}>
                          {pattern.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={loadPattern}
                    className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    载入模板
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">监测时间段</h4>
                    <p className="text-sm text-slate-500">按分钟填写区间与触发频率。</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSchedule}
                    className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100"
                  >
                    + 新的时间段
                  </button>
                </div>

                <div className="space-y-3">
                  {schedules.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          时间段 {index + 1}
                        </span>
                        {schedules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSchedule(schedule.id)}
                            className="text-sm font-medium text-rose-500 transition hover:text-rose-700"
                          >
                            删除
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="space-y-2 text-sm font-medium text-slate-700">
                          <span>开始</span>
                          <input
                            type="number"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            value={schedule.startTime}
                            onChange={(e) => updateSchedule(schedule.id, "startTime", e.target.value)}
                          />
                        </label>

                        <label className="space-y-2 text-sm font-medium text-slate-700">
                          <span>结束</span>
                          <input
                            type="number"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            value={schedule.endTime}
                            onChange={(e) => updateSchedule(schedule.id, "endTime", e.target.value)}
                          />
                        </label>

                        <label className="space-y-2 text-sm font-medium text-slate-700">
                          <span>频率-分钟</span>
                          <input
                            type="number"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            value={schedule.frequency}
                            onChange={(e) => updateSchedule(schedule.id, "frequency", e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {status.message && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                    status.type === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {status.message}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-lg shadow-slate-900/10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">Quick Actions</p>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={startMonitor}
                    disabled={startingMonitor}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingMonitor ? "启动监测中..." : "开始监测"}
                  </button>

                  <button
                    type="button"
                    onClick={sendMail}
                    disabled={sendingMail}
                    className="w-full rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingMail ? "发送中..." : "立刻发送邮件"}
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">使用提示</h4>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>开始和结束时间按照分钟输入，结束值需要大于开始值。</li>
                  <li>系统会在每个时间段内按设定频率执行抓取与分析。</li>
                  <li>若检测到非正面评论，定时任务会发送提醒邮件。</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Target</p>
                <p className="mt-3 break-all text-sm leading-6 text-slate-700">{postUrl}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
