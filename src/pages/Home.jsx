import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [postUrl, setPostUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("")
  const navigate = useNavigate();

  const handleFetch = async () => {
    if (!postUrl) return alert("Please enter a URL");
    setLoading(true);
    try {
      setLoadingText("爬取中...")
      const rawComments = await window.api.getCommentsPipeline({ postUrl });
      setLoadingText("Deepseek分析中...")
      const [comments, summary] = await window.api.deepseekAnalysisPipeline({ comments: rawComments, postUrl:postUrl });
      setLoadingText("结果保存中...")
      console.log(rawComments.slice(0, 5))
      const new_window_id = await window.api.saveScrape({ comments, summary, postUrl, top_comments: rawComments.slice(0, 5) });
      navigate(`/dashboard/${new_window_id}`);
    } catch (error) {
      console.error("Scrape failed", error);
    } finally {
      setLoading(false);
    }
  };

    return (
// Home.jsx
<div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-6">
  <h1 className="text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
    微博帖子抓取
  </h1>
  <p className="text-slate-500 mb-8 text-lg">
    请在下方输入链接
  </p>
  
  <div className="w-full bg-white p-2 rounded-2xl shadow-soft border border-slate-100 flex items-center gap-2">
    <input 
      type="url" 
      value={postUrl} 
      onChange={(e) => setPostUrl(e.target.value)} 
      placeholder="https://weibo.com/..."
      className="flex-1 px-4 py-3 bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
    />
    <button 
      onClick={handleFetch} 
      disabled={loading}
      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
    >
      {loading ? loadingText : "开始分析"}
    </button>
  </div>
</div>  

  )
}

