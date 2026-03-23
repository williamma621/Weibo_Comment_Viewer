import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import './SentimentChart.css';

export default function SentimentChart(props){

  const getSentimentStats = (data) => {
    const counts = { POS: 0, NEG: 0, MIXED: 0 };
    data.forEach(item => {
      if (counts[item.sentiment] !== undefined) {
        counts[item.sentiment]+= item.freq;
      }
    });

    // Convert to Recharts format
    return [
      { name: 'Positive', value: counts.POS, fill: '#4caf50' },
      { name: 'Mixed', value: counts.MIXED, fill: '#ff9800' },
      { name: 'Negative', value: counts.NEG, fill: '#f44336' },
    ];
  };


  const allComments = props.data
  if (!allComments){
    return (<div></div>)
  }
  const recent50 = allComments.slice(0, 50);
  
  const allStats = getSentimentStats(allComments);
  const recentStats = getSentimentStats(recent50);

  return (
    <div className="space-y-6">
          {/* Container for the chart cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { title: "Overall Sentiment (All)", data: allStats }, // Replace with your actual data logic
              { title: "Recent 50 Comments Trend", data: recentStats }
            ].map((chart, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft">
                <h4 className="text-sm font-semibold text-slate-900 mb-6">{chart.title}</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart.data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
                        cursor={{ fill: '#F1F5F9' }} // Subtle hover background
                        contentStyle={{ 
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {chart.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || '#4F46E5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
    </div>
  );
};