
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getDoctors, getDepartments, deleteDoctor, updateDoctor, getDoctorById } from '../services/mockDb';
import { Doctor, Department } from '../types';
import { Stethoscope, Filter, X, User, Trash2, Edit2, Save } from 'lucide-react';
import { getCurrentUser } from '../services/authService';

export const DoctorList: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';

  // Filters state corresponding to all attributes
  const [filters, setFilters] = useState({
    name: '',
    departmentId: '',
    title: '',
    specialty: '',
    phone: ''
  });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Partial<Doctor>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [docs, depts] = await Promise.all([getDoctors(), getDepartments()]);
    setDoctors(docs);
    setDepartments(depts);
    setLoading(false);
  };

  const getDepartmentName = (deptId: string) => {
    return departments.find(d => d.id === deptId)?.name || '未知科室';
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', departmentId: '', title: '', specialty: '', phone: '' });
  };

  const handleDelete = async (id: string, name: string) => {
      if(!window.confirm(`确定要删除医生 "${name}" (ID: ${id}) 吗？\n如果该医生有相关挂号或病历，删除将被拒绝。`)) return;
      try {
          await deleteDoctor(id);
          setDoctors(prev => prev.filter(d => d.id !== id));
          alert("删除成功");
      } catch (e: any) {
          alert("删除失败: " + e.message);
      }
  };

  const handleEditClick = async (doc: Doctor) => {
      try {
          // Fetch detailed info via new API endpoint
          const freshData = await getDoctorById(doc.id);
          setEditingDoctor(freshData || doc);
          setIsEditModalOpen(true);
      } catch (e) {
          alert("获取医生详情失败");
      }
  };

  const handleUpdate = async () => {
      if (!editingDoctor.id || !editingDoctor.name) return;
      try {
          // The API validates department existence on the backend
          await updateDoctor(editingDoctor.id, editingDoctor);
          setIsEditModalOpen(false);
          loadData(); // Refresh list
          alert("更新成功");
      } catch (e: any) {
          alert("更新失败: " + e.message);
      }
  };

  // Client-side filtering logic
  const filteredDoctors = doctors.filter(doc => {
    return (
      (!filters.name || doc.name.includes(filters.name)) &&
      (!filters.departmentId || doc.departmentId === filters.departmentId) &&
      (!filters.title || doc.title === filters.title) &&
      (!filters.specialty || doc.specialty.includes(filters.specialty)) &&
      (!filters.phone || doc.phone.includes(filters.phone))
    );
  });

  const uniqueTitles = Array.from(new Set(doctors.map(d => d.title)));

  if (loading) return <div className="p-8 text-center text-gray-500">加载医生名录中...</div>;

  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Stethoscope className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-800">全院医生名录</h3>
          </div>
          <button 
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> 清空筛选
          </button>
        </div>

        {/* Comprehensive Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input 
            placeholder="姓名筛选" 
            className="border border-gray-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={filters.name}
            onChange={e => handleFilterChange('name', e.target.value)}
          />
          <select 
            className="border border-gray-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            value={filters.departmentId}
            onChange={e => handleFilterChange('departmentId', e.target.value)}
          >
            <option value="">所有科室</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select 
            className="border border-gray-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            value={filters.title}
            onChange={e => handleFilterChange('title', e.target.value)}
          >
            <option value="">所有职称</option>
            {uniqueTitles.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input 
            placeholder="专业方向 (如: 高血压)" 
            className="border border-gray-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={filters.specialty}
            onChange={e => handleFilterChange('specialty', e.target.value)}
          />
          <input 
            placeholder="电话号码" 
            className="border border-gray-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            value={filters.phone}
            onChange={e => handleFilterChange('phone', e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3">医生ID</th>
              <th className="px-6 py-3">姓名</th>
              <th className="px-6 py-3">所属科室</th>
              <th className="px-6 py-3">职称</th>
              <th className="px-6 py-3">当前候诊</th>
              <th className="px-6 py-3">专业方向</th>
              <th className="px-6 py-3">联系电话</th>
              {isAdmin && <th className="px-6 py-3 text-right">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredDoctors.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-center text-gray-400">
                  没有找到符合条件的医生信息
                </td>
              </tr>
            ) : (
              filteredDoctors.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-500">{doc.id}</td>
                  <td className="px-6 py-3 font-medium text-gray-800">{doc.name}</td>
                  <td className="px-6 py-3 text-indigo-600">{getDepartmentName(doc.departmentId)}</td>
                  <td className="px-6 py-3">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                      {doc.title}
                    </span>
                  </td>
                   <td className="px-6 py-3">
                    <div className={`flex items-center gap-1 font-semibold ${
                      (doc.pendingCount || 0) > 5 ? 'text-red-600' : 'text-green-600'
                    }`}>
                       <User className="h-3 w-3" />
                       {doc.pendingCount || 0}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{doc.specialty}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono">{doc.phone}</td>
                  {isAdmin && (
                    <td className="px-6 py-3 text-right flex justify-end gap-2">
                        <button onClick={() => handleEditClick(doc)} className="text-gray-400 hover:text-blue-600 p-1" title="编辑资料">
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(doc.id, doc.name)} className="text-gray-400 hover:text-red-600 p-1" title="删除医生">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
        <span>显示 {filteredDoctors.length} 条记录</span>
        <span>共 {doctors.length} 位医生</span>
      </div>

      {/* Edit Doctor Modal */}
      {isEditModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
              <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-800">编辑医生信息</h3>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">医生ID (不可改)</label>
                              <input className="w-full border p-2 rounded bg-gray-100 text-gray-500" value={editingDoctor.id} disabled />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                              <input className="w-full border p-2 rounded" value={editingDoctor.name} onChange={e => setEditingDoctor({...editingDoctor, name: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">所属科室</label>
                              <select 
                                  className="w-full border p-2 rounded bg-white" 
                                  value={editingDoctor.departmentId} 
                                  onChange={e => setEditingDoctor({...editingDoctor, departmentId: e.target.value})}
                              >
                                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">职称</label>
                              <input className="w-full border p-2 rounded" value={editingDoctor.title} onChange={e => setEditingDoctor({...editingDoctor, title: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">专业方向</label>
                              <input className="w-full border p-2 rounded" value={editingDoctor.specialty} onChange={e => setEditingDoctor({...editingDoctor, specialty: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                              <input className="w-full border p-2 rounded" value={editingDoctor.phone} onChange={e => setEditingDoctor({...editingDoctor, phone: e.target.value})} />
                          </div>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">取消</button>
                      <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                          <Save className="h-4 w-4" /> 保存修改
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};
