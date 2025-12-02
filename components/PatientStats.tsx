
import React, { useEffect, useState } from 'react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { getPatientDemographics } from '../services/mockDb';
import { PatientDemographics } from '../types';
import { Users, FileText, Activity, Layers, ArrowUpRight } from 'lucide-react';

const COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#6366F1'];

export const PatientStats: React.FC = () => {
  const [stats, setStats] = useState<PatientDemographics | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      const data = await getPatientDemographics();
      setStats(data);
    };
    loadStats();
  }, []);

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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
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
                   {stats.genderDistribution.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.name === '男' ? '#3B82F6' : '#EC4899'} />
                   ))}
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

         {/* Dept Visits */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
           <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              不同科室就诊人数统计 - TOP10
           </h3>
           <div className="h-80">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.deptVisits} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="name" tick={{fontSize: 12}} />
                 <YAxis />
                 <RechartsTooltip />
                 <Bar dataKey="value" name="接诊人次" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={50} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};
