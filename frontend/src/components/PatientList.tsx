
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPatients, createPatient, updatePatient, deletePatient, getFullPatientDetails, getDoctors, getMedicines, saveMedicalRecord, deleteMedicalRecord, findPatientByQuery } from '../services/apiService';
import { Patient, Doctor, Medicine, MedicalRecord, PrescriptionDetail } from '../types';
import { Search, Plus, Trash2, Edit2, X, FileText, Pill, FilePlus, Crown, ChevronLeft, ChevronRight, AlertTriangle, UserSearch } from 'lucide-react';
import { addLog } from '../services/logger';
import { getCurrentUser } from '../services/authService';

// Helper for local YYYY-MM-DD
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const LIMIT = 100;

export const PatientList: React.FC = () => {
  const currentUser = getCurrentUser();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  
  // Local Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);

  // Remote ID Search State
  const [remoteQuery, setRemoteQuery] = useState('');
  const [searchedPatient, setSearchedPatient] = useState<Patient | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  
  // Patient Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Patient>>({
    name: '', gender: '男', age: 0, phone: '', address: ''
  });

  // View Records Modal State
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);

  // Add Record Modal State
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState<Partial<MedicalRecord>>({
    diagnosis: '', treatmentPlan: '', doctorId: '', visitDate: ''
  });
  const [prescriptionBuffer, setPrescriptionBuffer] = useState<Partial<PrescriptionDetail>[]>([]);
  const [tempPrescription, setTempPrescription] = useState<Partial<PrescriptionDetail>>({
    medicineId: '', dosage: '', usage: '', days: 1
  });

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    loadData();
  }, [offset]); // Re-fetch when page changes

  const loadData = async () => {
    const [pats, docs, meds] = await Promise.all([
      getPatients(LIMIT, offset),
      getDoctors(),
      getMedicines()
    ]);
    setPatients(pats);
    setDoctors(docs);
    setMedicines(meds);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // --- Remote Search Logic ---
  const handleRemoteSearch = async () => {
    if (!remoteQuery.trim()) {
      alert("请输入患者ID");
      return;
    }
    
    try {
      // 假设 findPatientByQuery 返回单个 Patient 对象或 null/undefined
      const result = await findPatientByQuery(remoteQuery);
      
      if (result) {
        setSearchedPatient(result);
        setIsSearchModalOpen(true);
        setRemoteQuery(''); // 清空搜索框
      } else {
        alert(`未找到 ID 为 "${remoteQuery}" 的患者。`);
      }
    } catch (e: any) {
      alert(`搜索失败: ${e.message || '未知错误'}`);
    }
  };

  const handleActionFromSearch = (action: 'edit' | 'addRecord' | 'viewRecord', patient: Patient) => {
    setIsSearchModalOpen(false); // 关闭搜索结果弹窗
    
    // 稍微延迟以确保弹窗切换流畅
    setTimeout(() => {
        if (action === 'edit') openEdit(patient);
        if (action === 'addRecord') openAddRecord(patient);
        if (action === 'viewRecord') viewRecords(patient);
    }, 100);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm) ||
    p.id.includes(searchTerm)
  );

  const handleSavePatient = async () => {
    if (!formData.name || !formData.phone) return alert("姓名和电话不能为空。");

    let updatedList = [...patients];
    
    try {
      if (editingId) {
        // Update logic (PUT)
        const targetPatient = patients.find(p => p.id === editingId);
        if (targetPatient) {
          const updatedPatient = { ...targetPatient, ...formData } as Patient;
          await updatePatient(updatedPatient); 
          
          updatedList = updatedList.map(p => p.id === editingId ? updatedPatient : p);
          addLog('SUCCESS', '患者管理', '编辑患者', `更新患者 ${formData.name} (ID: ${editingId})`);
        }
      } else {
        // Create logic (POST)
        const newPatient: Patient = {
          id: `P00${Math.floor(Math.random() * 1000)}`,
          createTime: getTodayStr(), 
          password: 'password', 
          ...formData as Patient
        };
        await createPatient(newPatient); 
        
        updatedList.push(newPatient);
        addLog('SUCCESS', '患者管理', '新增患者', `创建患者 ${newPatient.name} (ID: ${newPatient.id})`);
      }

      setPatients(updatedList);
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', gender: '男', age: 0, phone: '', address: '' });
    } catch (e: any) {
      alert(`操作失败: ${e.message || '未知错误'}`);
    }
  };

  const handleDeletePatient = async (id: string, name: string) => {
    if (!window.confirm(`确定要删除患者 "${name}" (ID: ${id}) 吗？\n此操作将级联删除该患者的所有挂号、病历及处方记录，且不可恢复！`)) return;

    try {
        await deletePatient(id);
        setPatients(prev => prev.filter(p => p.id !== id));
        alert('删除成功');
    } catch(e: any) {
        alert('删除失败: ' + e.message);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm(`确定要删除病历记录 (ID: ${recordId}) 吗？\n此操作将级联删除相关处方明细。`)) return;

    try {
        await deleteMedicalRecord(recordId);
        setPatientRecords(prev => prev.filter(r => r.id !== recordId));
        alert('删除成功');
    } catch(e: any) {
        alert('删除失败: ' + e.message);
    }
  };

  const openEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setFormData(patient);
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: '', gender: '男', age: 0, phone: '', address: '' });
    setIsModalOpen(true);
  };

  const viewRecords = async (patient: Patient) => {
    const details = await getFullPatientDetails(patient.id);
    setSelectedPatient(patient);
    setPatientRecords(details);
    setIsRecordsModalOpen(true);
  };

  // --- Add Medical Record Logic ---

  const openAddRecord = (patient: Patient) => {
    setSelectedPatient(patient);
    setRecordForm({
      diagnosis: '', 
      treatmentPlan: '', 
      doctorId: doctors.length > 0 ? doctors[0].id : '', 
      visitDate: getTodayStr() // Use Local Date
    });
    setPrescriptionBuffer([]);
    setTempPrescription({ medicineId: medicines.length > 0 ? medicines[0].id : '', dosage: '', usage: '', days: 3 });
    setIsAddRecordModalOpen(true);
  };

  const addPrescriptionItem = () => {
    if (!tempPrescription.medicineId || !tempPrescription.dosage) {
      alert("请选择药品并填写用量");
      return;
    }
    setPrescriptionBuffer([...prescriptionBuffer, { ...tempPrescription }]);
    setTempPrescription({ ...tempPrescription, dosage: '', usage: '', days: 3 });
  };

  const removePrescriptionItem = (index: number) => {
    const updated = [...prescriptionBuffer];
    updated.splice(index, 1);
    setPrescriptionBuffer(updated);
  };

  const handleSaveRecord = async () => {
    if (!selectedPatient || !recordForm.doctorId || !recordForm.diagnosis || !recordForm.treatmentPlan) {
      alert("请填写完整的诊断信息和治疗方案");
      return;
    }

    const doc = doctors.find(d => d.id === recordForm.doctorId);
    const newRecordId = `R${Date.now()}`;

    const newRecord: MedicalRecord = {
      id: newRecordId,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      doctorId: recordForm.doctorId!,
      doctorName: doc?.name || 'Unknown',
      diagnosis: recordForm.diagnosis!,
      treatmentPlan: recordForm.treatmentPlan!,
      visitDate: recordForm.visitDate! 
    };

    const newDetails: PrescriptionDetail[] = prescriptionBuffer.map((p, idx) => ({
      id: `PD${Date.now()}-${idx}`,
      recordId: newRecordId, 
      medicineId: p.medicineId!,
      dosage: p.dosage!,
      usage: p.usage!,
      days: p.days || 1
    }));

    await saveMedicalRecord(newRecord, newDetails);
    addLog('SUCCESS', '病历管理', '新增病历', `为患者 ${selectedPatient.name} 创建病历 (ID: ${newRecordId})`);
    
    setIsAddRecordModalOpen(false);
    alert("病历保存成功！");
    if (isRecordsModalOpen && selectedPatient) {
       viewRecords(selectedPatient);
    }
  };

  const getMedicineName = (id: string) => medicines.find(m => m.id === id)?.name || id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex gap-4 w-full sm:w-auto flex-1">
            {/* Local Filter */}
            <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
                type="text"
                placeholder="过滤当前页 (姓名/电话)..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                value={searchTerm}
                onChange={handleSearch}
            />
            </div>
            
            {/* Remote ID Search */}
            <div className="relative flex-1 sm:max-w-xs flex gap-2">
                <div className="relative w-full">
                    <UserSearch className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="输入ID精确查找..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                        value={remoteQuery}
                        onChange={(e) => setRemoteQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRemoteSearch()}
                    />
                </div>
                <button 
                    onClick={handleRemoteSearch}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                >
                    查找
                </button>
            </div>
        </div>

        <button 
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-5 w-5" />
          新建档案
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">患者ID</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">基本信息</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">联系方式</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">地址</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">建档日期</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.map(patient => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{patient.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="font-medium flex items-center gap-2">
                      {patient.name}
                      {patient.isVip && <span className="text-red-500 font-semibold">重点患者</span>}
                    </div>
                    <div className="text-gray-400 text-xs">{patient.gender} | {patient.age}岁</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{patient.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs" title={patient.address}>{patient.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{patient.createTime}</td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <button 
                      onClick={() => openAddRecord(patient)}
                      className="text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-md transition-colors"
                      title="新增病历"
                    >
                      <FilePlus className="h-4 w-4" />
                    </button>
                     <button 
                      onClick={() => viewRecords(patient)} 
                      className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                    >
                      查看病历
                    </button>
                    <button onClick={() => openEdit(patient)} className="text-gray-400 hover:text-blue-600 p-1">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                        <button onClick={() => handleDeletePatient(patient.id, patient.name)} className="text-gray-400 hover:text-red-600 p-1">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    当前页未找到匹配的患者信息
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-500">
                当前显示第 {Math.floor(offset / LIMIT) + 1} 页 (每页 {LIMIT} 条)
            </span>
            <div className="flex gap-2">
                <button
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" /> 上一页
                </button>
                <button
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={patients.length < LIMIT}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    下一页 <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
      </div>

      {/* Add/Edit Patient Modal - Portal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl relative animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">{editingId ? '编辑患者' : '添加患者'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <input 
                placeholder="姓名" 
                className="col-span-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
              />
              <input 
                placeholder="电话" 
                className="col-span-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
              <input 
                type="number" placeholder="年龄" 
                className="col-span-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.age} onChange={e => setFormData({...formData, age: Number(e.target.value)})} 
              />
              <select 
                className="col-span-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
              <input 
                placeholder="地址" 
                className="col-span-2 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded text-gray-700 hover:bg-gray-200">取消</button>
              <button onClick={handleSavePatient} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Remote Search Result Modal */}
      {isSearchModalOpen && searchedPatient && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-fade-in border-t-4 border-indigo-500">
                <button onClick={() => setIsSearchModalOpen(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <UserSearch className="h-8 w-8 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">查找结果</h3>
                    <p className="text-sm text-gray-500 mt-1">ID: {searchedPatient.id}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-500">姓名</span>
                        <span className="font-semibold text-gray-800">{searchedPatient.name} {searchedPatient.isVip && <span className="text-red-500">(重点患者)</span>}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2 pt-1">
                        <span className="text-gray-500">性别/年龄</span>
                        <span className="text-gray-800">{searchedPatient.gender} / {searchedPatient.age}岁</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2 pt-1">
                        <span className="text-gray-500">电话</span>
                        <span className="text-gray-800">{searchedPatient.phone}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                        <span className="text-gray-500">建档日期</span>
                        <span className="text-gray-800">{searchedPatient.createTime}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleActionFromSearch('addRecord', searchedPatient)}
                        className="col-span-2 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <FilePlus className="h-4 w-4" /> 新增病历
                    </button>
                    <button 
                        onClick={() => handleActionFromSearch('viewRecord', searchedPatient)}
                        className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                    >
                        <FileText className="h-4 w-4" /> 查看病历
                    </button>
                    <button 
                        onClick={() => handleActionFromSearch('edit', searchedPatient)}
                        className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                        <Edit2 className="h-4 w-4" /> 编辑信息
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Add Record Modal */}
      {isAddRecordModalOpen && selectedPatient && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-green-600" />
                新增病历 - {selectedPatient.name}
              </h3>
              <button onClick={() => setIsAddRecordModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">主治医生</label>
                  <select 
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                    value={recordForm.doctorId}
                    onChange={e => setRecordForm({...recordForm, doctorId: e.target.value})}
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.title})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">就诊日期</label>
                  <input 
                    type="date"
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                    value={recordForm.visitDate}
                    onChange={e => setRecordForm({...recordForm, visitDate: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">诊断结果</label>
                  <input 
                    type="text"
                    placeholder="例如：上呼吸道感染"
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                    value={recordForm.diagnosis}
                    onChange={e => setRecordForm({...recordForm, diagnosis: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">治疗方案</label>
                  <textarea 
                    rows={2}
                    placeholder="例如：多喝水，注意休息..."
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                    value={recordForm.treatmentPlan}
                    onChange={e => setRecordForm({...recordForm, treatmentPlan: e.target.value})}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Pill className="h-4 w-4" /> 开具处方
                </h4>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3 grid grid-cols-12 gap-2 items-end">
                   <div className="col-span-4">
                     <label className="text-xs text-gray-500">药品</label>
                     <select 
                        className="w-full border p-1.5 rounded text-sm"
                        value={tempPrescription.medicineId}
                        onChange={e => setTempPrescription({...tempPrescription, medicineId: e.target.value})}
                     >
                        {medicines.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.stock})</option>
                        ))}
                     </select>
                   </div>
                   <div className="col-span-2">
                     <label className="text-xs text-gray-500">用量</label>
                     <input 
                        placeholder="0.5g"
                        className="w-full border p-1.5 rounded text-sm"
                        value={tempPrescription.dosage}
                        onChange={e => setTempPrescription({...tempPrescription, dosage: e.target.value})}
                     />
                   </div>
                   <div className="col-span-3">
                     <label className="text-xs text-gray-500">用法</label>
                     <input 
                        placeholder="每日3次"
                        className="w-full border p-1.5 rounded text-sm"
                        value={tempPrescription.usage}
                        onChange={e => setTempPrescription({...tempPrescription, usage: e.target.value})}
                     />
                   </div>
                   <div className="col-span-2">
                     <label className="text-xs text-gray-500">天数</label>
                     <input 
                        type="number"
                        placeholder="3"
                        className="w-full border p-1.5 rounded text-sm"
                        value={tempPrescription.days}
                        onChange={e => setTempPrescription({...tempPrescription, days: Number(e.target.value)})}
                     />
                   </div>
                   <div className="col-span-1">
                     <button 
                       onClick={addPrescriptionItem}
                       className="w-full bg-green-600 text-white p-1.5 rounded text-sm hover:bg-green-700 flex justify-center"
                       title="添加"
                     >
                       <Plus className="h-4 w-4" />
                     </button>
                   </div>
                </div>
                {prescriptionBuffer.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-normal">药品</th>
                          <th className="px-3 py-2 font-normal">用量/用法</th>
                          <th className="px-3 py-2 font-normal">天数</th>
                          <th className="px-3 py-2 font-normal text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {prescriptionBuffer.map((item, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="px-3 py-2">{getMedicineName(item.medicineId!)}</td>
                            <td className="px-3 py-2 text-gray-600">{item.dosage} / {item.usage}</td>
                             <td className="px-3 py-2 text-gray-600">{item.days}天</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => removePrescriptionItem(idx)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setIsAddRecordModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">取消</button>
              <button onClick={handleSaveRecord} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm font-medium">保存病历</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Records Modal */}
      {isRecordsModalOpen && selectedPatient && createPortal(
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
           <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
             <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
               <div>
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                   <FileText className="h-5 w-5 text-indigo-600" />
                   {selectedPatient.name} 的电子病历
                 </h3>
                 <p className="text-xs text-gray-500 mt-1">ID: {selectedPatient.id} | 共 {patientRecords.length} 条记录</p>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => setIsRecordsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2"><X className="h-5 w-5" /></button>
               </div>
             </div>
             <div className="overflow-y-auto p-6 bg-gray-50/30 flex-1 space-y-6">
               {patientRecords.map((record, index) => (
                   <div key={record.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                     <div className="px-4 py-3 bg-indigo-50/30 border-b border-indigo-50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded font-bold">{record.visitDate}</span>
                          <span className="text-sm font-semibold text-gray-800">主治医生: {record.doctorName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">ID: {record.id}</span>
                            {isAdmin && (
                                <button 
                                    onClick={() => handleDeleteRecord(record.id)}
                                    className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 border border-red-200 px-2 py-0.5 rounded hover:bg-red-50"
                                >
                                    <Trash2 className="h-3 w-3" /> 删除
                                </button>
                            )}
                        </div>
                     </div>
                     <div className="p-4">
                       <div className="mb-4"><div className="text-xs font-bold text-gray-500 uppercase mb-1">诊断结果</div><div className="text-gray-900 font-medium">{record.diagnosis}</div></div>
                       <div className="mb-4"><div className="text-xs font-bold text-gray-500 uppercase mb-1">治疗方案</div><div className="text-gray-700 text-sm">{record.treatmentPlan}</div></div>
                       {record.details && record.details.length > 0 && (
                         <div className="bg-gray-50 rounded border border-gray-100 p-3 mt-3">
                           <table className="w-full text-xs">
                             <thead className="text-gray-400 text-left"><tr><th className="pb-1 font-medium">药品</th><th className="pb-1 font-medium">规格</th><th className="pb-1 font-medium">用量用法</th><th className="pb-1 font-medium">天数</th></tr></thead>
                             <tbody className="divide-y divide-gray-200">
                               {record.details.map((d: any) => (
                                 <tr key={d.id}>
                                   <td className="py-2 text-gray-800 font-medium">{d.medicineName}</td>
                                   <td className="py-2 text-gray-500">{d.medicineSpec}</td>
                                   <td className="py-2 text-gray-600">{d.dosage} / {d.usage}</td>
                                   <td className="py-2 text-gray-600">{d.days}天</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       )}
                     </div>
                   </div>
               ))}
             </div>
           </div>
         </div>,
         document.body
      )}
    </div>
  );
};
