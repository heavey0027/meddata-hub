
import React, { useState, useEffect } from 'react';
import { getDoctors, getDepartments, deleteDoctor } from '../services/mockDb';
import { Doctor, Department } from '../types';
import { Stethoscope, Filter, X, User, Trash2 } from 'lucide-react';
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
                    <td className="px-6 py-3 text-right">
                        <button onClick={() => handleDelete(doc.id, doc.name)} className="text-gray-400 hover:text-red-600 p-1">
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
    </div>
  );
};
