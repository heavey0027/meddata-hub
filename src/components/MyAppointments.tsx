
import React, { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus } from '../services/apiService';
import { getCurrentUser } from '../services/authService';
import { Appointment } from '../types';
import { Calendar, Clock, CheckCircle, Ban } from 'lucide-react';

export const MyAppointments: React.FC = () => {
  const user = getCurrentUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
        // Ensure we only fetch for the current logged-in user (Patient Mode)
        if (user) {
            const data = await getAppointments(undefined, 'patient', undefined, user.id);
            // Sort by time desc
            data.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
            setAppointments(data);
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); 

  const handleCancel = async (id: string) => {
      if(!window.confirm("确定要取消此挂号吗？")) return;
      try {
          await updateAppointmentStatus(id, 'cancelled');
          alert("挂号已取消");
          loadData();
      } catch(e: any) {
          alert("操作失败: " + e.message);
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'pending': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="h-3 w-3"/> 候诊中</span>;
          case 'completed': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3"/> 已完成</span>;
          case 'cancelled': return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Ban className="h-3 w-3"/> 已取消</span>;
          default: return null;
      }
  };

  return (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    我的预约记录
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                    查看历史挂号状态与排队信息
                </p>
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                  <div className="p-10 text-center text-gray-500">加载中...</div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                              <tr>
                                  <th className="px-6 py-4">时间</th>
                                  <th className="px-6 py-4">挂号ID</th>
                                  <th className="px-6 py-4">科室 / 医生</th>
                                  <th className="px-6 py-4">状态</th>
                                  <th className="px-6 py-4 text-right">操作</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {appointments.length === 0 ? (
                                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">暂无记录</td></tr>
                              ) : (
                                  appointments.map(apt => (
                                      <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-6 py-4 text-gray-600 font-mono text-xs">{apt.createTime}</td>
                                          <td className="px-6 py-4 font-medium text-gray-900">{apt.id}</td>
                                          <td className="px-6 py-4">
                                              <div className="font-medium text-gray-800">{apt.departmentName}</div>
                                              <div className="text-xs text-gray-500">{apt.doctorName || '随机分配'}</div>
                                          </td>
                                          <td className="px-6 py-4">
                                              {getStatusBadge(apt.status)}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              {apt.status === 'pending' && (
                                                  <button 
                                                    onClick={() => handleCancel(apt.id)}
                                                    className="text-red-600 hover:text-red-800 text-xs border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                                                  >
                                                      取消挂号
                                                  </button>
                                              )}
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      </div>
  );
};
