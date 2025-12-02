import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getDepartments } from '../services/mockDb';
import { Department } from '../types';
import { Building2, Stethoscope, Pill } from 'lucide-react';
import { MedicineInventory } from './MedicineInventory';
import { DoctorList } from './DoctorList';

export const Resources: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'doctors' | 'medicines' | 'departments'>('doctors');
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const fetchDepts = async () => {
      const data = await getDepartments();
      setDepartments(data);
    };
    fetchDepts();
  }, []);

  // Listen for navigation state to switch tabs automatically
  useEffect(() => {
    const state = location.state as { initialTab?: 'doctors' | 'medicines' | 'departments' } | null;
    if (state?.initialTab) {
      setActiveTab(state.initialTab);
    }
  }, [location]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tabs Navigation */}
      <div className="bg-white p-1 rounded-xl border border-gray-200 inline-flex shadow-sm">
        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'doctors' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Stethoscope className="h-4 w-4" /> 医生管理
        </button>
        <button
          onClick={() => setActiveTab('medicines')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'medicines' ? 'bg-orange-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Pill className="h-4 w-4" /> 药品库存
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'departments' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Building2 className="h-4 w-4" /> 科室信息
        </button>
      </div>

      {/* Content Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
        
        {activeTab === 'doctors' && <DoctorList />}

        {activeTab === 'medicines' && <MedicineInventory />}

        {activeTab === 'departments' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">科室分布</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">共 {departments.length} 个</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">科室ID</th>
                    <th className="px-6 py-3">科室名称</th>
                    <th className="px-6 py-3">位置</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {departments.map(dept => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500">{dept.id}</td>
                      <td className="px-6 py-3 font-medium text-blue-600">{dept.name}</td>
                      <td className="px-6 py-3 text-gray-600">{dept.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};