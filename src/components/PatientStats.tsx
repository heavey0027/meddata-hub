import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, Sankey, Tooltip, Layer, Rectangle, LineChart, Line
} from 'recharts';
import { getPatientDemographics, getAppointmentStatistics, getLocalDate, getSankeyData, getMonthlyStatistics } from '../services/mockDb';
import { PatientDemographics, MonthlyStats } from '../types';
import { Users, Activity, ArrowUpRight, ArrowDownRight, Clock, Filter, GitMerge, TrendingUp, CalendarDays } from 'lucide-react';

const SANKEY_PALETTE = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', 
  '#14B8A6', '#F43F5E', '#0EA5E9', '#84CC16', '#D946EF', '#EAB308'
];

// --- 核心逻辑：计算下沉偏移量 ---
// 根据 x 坐标（层级）决定向下移动多少像素
const getVerticalShift = (x: number) => {
  if (isNaN(x)) return 0;
  // 假设画布宽度约 1000px
  // 第一列 (挂号) x~0: 不动
  if (x < 200) return 20; 
  // 第二列 (科室) x~250-400: 下移一点
  if (x < 500) return 80; 
  // 第三列 (诊断) x~500-700: 再下移
  if (x < 750) return 160; 
  // 第四列 (开药/治疗) x>750: 沉底对齐
  return 240; 
};

// 1. 自定义节点 (带垂直偏移)
const MyCustomNode = (props: any) => {
  const { x, y, width, height, index, payload, containerWidth } = props;
  
  if (isNaN(x) || isNaN(y) || !payload) return null;

  const isOut = x + width + 50 > (containerWidth || 800); 
  
  // 获取该层级的下沉偏移量
  const shiftY = getVerticalShift(x);
  const finalY = y + shiftY;

  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={finalY} // 应用下沉
        width={width}
        height={height}
        fill={payload.fill || '#8884d8'}
        fillOpacity="1"
        radius={[4, 4, 4, 4]}
        stroke="#fff"
        strokeWidth={1}
        style={{ filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.25))' }}
      />
      <text
        x={isOut ? x - 8 : x + width + 8}
        y={finalY + height / 2} // 文字跟随下沉
        dy={4}
        textAnchor={isOut ? 'end' : 'start'}
        fontSize={13}
        fontWeight="bold"
        fill="#374151"
        style={{ pointerEvents: 'none' }}
      >
        {payload.name} ({payload.value})
      </text>
    </Layer>
  );
};

// 2. 自定义链路 (跟随节点下沉重绘曲线)
const MyCustomLink = (props: any) => {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload } = props;
  
  if (isNaN(sourceX) || isNaN(targetX)) return null;

  const sourceColor = (payload.source && payload.source.fill) ? payload.source.fill : '#cbd5e1';

  // 分别计算起点和终点的偏移量，确保连线平滑过渡
  const sourceShift = getVerticalShift(sourceX);
  const targetShift = getVerticalShift(targetX);

  const sy = sourceY + sourceShift;
  const ty = targetY + targetShift;

  // 重新构建贝塞尔曲线路径
  const linkPath = `
    M${sourceX},${sy}
    C${sourceControlX},${sy} ${targetControlX},${ty} ${targetX},${ty}
    L${targetX},${ty + linkWidth}
    C${targetControlX},${ty + linkWidth} ${sourceControlX},${sy + linkWidth} ${sourceX},${sy + linkWidth}
    Z
  `;

  return (
    <Layer key={`link-${index}`}>
      <path
        d={linkPath}
        fill={sourceColor}
        fillOpacity={0.4} 
        onMouseEnter={(e) => { e.currentTarget.style.fillOpacity = '0.75'; }}
        onMouseLeave={(e) => { e.currentTarget.style.fillOpacity = '0.4'; }}
        style={{ transition: 'fill-opacity 0.25s ease-in-out', cursor: 'pointer' }}
      />
    </Layer>
  );
};

// 3. Tooltip
const CustomSankeyTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isLink = data.source && data.target;

    if (isLink) {
        return (
          <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm z-50">
            <div className="font-bold text-gray-700 mb-1 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: data.source?.fill || '#ccc'}}></div>
               <span>{data.source?.name}</span> 
               <span className="text-gray-400">→</span> 
               <div className="w-2 h-2 rounded-full" style={{backgroundColor: data.target?.fill || '#ccc'}}></div>
               <span>{data.target?.name}</span>
            </div>
            <p className="text-blue-600 font-semibold pl-4">
               流量: {data.value} 人次
            </p>
          </div>
        );
    } else {
        return (
            <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm z-50">
               <p className="font-bold text-gray-800" style={{color: data.fill}}>{data.name}</p>
               <p className="text-gray-500">总计: {data.value} 人次</p>
            </div>
        )
    }
  }
  return null;
};

// --- 主组件 ---

export const PatientStats: React.FC = () => {
  const [stats, setStats] = useState<PatientDemographics | null>(null);
  const [sankeyData, setSankeyData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  const [timeScope, setTimeScope] = useState<'day' | 'month' | 'year' | 'all'>('day');
  const [dateValue, setDateValue] = useState<string>(getLocalDate());
  const [hourlyTrend, setHourlyTrend] = useState<{hour: string, value: number}[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  // -- 月度状态 --
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // -- 6个月趋势数据 --
  const [sixMonthTrend, setSixMonthTrend] = useState<any[]>([]);
  const [loadingTrend6, setLoadingTrend6] = useState(false);
  
  // -- 新增：控制趋势图显示的视图状态 --
  const [trendView, setTrendView] = useState<'patients' | 'visits'>('patients');

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getPatientDemographics();
        setStats(data);
      } catch (e) { console.error(e); }
    };

    const loadSankey = async () => {
      try {
        const raw = await getSankeyData();
        const transformed = transformSankeyData(raw);
        setSankeyData(transformed);
      } catch (e) {
        console.error("Failed to load Sankey Data", e);
        setSankeyData({ nodes: [], links: [] });
      }
    };

    loadStats();
    loadSankey();
    loadSixMonthTrend(); 
  }, []);

  // -- 加载当前选中月份的详细 KPI --
  useEffect(() => {
    const loadMonthly = async () => {
      setLoadingMonthly(true);
      try {
        const res = await getMonthlyStatistics(selectedMonth);
        setMonthlyStats(res);
      } catch (e) { console.error(e); } finally { setLoadingMonthly(false); }
    };
    loadMonthly();
  }, [selectedMonth]);

  // -- 获取过去6个月的趋势数据 --
  const loadSixMonthTrend = async () => {
    setLoadingTrend6(true);
    const months = [];
    const now = new Date();
    // 计算过去6个月的 YYYY-MM 字符串
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    try {
      const results = await Promise.all(months.map(m => getMonthlyStatistics(m)));
      const trend = results.map(r => ({
        name: r.month,
        patients: r.patientCount,
        visits: r.visitCount
      }));
      setSixMonthTrend(trend);
    } catch (e) {
      console.error("Failed to load 6-month trend", e);
    } finally {
      setLoadingTrend6(false);
    }
  };

  const transformSankeyData = (data: any) => {
      if (!data || !data.nodes || !data.links) return { nodes: [], links: [] };
      const { nodes, links } = data;
      const nodeMap = new Map();
      const coloredNodes = nodes.map((node: any, index: number) => {
          nodeMap.set(node.name, index);
          return { ...node, fill: SANKEY_PALETTE[index % SANKEY_PALETTE.length] };
      });
      const transformedLinks = links.map((link: any) => ({
          source: nodeMap.get(link.source), target: nodeMap.get(link.target), value: link.value
      })).filter((l: any) => l.source !== undefined && l.target !== undefined && l.source !== l.target);
      return { nodes: coloredNodes, links: transformedLinks };
  };

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
        setDateValue('');
    }
  };

  useEffect(() => {
    const fetchHourlyData = async () => {
        if (timeScope !== 'all' && !dateValue) return;
        
        setLoadingTrend(true);
        try {
            const queryDate = timeScope === 'all' ? undefined : dateValue;
            const rawStats = await getAppointmentStatistics(queryDate);
            
            const full24Hours = new Array(24).fill(0).map((_, i) => {
                const found = rawStats.find(s => s.hour === i);
                return { hour: `${String(i).padStart(2, '0')}:00`, value: found ? found.count : 0 };
            });
            setHourlyTrend(full24Hours);
        } catch (e) { console.error("Error loading trend:", e); } finally { setLoadingTrend(false); }
    };
    fetchHourlyData();
  }, [dateValue, timeScope]);

  const renderYearOptions = () => {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let i = 0; i < 5; i++) { years.push(currentYear - i); }
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
      {/* 1. 运营增长查询头部 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-sm">
                  <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                  <h2 className="text-xl font-bold text-gray-800">半年度运营趋势分析</h2>
                  <p className="text-sm text-gray-500">自动同步过去 6 个月的核心业务指标</p>
              </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <CalendarDays className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-600">KPI 选定月份:</span>
              <input 
                type="month" 
                className="bg-transparent border-none outline-none text-sm font-bold text-indigo-600 cursor-pointer"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
          </div>
      </div>

      {/* 2. 增长 KPI 与 6个月趋势折线图 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:border-indigo-200">
               {loadingMonthly && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center animate-pulse text-indigo-600 font-bold">同步中...</div>}
               <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">本月患者建档 ({monthlyStats?.month || '---'})</p>
               <h3 className="text-3xl font-black text-gray-900">{monthlyStats?.patientCount || 0}</h3>
               <div className={`mt-2 text-xs flex items-center gap-1 font-bold ${ (monthlyStats?.patientCountGrowthRate || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' }`}>
                  {(monthlyStats?.patientCountGrowthRate || 0) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />} 
                  环比 {Math.abs(monthlyStats?.patientCountGrowthRate || 0).toFixed(1)}%
               </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden transition-all hover:border-emerald-200">
               {loadingMonthly && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center animate-pulse text-emerald-500 font-bold">同步中...</div>}
               <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">本月就诊流量 ({monthlyStats?.month || '---'})</p>
               <h3 className="text-3xl font-black text-gray-900">{monthlyStats?.visitCount || 0}</h3>
               <div className={`mt-2 text-xs flex items-center gap-1 font-bold ${ (monthlyStats?.visitCountGrowthRate || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' }`}>
                  {(monthlyStats?.visitCountGrowthRate || 0) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  环比 {Math.abs(monthlyStats?.visitCountGrowthRate || 0).toFixed(1)}%
               </div>
            </div>
        </div>

        {/* --- 修改后的趋势图模块: 带切换按钮 --- */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col">
            {loadingTrend6 && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center animate-pulse text-indigo-600 font-bold">趋势加载中...</div>}
            
            {/* 头部：标题 + 切换按钮 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Activity className={`h-5 w-5 ${trendView === 'patients' ? 'text-indigo-500' : 'text-emerald-500'}`} />
                    {trendView === 'patients' ? '患者建档增长趋势' : '就诊人次流量趋势'} (近6个月)
                </h3>
                
                {/* 切换按钮组 */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setTrendView('patients')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
                            trendView === 'patients' 
                            ? 'bg-white text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        建档总数
                    </button>
                    <button
                        onClick={() => setTrendView('visits')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
                            trendView === 'visits' 
                            ? 'bg-white text-emerald-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        就诊人次
                    </button>
                </div>
            </div>

            {/* 图表区域 */}
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sixMonthTrend} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 'bold', fill: '#6B7280'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            cursor={{ stroke: '#E5E7EB', strokeWidth: 2 }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                        
                        {/* 根据状态条件渲染不同的 Line */}
                        {trendView === 'patients' ? (
                            <Line 
                                type="monotone" 
                                dataKey="patients" 
                                name="建档总数" 
                                stroke="#6366F1" 
                                strokeWidth={4} 
                                dot={{ r: 4, fill: '#6366F1', strokeWidth: 2, stroke: '#fff' }} 
                                activeDot={{ r: 8, strokeWidth: 0 }}
                                animationDuration={1000}
                            />
                        ) : (
                            <Line 
                                type="monotone" 
                                dataKey="visits" 
                                name="就诊人次" 
                                stroke="#10B981" 
                                strokeWidth={4} 
                                dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} 
                                activeDot={{ r: 8, strokeWidth: 0 }} 
                                animationDuration={1000}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
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
                      let color = '#9CA3AF';
                      if (entry.name === '男') color = '#3B82F6';
                      else if (entry.name === '女') color = '#EC4899';
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
                 <Bar dataKey="value" name="人数" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Diagnosis */}
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

         {/* Hourly Trend */}
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

        {/* 桑基图 (阶梯式下沉布局) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-teal-600 transform rotate-90" />
              医院运营全流程桑基图 (Sankey Flow Analysis)
           </h3>
           <p className="text-xs text-gray-400 mb-4 ml-7 -mt-4">
              展示从“挂号 - 诊疗 - 处方 - 取药”的全链路数据流向，<span className="text-orange-500 font-semibold">布局呈阶梯式下沉，反映流程深入程度。</span>
           </p>
           <div className="h-[1000px]">
             {sankeyData.nodes.length > 0 && sankeyData.links.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <Sankey
                   data={sankeyData}
                   nodeWidth={24}
                   nodePadding={90}
                   margin={{ left: 20, right: 20, top: 100, bottom: 100 }}
                   linkCurvature={0.5}
                   link={<MyCustomLink />}
                   node={<MyCustomNode containerWidth={1000} />}
                 >
                   <Tooltip content={<CustomSankeyTooltip />} />
                 </Sankey>
               </ResponsiveContainer>
             ) : (
               <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50 rounded-lg">
                 <p>暂无流转数据</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};