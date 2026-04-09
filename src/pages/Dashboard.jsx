import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SentimentChart from "../components/SentimentChart";
import CommentTable from "../components/CommentTable";
import SummaryDisplay from "../components/SummaryDisplay";
import EmailSchedule from "../components/EmailSchedule";

export default function Dashboard() {
  const { postId } = useParams();
  const [data, setData] = useState(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const result = await window.api.getScrapeById(postId);
      setData(result);
    };
    loadData();
  }, [postId]);

  if (!data) return <div>Loading analysis...</div>;
  const duplicatedComments = data.comments.filter((comment) => (comment.freq ?? 0) >= 3);
  const negativeComments = data.comments.filter((comment) => comment.sentiment !== "POS");

  return (
    <div className="relative">
      <div className="mb-8 flex flex-col gap-5 rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-100 p-7 shadow-soft lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-indigo-700">
            Dashboard
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">分析数据</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              查看情感分布、关键词总结和热点评论，并在需要时通过邮件监测面板设置提醒。
            </p>
          </div>
          <div className="inline-flex max-w-full items-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm">
            <span className="mr-3 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              Post URL
            </span>
            <span className="truncate">{data.url}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsScheduleOpen(true)}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          邮件提醒与监测
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 overflow-auto">
        <div className="col-span-12 space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-bold text-slate-900">评论区情感分析</h2>
            <SentimentChart data={data.comments} />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <SummaryDisplay data={data.summary} />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-bold text-slate-900">前五热评</h2>
            <CommentTable data={data.top_comments} />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">重复评论</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {duplicatedComments.length} entries
              </span>
            </div>
            <CommentTable data={duplicatedComments} />
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">负面/混合情绪评论</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {negativeComments.length} entries
              </span>
            </div>
            <CommentTable data={negativeComments} />
          </section>
        </div>
      </div>

      <EmailSchedule
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        postId={postId}
        postUrl={data.url}
      />
    </div>
  );
}
