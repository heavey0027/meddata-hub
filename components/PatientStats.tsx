
import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { getPatientDemographics, getAppointmentStatistics, getLocalDate } from '../services/mockDb';
import { PatientDemographics } from '../types';
import { Users, FileText, Activity, Layers, ArrowUpRight, Clock, Calendar, Filter } from 'lucide-react';

const COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1'];

export const PatientStats: React.FC = () => {
  const [stats, setStats] = useState<PatientDemographics | null>(null);
  
  // Trend State
  const [timeScope, setTimeScope] = useState<'day' | 'month' | 'year' | 'all'>('day');
  const [dateValue, setDateValue] = useState<string>(getLocalDate());
  
  const [hourlyTrend, setHourlyTrend] = useState<{hour: string, value: number}[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // Initialize Data
  useEffect(() => {
    const loadStats = async () => {
      const data = await getPatientDemographics();
      setStats(data);
    };
    loadStats();
  }, []);

  // Handle Scope Change (Reset default values)
  const handleScopeChange = (scope: 'day' | 'month' | 'year' | 'all') => {
    setTimeScope(scope);
    const now = new Date();
    if (scope === 'day') {
        setDateValue(getLocalDate());
    } else if (scope === 'month') {
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setDateValue(monthStr);
    } else if (scope === 'year') {
        setDateValue(String(now.getFullYear()));
    } else {
        // For 'all', we don't strictly need a dateValue, but keeping it empty or as is
        setDateValue('');
    }
  };

  // Fetch trend data whenever dateValue or timeScope changes
  useEffect(() => {
    const fetchHourlyData = async () => {
        // If not 'all', we need a valid dateValue
        if (timeScope !== 'all' && !dateValue) return;
        
        setLoadingTrend(true);
        try {
            // Backend supports: 2023-10-01 (Day), 2023-10 (Month), 2023 (Year)
            // If 'all', pass undefined
            const queryDate = timeScope === 'all' ? undefined : dateValue;
            const rawStats = await getAppointmentStatistics(queryDate);
            
            // Map sparse data to full 24h timeline
            const full24Hours = new Array(24).fill(0).map((_, i) => {
                const found = rawStats.find(s => s.hour === i);
                return {
                    hour: `${String(i).padStart(2, '0')}:00`,
                    value: found ? found.count : 0
                };
            });
            
            setHourlyTrend(full24Hours);
        } catch (e) {
            console.error("Error loading trend:", e);
        } finally {
            setLoadingTrend(false);
        }
    };

    fetchHourlyData();
  }, [dateValue, timeScope]);

  // Generate Year Options (Last 5 years)
  const renderYearOptions = () => {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let i = 0; i < 5; i++) {
          years.push(currentYear - i);
      }
      return years.map(y => <option key={y} value={y}>{y}年</option>);
  };

  const getChartTitle = () => {
      if (timeScope === 'day') return `单日挂号热度 (${dateValue})`;
      if (timeScope === 'month') return `月度时段分布 (${dateValue})`;
      if (timeScope === 'year') return `年度时段分布 (${dateValue})`;
      return `历史全量统计 (All Time)`;
  };

  if (!stats) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="flex flex-col items-center">
        <Activity className="h-8 w-8 animate-spin mb-2" />
        <p>正在计算患者数据...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-transform hover:scale-[1.01]">
           <div>
             <p className="text-sm text-gray-500 font-medium mb-1">患者总档案数</p>
             <h3 className="text-3xl font-bold text-gray-900">{stats.totalPatients}</h3>
             <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
               <ArrowUpRight className="h-3 w-3" /> 较上月增长 5.2%
             </div>
           </div>
           <div className="p-4 bg-blue-50 rounded-full text-blue-600">
             <Users className="h-8 w-8" />
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between transition-transform hover:scale-[1.01]">
           <div>
             <p className="text-sm text-gray-500 font-medium mb-1">累计就诊人次</p>
             <h3 className="text-3xl font-bold text-gray-900">{stats.totalVisits}</h3>
              <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
               <ArrowUpRight className="h-3 w-3" /> 较上月增长 12.5%
             </div>
           </div>
           <div className="p-4 bg-green-50 rounded-full text-green-600">
             <FileText className="h-8 w-8" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              患者性别分布
           </h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={stats.genderDistribution}
                   cx="50%"
                   cy="50%"
                   innerRadius={0}
                   outerRadius={80}
                   paddingAngle={0}
                   dataKey="value"
                   label
                 >
                   {stats.genderDistribution.map((entry, index) => {
                      let color = '#9CA3AF'; // Default for Unknown (Gray)
                      if (entry.name === '男') color = '#3B82F6'; // Blue
                      else if (entry.name === '女') color = '#EC4899'; // Pink
                      return <Cell key={`cell-${index}`} fill={color} />;
                   })}
                 </Pie>
                 <RechartsTooltip />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Age Distribution */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-orange-500" />
              患者年龄段分布
           </h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.ageDistribution} layout="vertical">
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                 <RechartsTooltip />
                 <Bar dataKey="value" name="人数" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24}>
                    {/* Add labels inside bar */}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Diagnosis (Visits & Disease Types) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              疾病诊断分布 (就诊次数排名 - TOP10)
           </h3>
           <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.diagnosisDistribution} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="name" tick={{fontSize: 12}} />
                 <YAxis />
                 <RechartsTooltip />
                 <Legend />
                 <Bar dataKey="value" name="确诊人数" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={50} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

         {/* Hourly Registration Trend (Replaces Department Visits) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                     <Clock className="h-5 w-5 text-blue-500" />
                     {getChartTitle()}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 ml-7">
                    展示不同时段的挂号拥挤程度 (Peak Analysis)
                  </p>
              </div>
              
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                 <Filter className="h-4 w-4 text-gray-400 ml-1" />
                 
                 {/* Scope Selector */}
                 <select 
                    className="bg-transparent text-sm font-semibold text-gray-700 px-2 py-1 outline-none cursor-pointer border-r border-gray-300"
                    value={timeScope}
                    onChange={(e) => handleScopeChange(e.target.value as any)}
                 >
                    <option value="day">按日统计</option>
                    <option value="month">按月统计</option>
                    <option value="year">按年统计</option>
                    <option value="all">全部数据</option>
                 </select>

                 {/* Dynamic Date Input */}
                 {timeScope !== 'all' && (
                 <div className="pl-2">
                    {timeScope === 'day' && (
                        <input 
                            type="date"
                            className="text-sm bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                        />
                    )}
                    {timeScope === 'month' && (
                        <input 
                            type="month"
                            className="text-sm bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                        />
                    )}
                    {timeScope === 'year' && (
                        <select
                            className="text-sm bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 w-24"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                        >
                            {renderYearOptions()}
                        </select>
                    )}
                 </div>
                 )}
              </div>
           </div>
           
           <div className="h-80 relative">
             {loadingTrend && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 backdrop-blur-[1px]">
                    <div className="text-blue-600 font-medium text-sm animate-pulse">加载数据中...</div>
                </div>
             )}
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={hourlyTrend} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                 <defs>
                   <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                     <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <XAxis dataKey="hour" tick={{fontSize: 12}} interval={2} />
                 <YAxis tick={{fontSize: 12}} allowDecimals={false} />
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#3B82F6', fontWeight: 'bold' }}
                 />
                 <Area 
                    type="monotone" 
                    dataKey="value" 
                    name="挂号量" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorReg)" 
                    animationDuration={800}
                 />
               </AreaChart>
             </ResponsiveContainer>
             <div className="text-center text-xs text-gray-400 mt-2">
                统计维度: 00:00 - 23:00 (反映该时间范围内的运营高峰)
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
