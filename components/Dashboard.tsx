import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { getStats } from '../services/mockDb';
import { DashboardStats } from '../types';
import { Users, FileText, BriefcaseMedical, Pill, Activity, AlertTriangle, Stethoscope, Building2 } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'medicines' | 'doctors'>('records');
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      const data = await getStats();
      setStats(data);
    };
    loadStats();
  }, []);

  const handleViewMore = () => {
    console.log("Navigating for tab:", activeTab);
    switch (activeTab) {
      case 'records':
        // Navigate to Patient List (Patient Management) for records
        navigate('/patients');
        break;
      case 'medicines':
        // Navigate to Resources -> Medicine Inventory
        navigate('/resources', { state: { initialTab: 'medicines' } });
        break;
      case 'doctors':
        // Navigate to Resources -> Doctor List
        navigate('/resources', { state: { initialTab: 'doctors' } });
        break;
      default:
        // Default fallthrough to stats if something goes wrong, though should not happen
        navigate('/stats');
    }
  };

  const getButtonText = () => {
    switch(activeTab) {
        case 'records': return '管理患者档案';
        case 'medicines': return '查看完整库存';
        case 'doctors': return '查看医生名录';
        default: return '查看完整报表';
    }
  };

  if (!stats) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="flex flex-col items-center">
        <Activity className="h-8 w-8 animate-spin mb-2" />
        <p>正在连接数据库分析数据...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* 1. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="患者总数" value={stats.totalPatients} icon={<Users className="text-blue-600" />} bg="bg-blue-50" />
        <StatCard title="累计就诊" value={stats.totalVisits} icon={<FileText className="text-green-600" />} bg="bg-green-50" />
        <StatCard title="在职医生" value={stats.totalDoctors} icon={<BriefcaseMedical className="text-indigo-600" />} bg="bg-indigo-50" />
        <StatCard title="药品种类" value={stats.totalMedicines} icon={<Pill className="text-orange-600" />} bg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Charts Area (Left 2/3) */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              科室接诊量统计
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.visitsByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="接诊量" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              疾病诊断分布 (Top 5)
            </h3>
            <div className="h-64 flex">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.diagnosisDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.diagnosisDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. Info Check Panel (Right 1/3) - "Check various info" */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">数据速查</h3>
            <div className="flex gap-1 bg-gray-200 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('records')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'records' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="最新病历"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setActiveTab('medicines')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'medicines' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="库存预警"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setActiveTab('doctors')}
                className={`p-1.5 rounded-md transition-all ${activeTab === 'doctors' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                title="医生概览"
              >
                <Stethoscope className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {activeTab === 'records' && (
              <div>
                <div className="px-4 py-3 bg-blue-50/50 text-xs font-semibold text-blue-800 border-b border-blue-100">
                  最新就诊记录 (Top 5)
                </div>
                <div className="divide-y divide-gray-100">
                  {stats.recentRecords.map(record => (
                    <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-800">{record.diagnosis}</span>
                        <span className="text-xs text-gray-500">{record.visitDate}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        患者: {record.patientName} <span className="text-gray-300">|</span> 医生: {record.doctorName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{record.treatmentPlan}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'medicines' && (
              <div>
                <div className="px-4 py-3 bg-orange-50/50 text-xs font-semibold text-orange-800 border-b border-orange-100 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" /> 库存预警 (低于100)
                </div>
                <div className="divide-y divide-gray-100">
                  {stats.lowStockMedicines.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">暂无库存预警</div>
                  ) : (
                    stats.lowStockMedicines.map(med => (
                      <div key={med.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <div className="font-medium text-gray-800">{med.name}</div>
                          <div className="text-xs text-gray-500">{med.specification}</div>
                        </div>
                        <div className="text-right">
                          <span className="block text-red-600 font-bold">{med.stock}</span>
                          <span className="text-xs text-gray-400">库存</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

             {activeTab === 'doctors' && (
              <div>
                <div className="px-4 py-3 bg-indigo-50/50 text-xs font-semibold text-indigo-800 border-b border-indigo-100">
                   科室医生分布
                </div>
                <div className="divide-y divide-gray-100">
                  {stats.visitsByDepartment.map((dept, idx) => (
                    <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50">
                       <div className="flex items-center gap-3">
                         <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                           <Building2 className="h-4 w-4" />
                         </div>
                         <span className="font-medium text-gray-700">{dept.name}</span>
                       </div>
                       <div className="text-sm text-gray-500">
                         接诊: <span className="font-semibold text-gray-900">{dept.value}</span>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
            <button 
              onClick={handleViewMore}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 mx-auto"
            >
              {getButtonText()} &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, bg }: { title: string, value: number, icon: React.ReactNode, bg: string }) => (
  <div className={`p-6 rounded-xl shadow-sm border border-gray-100 bg-white flex items-center justify-between transition-transform hover:scale-[1.02]`}>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h4 className="text-2xl font-bold text-gray-900 mt-1">{value}</h4>
    </div>
    <div className={`p-3 rounded-full ${bg}`}>
      {icon}
    </div>
  </div>
);