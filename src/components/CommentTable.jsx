import './CommentTable.css';

const sentimentMap = {
    "POS": "正面",
    "NEG": "负面",
    "MIXED": "中性",
    "Loading...": "Loading..."
}

export default function CommentTable(props){
    if (!props.data) return null;

    return (
        <div className="overflow-x-auto">
            <table className="table-fixed w-full text-center border-collapse">
                <thead>
                <tr className="border-b border-slate-100">
                    <th className="w-1/2 py-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">评论</th>
                    <th className="w-1/8 py-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">频率</th>
                    <th className="w-1/8 py-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">点赞</th>
                    <th className="w-1/8 py-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">态度</th>
                    <th className="w-1/8 py-4 text-sm font-semibold text-slate-500 uppercase tracking-wider">CI</th>

                </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {props.data.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="py text-slate-700">{item.comment}</td>
                    <td className="py-4 text-slate-500">{item.freq}</td>
                    <td className="py-4 text-slate-500">{item.like_count}</td>
                    <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.sentiment}`}>
                        {sentimentMap[item.sentiment]}
                        </span>
                    </td>
                    <td>{item.confidence}</td>

                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}