const SummaryDisplay = ({ data }) => {
  if (!data) return null;
  const { keywords, summary } = data;
  return (
    <div className="space-y-8">
      {/* Keywords Section */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">主要关键点</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {keywords.map((item, index) => (
            <div key={index} className="bg-white p-5 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                  {item.keyword}
                </span>
              </div>
              <ul className="space-y-2">
                {item.supporting_comments.slice(0, 3).map((comment, idx) => (
                  <li key={idx} className="text-xs text-slate-500 leading-relaxed">
                    • {comment}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      
      {/* Executive Summary */}
      <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-20 -mr-20 -mt-20"></div>
        <h3 className="text-xl font-bold mb-4">全局总结</h3>
        <p className="text-indigo-100 leading-relaxed text-lg max-w-3xl">
          {summary}
        </p>
      </div>
    </div>
  );
};

export default SummaryDisplay;


