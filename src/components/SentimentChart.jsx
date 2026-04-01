import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import './SentimentChart.css';

const SENTIMENT_LABELS = {
  POS: { en: 'POS', zh: '正面', fill: '#4caf50' },
  NEG: { en: 'NEG', zh: '负面', fill: '#f44336' },
  MIXED: { en: 'MIXED', zh: '中性', fill: '#ff9800' },
  UNKNOWN: { en: 'UNKNOWN', zh: '未评', fill: '#94a3b8' },
};

function getSentimentStats(data) {
  const counts = { POS: 0, NEG: 0, MIXED: 0, UNKNOWN: 0 };

  data.forEach((item) => {
    const sentiment = SENTIMENT_LABELS[item.sentiment] ? item.sentiment : 'UNKNOWN';
    counts[sentiment] += item.freq ?? 0;
  });

  const visibleTotal = Object.values(counts).reduce((total, value) => total + value, 0);
  const chartData = ['POS', 'NEG', 'MIXED', 'UNKNOWN'].map((key) => ({
    name: SENTIMENT_LABELS[key].en,
    value: counts[key],
    fill: SENTIMENT_LABELS[key].fill,
  }));
  const statLines = ['POS', 'NEG', 'MIXED', 'UNKNOWN'].flatMap((key) => {
    const value = counts[key];
    const percentage = visibleTotal === 0 ? '0.0' : ((value / visibleTotal) * 100).toFixed(2);

    return [
      `${SENTIMENT_LABELS[key].en}: ${value} (${percentage}%)`,
      `${SENTIMENT_LABELS[key].zh}: ${value} (${percentage}%)`,
    ];
  });

  return { chartData, visibleTotal, statLines };
}

export default function SentimentChart(props) {
  const allComments = props.data;

  if (!allComments) {
    return <div></div>;
  }

  const { chartData, visibleTotal, statLines } = getSentimentStats(allComments);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
        <h4 className="text-sm font-semibold text-slate-900 mb-6">Overall Sentiment</h4>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Visible Comment Stats</h4>
        <div className="space-y-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Visible total: {visibleTotal}</p>
          <p className="font-semibold text-slate-900">当前可见评论总数： {visibleTotal}</p>
          {statLines.map((line) => (
            <p key={line} className="leading-6">{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

