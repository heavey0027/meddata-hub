
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMedicines, deleteMedicine, updateMedicine, getMedicineById } from '../services/mockDb';
import { Medicine } from '../types';
import { AlertTriangle, Pill, Search, Trash2, Edit2, Save, X } from 'lucide-react';
import { getCurrentUser } from '../services/authService';

export const MedicineInventory: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Partial<Medicine>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getMedicines();
    setMedicines(data);
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
      if(!window.confirm(`确定要删除药品 "${name}" (ID: ${id}) 吗？\n如果在用处方中包含此药品，删除可能会失败。`)) return;
      try {
          await deleteMedicine(id);
          setMedicines(prev => prev.filter(m => m.id !== id));
          alert("删除成功");
      } catch (e: any) {
          alert("删除失败: " + e.message);
      }
  };

  const handleEditClick = async (med: Medicine) => {
    try {
        // Fetch fresh details from API
        const freshData = await getMedicineById(med.id);
        setEditingMedicine(freshData || med);
        setIsEditModalOpen(true);
    } catch (e) {
        alert("获取药品详情失败");
    }
  };

  const handleUpdate = async () => {
      if (!editingMedicine.id || !editingMedicine.name) return;
      try {
          await updateMedicine(editingMedicine.id, editingMedicine);
          setIsEditModalOpen(false);
          loadData(); // Refresh list
          alert("更新成功");
      } catch (e: any) {
          alert("更新失败: " + e.message);
      }
  };

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-gray-500">加载药品库存中...</div>;

  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
            <Pill className="h-5 w-5" />
          </div>
          <div>
             <h3 className="font-bold text-gray-800">药品库存管理</h3>
             <p className="text-xs text-gray-500">实时监控全院药品数量与价格</p>
          </div>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="搜索药品名称或ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3">状态</th>
              <th className="px-6 py-3">药品ID</th>
              <th className="px-6 py-3">药品名称</th>
              <th className="px-6 py-3">规格</th>
              <th className="px-6 py-3">单价</th>
              <th className="px-6 py-3 text-right">库存数量</th>
              {isAdmin && <th className="px-6 py-3 text-right">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredMedicines.map(med => {
              const isLowStock = med.stock < 100;
              return (
                <tr key={med.id} className={`hover:bg-gray-50 transition-colors ${isLowStock ? 'bg-red-50/30' : ''}`}>
                  <td className="px-6 py-3">
                    {isLowStock ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                        <AlertTriangle className="h-3 w-3" /> 缺货预警
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        充足
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500 font-mono">{med.id}</td>
                  <td className="px-6 py-3 font-medium text-gray-800">{med.name}</td>
                  <td className="px-6 py-3 text-gray-500">{med.specification}</td>
                  <td className="px-6 py-3 text-gray-600">¥{med.price.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`font-bold text-lg ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                      {med.stock}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-3 text-right flex justify-end gap-2">
                        <button onClick={() => handleEditClick(med)} className="text-gray-400 hover:text-blue-600 p-1" title="编辑药品">
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(med.id, med.name)} className="text-gray-400 hover:text-red-600 p-1" title="删除药品">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredMedicines.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            未找到匹配的药品信息
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && createPortal(
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
              <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-800">编辑药品信息</h3>
                      <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">药品ID (不可改)</label>
                              <input className="w-full border p-2 rounded bg-gray-100 text-gray-500" value={editingMedicine.id} disabled />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">药品名称</label>
                              <input className="w-full border p-2 rounded" value={editingMedicine.name} onChange={e => setEditingMedicine({...editingMedicine, name: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">价格</label>
                              <input type="number" className="w-full border p-2 rounded" value={editingMedicine.price} onChange={e => setEditingMedicine({...editingMedicine, price: Number(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">库存</label>
                              <input type="number" className="w-full border p-2 rounded" value={editingMedicine.stock} onChange={e => setEditingMedicine({...editingMedicine, stock: Number(e.target.value)})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">规格</label>
                          <input className="w-full border p-2 rounded" value={editingMedicine.specification} onChange={e => setEditingMedicine({...editingMedicine, specification: e.target.value})} />
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
