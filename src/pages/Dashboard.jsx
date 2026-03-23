import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SentimentChart from "../components/SentimentChart";
import CommentTable from "../components/CommentTable";
import SummaryDisplay from "../components/SummaryDisplay";
import EmailSchedule from "../components/EmailSchedule";

export default function Dashboard() {
  const { postId } = useParams(); // Grabs the ID from the URL
  const [data, setData] = useState(null);
  useEffect(() => {
    const loadData = async () => {
      const result = await window.api.getScrapeById(postId);
      setData(result);
    };
    loadData();
  }, [postId]); // Reloads if the user clicks a different post in the sidebar
  console.log("123456", postId)
  if (!data) return <div>Loading analysis...</div>;



  return (
    // Dashboard.jsx
      <div className="grid grid-cols-12 gap-8 overflow-auto">
        {/* Main Analysis */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <h2 className="text-3xl font-extrabold text-slate-900">分析数据</h2>

          <h2> 评论区感情分析 </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
            <SentimentChart data={data.comments} />
          </div>


          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
            <SummaryDisplay data={data.summary} />
          </div>

          <h2>前五热评</h2>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
            <CommentTable data={data.top_comments} />
          </div>

          <h2> 全部评论 </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
            <CommentTable data={data.comments} />
          </div>


        </div>

        {/* Sidebar Controls */}
        <EmailSchedule postId={ postId } postUrl={data.url} ></EmailSchedule>
      </div>
  );
}

