import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SCRAPE_HISTORY_CHANGED_EVENT = "scrape-history-changed";

export default function Home() {
  const [postUrl, setPostUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("")
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await window.api.loginWeibo();
    } catch (error) {
      console.error("Weibo login failed", error);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!postUrl) return alert("Please enter a URL");
    setLoading(true);
    try {
      setLoadingText("爬取中...")
      const { comments: rawComments, topComments: rawTopComments } = await window.api.getCommentsPipeline({ postUrl });
      setLoadingText("Deepseek分析中...")
      const [comments, summary] = await window.api.deepseekAnalysisPipeline({ comments: rawComments, postUrl:postUrl });
      setLoadingText("结果保存中...")
      const topComments = rawTopComments.map((topComment) => {
        const analyzedComment = comments.find((comment) => comment.comment === topComment.comment);
        return analyzedComment
          ? {
              ...topComment,
              sentiment: analyzedComment.sentiment,
              confidence: analyzedComment.confidence,
            }
          : topComment;
      });
      const new_window_id = await window.api.saveScrape({ comments, summary, postUrl, top_comments: topComments });
      window.dispatchEvent(new CustomEvent(SCRAPE_HISTORY_CHANGED_EVENT, { detail: { type: "created", postId: new_window_id } }));
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

    <div className="mb-4 flex w-full justify-end">
    <button
      onClick={handleLogin}
      disabled={loginLoading || loading}
      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
    >
      {loginLoading ? "登录中..." : "登录微博 / 切换账号"}
    </button>
  </div>
  
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

)}

