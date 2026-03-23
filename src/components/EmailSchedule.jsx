import { useState } from "react";

export default function EmailSchedule(props){
    const [email, setEmail] = useState('');
    const [schedules, setSchedules] = useState([]);
    
      // Add a new empty schedule
    const addSchedule = () => {
        const newSchedule = {
        id: Date.now(), // Simple unique ID
        startTime: '',
        endTime: '',
        frequency: '',
        unit: 'minutes',
        };
        setSchedules([...schedules, newSchedule]);
    };

    // Remove a schedule by ID
    const removeSchedule = (id) => {
        setSchedules(schedules.filter((s) => s.id !== id));
    };

    // Update a specific field in a schedule
    const updateSchedule = (id, field, value) => {
        setSchedules(
        schedules.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    const startMonitor = async () => {
        await window.api.setSchedule({schedules, postUrl: props.postUrl, email})
    }
    
    const sendMail = async() => {
        console.log("987654321", props.postId)
        await window.api.sendMail({email, postId: props.postId});
    };

    return(
    <div className="col-span-12 lg:col-span-3 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-soft sticky top-0">
        <h3 className="font-semibold text-slate-900 mb-4">设置</h3>
        <label className="block text-sm font-medium text-slate-700 mb-2">自动邮件提醒</label>
        <input 
            type="email" 
            className="w-full rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-500 p-2 border mb-6"
            placeholder="you@company.com"
            onChange={(e) => setEmail(e.target.value)} 
        />
        
        <h3 className="font-semibold text-slate-900 mb-4"> 监测时间 </h3>
        <div className="space-y-4">
            {schedules.map((schedule) => (
            <div 
                key={schedule.id} 
                className="items-center gap-2 p-3 mb-3 bg-white border border-slate-200 rounded-xl shadow-sm"
            >
                {/* Input Classes: Standardized border, rounded corners, and focus ring */}
                <label> 开始 </label><input
                type="number"
                className="w-40 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={schedule.startTime}
                onChange={(e) => updateSchedule(schedule.id, 'startTime', e.target.value)}
                />
                
                <label> 结束 </label><input
                type="number"
                className="w-40 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={schedule.endTime}
                onChange={(e) => updateSchedule(schedule.id, 'endTime', e.target.value)}
                />
                <label> 频率-分钟 </label><input
                type="number"
                className="w-30 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={schedule.frequency}
                onChange={(e) => updateSchedule(schedule.id, 'frequency', e.target.value)}
                />
                
                <button 
                onClick={() => removeSchedule(schedule.id)}
                className="px-3 py-2 text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                删除
                </button>
            </div>
            ))}

            <button onClick={addSchedule} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors">
            + 新的时间段
            </button>

            <button onClick={startMonitor} className="w-full py-2 border-5 border-solid border-black-200 text-slate-500 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors">
                开始监测
            </button>


            <button onClick={sendMail} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors">
                立刻发送邮件
            </button>

        </div>
        </div>
    </div>
    )
}

{/*          
        <div className="monitorOptionsSideBar">
            <div>
                <label>Send Report Email to</label>
                <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                />
            </div>

            <div>
                    <h3>Monitoring Schedules</h3>
                    {schedules.map((schedule) => (
                    <div key={schedule.id} style={{ marginBottom: '10px' }}>
                        <input
                        type="time"
                        placeholder="Start Time"
                        value={schedule.startTime}
                        onChange={(e) => updateSchedule(schedule.id, 'startTime', e.target.value)}
                        />
                        <input
                        type="time"
                        placeholder="End Time"
                        value={schedule.endTime}
                        onChange={(e) => updateSchedule(schedule.id, 'endTime', e.target.value)}
                        />
                        <input
                        type="number"
                        placeholder="Freq"
                        value={schedule.frequency}
                        onChange={(e) => updateSchedule(schedule.id, 'frequency', e.target.value)}
                        />
                        <select 
                        value={schedule.unit}
                        onChange={(e) => updateSchedule(schedule.id, 'unit', e.target.value)}
                        >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        </select>
                        <button onClick={() => removeSchedule(schedule.id)}>Delete</button>
                    </div>
                    ))}
                    
                    <button onClick={addSchedule}>+ Add Monitoring Schedule</button>
                </div>
        </div>
    </div>
 */}
