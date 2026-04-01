import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

const SCRAPE_HISTORY_CHANGED_EVENT = "scrape-history-changed";

export default function SavedScrapesList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const { postId } = useParams(); // To highlight the active item
  const navigate = useNavigate();

  useEffect(() => {
    let isCancelled = false;

    const fetchList = async () => {
      setLoading(true);
      setError("");

      try {
        const saved = await window.api.getSavedScrapes();
        if (isCancelled) {
          return;
        }

        setList([...saved].sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (fetchError) {
        if (isCancelled) {
          return;
        }

        console.error("Failed to load saved scrapes", fetchError);
        setError("加载失败");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchList();
    window.addEventListener(SCRAPE_HISTORY_CHANGED_EVENT, fetchList);

    return () => {
      isCancelled = true;
      window.removeEventListener(SCRAPE_HISTORY_CHANGED_EVENT, fetchList);
    };
  }, [postId]);

  const handleDelete = async (itemId) => {
    const confirmed = window.confirm("Delete this scrape history permanently?");
    if (!confirmed) {
      return;
    }

    setDeletingId(itemId);
    setError("");

    try {
      await window.api.deleteScrape(itemId);
      setList((currentList) => currentList.filter((item) => item.id !== itemId));
      window.dispatchEvent(new CustomEvent(SCRAPE_HISTORY_CHANGED_EVENT, { detail: { type: "deleted", postId: itemId } }));

      if (postId === itemId) {
        navigate("/");
      }
    } catch (deleteError) {
      console.error("Failed to delete scrape", deleteError);
      setError("删除失败");
    } finally {
      setDeletingId("");
    }
  };

  return (
<div className="flex h-full min-h-0 flex-col">
  <h4 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"> 历史记录 </h4>

  {loading && (
    <p className="px-2 text-[10px] text-slate-400 italic">Loading...</p>
  )}

  {error && (
    <p className="px-2 text-[10px] text-red-500">{error}</p>
  )}
  
  {!loading && !error && list.length === 0 && (
    <p className="px-2 text-[10px] text-slate-400 italic">No scrapes.</p>
  )}

  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
    {list.map((item) => (
      <div
        key={item.id}
        className={`rounded-lg border-l-2 transition-all duration-200 ${
          postId === item.id
            ? "bg-indigo-50 border-indigo-600"
            : "border-transparent hover:bg-slate-50"
        }`}
      >
        <div className="flex items-start gap-2 px-2 py-1.5">
          <Link
            to={`/dashboard/${item.id}`}
            className={`min-w-0 flex-1 text-xs ${
              postId === item.id
                ? "text-indigo-700 font-medium"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="truncate">{item.display_name}</div>
            <div className="mt-0.5 text-[10px] opacity-70">
              {new Date(item.date).toLocaleDateString()}
            </div>
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(item.id)}
            disabled={deletingId === item.id}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Delete scrape ${item.display_name}`}
          >
            {deletingId === item.id ? "..." : "删"}
          </button>
        </div>
      </div>
    ))}
  </div>
</div>);
}
