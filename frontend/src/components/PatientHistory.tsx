
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { findPatientByQuery, getFullPatientDetails, getPatients, updatePatient, deletePatient } from '../services/apiService';
import { getCurrentUser, logout } from '../services/authService';
import { Patient } from '../types';
import { Search, Clock, User, Calendar, Pill, AlertCircle, ChevronDown, ChevronUp, Edit2, UserX } from 'lucide-react';
import { addLog } from '../services/logger';

export const PatientHistory: React.FC = () => {
  const user = getCurrentUser();
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  // Auto-load for patient role
  useEffect(() => {
    if (user && user.role === 'patient') {
      loadHistory(user.id);
    }
  }, []);

  const loadHistory = async (patientId: string) => {
    setLoading(true);
    setError('');
    try {
      const foundPatient = await findPatientByQuery(patientId);
      if (foundPatient) {
        setPatient(foundPatient);
        const details = await getFullPatientDetails(foundPatient.id);
        setHistory(details);
      } else {
        setError('未找到档案信息');
      }
    } catch (err) {
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    loadHistory(query);
  };

  const toggleExpand = (id: string) => {
    setExpandedRecordId(expandedRecordId === id ? null : id);
  };

  const openEdit = () => {
    if (!patient) return;
    setEditForm({
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      address: patient.address,
      gender: patient.gender
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateProfile = async () => {
     if (!patient) return;
     if (!editForm.name || !editForm.phone) {
         alert("姓名和电话不能为空");
         return;
     }

     const updatedPatient: Patient = { ...patient, ...editForm } as Patient;
     
     // Use the explicit PUT method
     await updatePatient(updatedPatient);
     
     addLog('SUCCESS', '患者服务', '信息修改', `患者 ${patient.name} 更新了个人资料`);
     
     // Update local state
     setPatient(updatedPatient);
     setIsEditModalOpen(false);
     alert("个人信息更新成功！");
  };

  const handleDeleteAccount = async () => {
      if (!patient) return;
      if (!window.confirm(`警告：您确定要注销您的账号吗？\nID: ${patient.id}\n注销后，您的所有病历和挂号记录将被永久删除且无法恢复。`)) return;

      try {
          await deletePatient(patient.id);
          alert("账号已注销。感谢您的使用。");
          logout();
          window.location.href = '#/login';
          window.location.reload();
      } catch (e: any) {
          alert("注销失败: " + e.message);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in h-full flex flex-col">
      {/* Search Header - Only show if NOT patient */}
      {user?.role !== 'patient' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">就诊记录查询</h2>
          <p className="text-gray-500 mb-6 text-sm">输入患者 ID 或注册手机号查看历史病历</p>
          <form onSubmit={handleSearch} className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="请输入 P001 或 1380000..."
              className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition-all"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </form>
        </div>
      )}

      {/* Header for Patient View */}
      {user?.role === 'patient' && (
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
           <div>
             <h2 className="text-xl font-bold">我的就诊记录</h2>
             <p className="text-blue-100 text-sm opacity-80">查看您的历史诊断与处方信息</p>
           </div>
           <div className="bg-white/20 p-3 rounded-full">
             <Clock className="h-6 w-6" />
           </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center gap-2 text-red-500 bg-red-50 py-2 px-4 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Results Area */}
      {patient && (
        <div className="flex-1 flex flex-col md:flex-row gap-6">
          {/* Patient Card */}
          <div className="md:w-1/3 space-y-4">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-4 relative">
                {user?.role === 'patient' && (
                  <button 
                    onClick={openEdit}
                    className="absolute top-4 right-4 text-gray-400 hover:text-blue-600 bg-gray-50 p-1.5 rounded-lg transition-colors"
                    title="修改个人信息"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4 pr-8">
                   <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                     <User className="h-6 w-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-gray-900">{patient.name}</h3>
                     <p className="text-sm text-gray-500">ID: {patient.id}</p>
                   </div>
                </div>
                <div className="space-y-3 text-sm text-gray-600">
                   <div className="flex justify-between">
                     <span>性别:</span>
                     <span className="font-medium text-gray-800">{patient.gender}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>年龄:</span>
                     <span className="font-medium text-gray-800">{patient.age} 岁</span>
                   </div>
                   <div className="flex justify-between">
                     <span>电话:</span>
                     <span className="font-medium text-gray-800">{patient.phone}</span>
                   </div>
                   <div className="pt-3 border-t border-gray-100 mt-2">
                     <span className="block mb-1 text-gray-400">住址:</span>
                     <span className="font-medium text-gray-800">{patient.address}</span>
                   </div>
                </div>
                {user?.role === 'patient' && (
                    <div className="pt-6 border-t border-gray-100 mt-4">
                        <button 
                            onClick={handleDeleteAccount}
                            className="w-full flex items-center justify-center gap-2 text-red-500 bg-red-50 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                            <UserX className="h-4 w-4" /> 注销账号
                        </button>
                    </div>
                )}
             </div>
          </div>
          {/* Timeline and other details... */}
          <div className="md:w-2/3">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                   <Clock className="h-5 w-5 text-indigo-500" />
                   历史就诊时间轴
                   <span className="text-xs font-normal text-gray-400 ml-2 bg-gray-100 px-2 py-0.5 rounded-full">共 {history.length} 次</span>
                </h3>
                {history.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">暂无就诊记录</div>
                ) : (
                    history.map((record) => (
                      <div key={record.id} className="relative border-l-2 border-gray-100 ml-3 pl-8 py-2 mb-4">
                         <div className="absolute -left-[9px] top-1 h-4 w-4 bg-indigo-50 border-2 border-indigo-500 rounded-full"></div>
                         <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-2">
                                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded font-bold">{record.visitDate}</span>
                                  <span className="font-bold text-gray-800">{record.diagnosis}</span>
                               </div>
                               <span className="text-xs text-gray-500">Dr. {record.doctorName}</span>
                            </div>
                            <div className="text-sm text-gray-600 mb-3 bg-white p-2 rounded border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 block mb-1">治疗方案</span>
                                {record.treatmentPlan}
                            </div>
                            
                            {/* Prescription Details Rendered Here */}
                            {record.details && record.details.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                                        <Pill className="h-3 w-3" /> 处方明细
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="text-gray-400 border-b border-gray-200">
                                                    <th className="pb-1 font-medium">药品名称</th>
                                                    <th className="pb-1 font-medium">规格</th>
                                                    <th className="pb-1 font-medium">用量 / 用法</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {record.details.map((detail: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="py-2 text-gray-800 font-medium">{detail.medicineName || detail.medicineId}</td>
                                                        <td className="py-2 text-gray-500">{detail.medicineSpec}</td>
                                                        <td className="py-2 text-gray-600">
                                                            {detail.dosage} / {detail.usage} <span className="text-gray-400">({detail.days}天)</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                         </div>
                      </div>
                    ))
                )}
             </div>
          </div>
        </div>
      )}
      
      {/* Edit Modal (Portal) */}
      {isEditModalOpen && createPortal(
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
             <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl animate-fade-in">
                 <h3 className="text-xl font-bold text-gray-800 mb-4">修改个人信息</h3>
                 <div className="space-y-4">
                    <input className="w-full border p-2 rounded" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="姓名" />
                    <input className="w-full border p-2 rounded" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="电话" />
                    <input className="w-full border p-2 rounded" type="number" value={editForm.age} onChange={e => setEditForm({...editForm, age: parseInt(e.target.value)})} placeholder="年龄" />
                    <input className="w-full border p-2 rounded" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} placeholder="地址" />
                 </div>
                 <div className="mt-6 flex justify-end gap-3">
                     <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">取消</button>
                     <button onClick={handleUpdateProfile} className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
                 </div>
             </div>
         </div>,
         document.body
      )}
    </div>
  );
};
