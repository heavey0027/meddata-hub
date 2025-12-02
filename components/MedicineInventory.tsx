import React, { useState, useEffect } from 'react';
import { getMedicines } from '../services/mockDb';
import { Medicine } from '../types';
import { AlertTriangle, Pill, Search } from 'lucide-react';

export const MedicineInventory: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getMedicines();
    setMedicines(data);
    setLoading(false);
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
    </div>
  );
};