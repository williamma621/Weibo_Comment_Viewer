import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function SavedScrapesList() {
  const [list, setList] = useState([]);
  const { postId } = useParams(); // To highlight the active item

  const fetchList = async () => {
    const saved = await window.api.getSavedScrapes();
    // Sort by date (newest first)
    setList(saved.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  useEffect(() => {
    fetchList();
    // Optional: Listen for a 'scrape-finished' event from IPC to auto-refresh
  }, [postId]); 

  fetchList()

  return (
<div className="space-y-0.5">
  <h4 className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"> 历史记录 </h4>
  
  {list.length === 0 && (
    <p className="px-2 text-[10px] text-slate-400 italic">No scrapes.</p>
  )}
  
  {list.map((item) => (
    <Link 
      key={item.id} 
      to={`/dashboard/${item.id}`} 
      className={`
        block px-2 py-1.5 rounded-lg text-xs transition-all duration-200 border-l-2
        ${postId === item.id 
          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-medium' 
          : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
      `}
    >
      <div className="truncate">{item.display_name}</div>
      <div className="text-[10px] opacity-70 mt-0.5">
        {new Date(item.date).toLocaleDateString()}
      </div>
    </Link>
  ))}
</div>);
}