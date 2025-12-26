
import React, { useState, useEffect } from 'react';
import { 
  getAppointments, getDoctors, getMedicines, getFullPatientDetails, 
  saveMedicalRecord, updateAppointmentStatus, getExistingPatient, invalidateCache 
} from '../services/mockDb';
import { getCurrentUser } from '../services/authService';
import { Appointment, Doctor, Medicine, MedicalRecord, PrescriptionDetail, Patient } from '../types';
import { Stethoscope, User, Clock, FileText, ChevronRight, Pill, Trash2, CheckCircle, AlertCircle, History, Users, BadgeCheck, BarChart2, PieChart as PieIcon, Activity, Calendar, UserCheck } from 'lucide-react';
import { addLog } from '../services/logger';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// Helper to get local date string YYYY-MM-DD
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DoctorConsultation: React.FC = () => {
  const user = getCurrentUser();
  const [myQueue, setMyQueue] = useState<Appointment[]>([]);
  const [deptQueue, setDeptQueue] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]); // For Admin View
  const [queueTab, setQueueTab] = useState<'mine' | 'all'>('mine');
  
  // Admin View State: Default to TODAY (Local Time)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  
  // State for current consultation
  const [currentAppointment, setCurrentAppointment] = useState<Appointment | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [prescriptionBuffer, setPrescriptionBuffer] = useState<Partial<PrescriptionDetail>[]>([]);
  const [tempPrescription, setTempPrescription] = useState<Partial<PrescriptionDetail>>({
    medicineId: '', dosage: '', usage: '', days: 3
  });

  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    loadData();
  }, []);

  // Refresh queue every 10 seconds. 
  // Dependency on selectedDate ensures the closure captures the correct date for Admin view.
  useEffect(() => {
    const interval = setInterval(() => {
        loadQueueOnly();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedDate, user?.id, user?.role]);

  const loadData = async () => {
    const [docs, meds] = await Promise.all([
      getDoctors(),
      getMedicines()
    ]);
    setDoctors(docs);
    setMedicines(meds);
    if (meds.length > 0) {
      setTempPrescription(prev => ({ ...prev, medicineId: meds[0].id }));
    }
    await loadQueueOnly();
  };

  const loadQueueOnly = async () => {
      // If Admin, fetch all (no doctorId param) BUT pass role='admin' to enable backend filtering by date if needed
      const queryId = user?.role === 'doctor' ? user.id : undefined;
      const queryRole = user?.role;

      // Pass selectedDate to filter by date in Admin mode
      const apps = await getAppointments(queryId, queryRole, selectedDate);
      
      if (user?.role === 'admin') {
          setAllAppointments(apps);
      } else {
          const pending = apps.filter(a => a.status === 'pending');
          // Client-side split: Mine vs Others in Department
          setMyQueue(pending.filter(a => a.doctorId === user?.id));
          setDeptQueue(pending.filter(a => a.doctorId !== user?.id));
      }
  };

  const activeQueue = queueTab === 'mine' ? myQueue : deptQueue;

  const handleCallNext = async () => {
    // Enforce FIFO: Always take the first item in the active queue
    const nextApp = activeQueue[0];

    if (!nextApp) {
      alert("当前列表没有候诊患者");
      return;
    }
    
    try {
        // 1. Force refresh patient data from backend (invalidate cache)
        invalidateCache('/patients');

        // 2. Try to find existing patient
        // This will THROW if patient doesn't exist, preventing ghost consultations
        const patient = await getExistingPatient(nextApp);

        // Only proceed if patient exists
        setCurrentAppointment(nextApp);
        setCurrentPatient(patient);
        
        // Load History
        setLoadingHistory(true);
        const history = await getFullPatientDetails(patient.id);
        setPatientHistory(history);
        setLoadingHistory(false);
        
        // Reset Form
        setDiagnosis('');
        setTreatmentPlan('');
        setPrescriptionBuffer([]);
        setActiveTab('current');

        addLog('INFO', '医生坐诊', '叫号', `接诊患者: ${nextApp.patientName} (来自${queueTab === 'mine' ? '我的' : '科室'}队列)`);
    } catch (error: any) {
        const msg = error.message || '未知错误';
        alert(`叫号中断: ${msg}`);
        addLog('ERROR', '医生坐诊', '叫号异常', msg);
        // Reset state on failure
        setCurrentAppointment(null);
        setCurrentPatient(null);
    }
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

  const handleSubmit = async () => {
    if (!currentAppointment || !currentPatient) {
        alert("错误：当前没有正在就诊的患者信息");
        return;
    }
    if (!diagnosis || !treatmentPlan) {
        alert("请填写诊断结果和治疗方案");
        return;
    }

    if (!window.confirm("确认提交病历并结束本次诊疗？")) return;

    // 1. Prepare Record Payload
    const doctorId = user?.id || currentAppointment.doctorId || 'DOC_UNKNOWN';
    // Use logged-in user name as the doctor name for the record
    const doctorName = user?.name || doctors.find(d => d.id === doctorId)?.name || '值班医生';
    
    // Explicitly generate ID to match backend 'NOT NULL' constraint
    const newRecordId = `R${Date.now()}`;
    const newRecord: MedicalRecord = {
        id: newRecordId,
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        doctorId: doctorId,
        doctorName: doctorName,
        diagnosis,
        treatmentPlan,
        visitDate: getTodayStr() // Use local date
    };

    const newDetails: PrescriptionDetail[] = prescriptionBuffer.map((p, idx) => ({
        id: `PD${Date.now()}-${idx}`,
        recordId: newRecordId, // Key link
        medicineId: p.medicineId!,
        dosage: p.dosage!,
        usage: p.usage!,
        days: p.days || 1
    }));

    // Inform user of the transaction
    addLog('INFO', '医生坐诊', '提交事务', `正在向后端 API 发送病历数据和状态更新...`);

    try {
        // 2. Parallel Execution: Save Record (POST) & Update Status (PUT)
        // Ensure strictly camelCase payload is sent by saveMedicalRecord internally
        await Promise.all([
            saveMedicalRecord(newRecord, newDetails),
            updateAppointmentStatus(currentAppointment.id, 'completed')
        ]);

        addLog('SUCCESS', '医生坐诊', '完成诊疗', `患者: ${currentPatient.name}, 诊断: ${diagnosis}`);
        alert("诊疗完成！");
        
        // 3. Reset & Refresh
        setCurrentAppointment(null);
        setCurrentPatient(null);
        setPrescriptionBuffer([]);
        loadQueueOnly();
    } catch (e: any) {
        alert(`提交失败: ${e.message}`);
        addLog('ERROR', '医生坐诊', '提交失败', e.message);
    }
  };

  const getMedicineName = (id: string) => medicines.find(m => m.id === id)?.name || id;

  // --- ADMIN VIEW RENDER ---
  if (user?.role === 'admin') {
    // Calculate Stats
    const total = allAppointments.length;
    const pending = allAppointments.filter(a => a.status === 'pending').length;
    const completed = allAppointments.filter(a => a.status === 'completed').length;
    
    const statusData = [
        { name: '候诊中 (Pending)', value: pending },
        { name: '已完成 (Completed)', value: completed }
    ];
    
    const deptCount: Record<string, number> = {};
    allAppointments.forEach(a => {
        deptCount[a.departmentName] = (deptCount[a.departmentName] || 0) + 1;
    });
    const deptData = Object.entries(deptCount).map(([name, value]) => ({ name, value }));

    const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899'];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl text-white shadow-lg">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">全院挂号监控中心</h2>
                        <p className="opacity-80">实时监控各科室挂号流量与医生接诊状态</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                           <p className="text-sm opacity-80 mb-1">选择统计日期</p>
                           <input 
                              type="date" 
                              className="text-gray-900 px-3 py-1.5 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-blue-300"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                           />
                        </div>
                        <Activity className="h-16 w-16 opacity-20" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">当日挂号总数</p>
                        <h3 className="text-3xl font-bold text-gray-900">{total}</h3>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600"><Users className="h-8 w-8" /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">当前候诊人数</p>
                        <h3 className="text-3xl font-bold text-orange-500">{pending}</h3>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-full text-orange-500"><Clock className="h-8 w-8" /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">当日已完成接诊</p>
                        <h3 className="text-3xl font-bold text-green-500">{completed}</h3>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full text-green-500"><CheckCircle className="h-8 w-8" /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <PieIcon className="h-5 w-5 text-indigo-500" /> 接诊状态分布
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-blue-500" /> 科室挂号热度
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deptData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis allowDecimals={false} />
                                <RechartsTooltip />
                                <Bar dataKey="value" name="挂号数" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-800 flex justify-between items-center">
                    <span>{selectedDate} 挂号明细列表</span>
                    <span className="text-xs font-normal text-gray-500 bg-white border px-2 py-1 rounded">
                       共 {allAppointments.length} 条
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">挂号ID</th>
                                <th className="px-6 py-3 font-medium">患者</th>
                                <th className="px-6 py-3 font-medium">科室</th>
                                <th className="px-6 py-3 font-medium">指定医生</th>
                                <th className="px-6 py-3 font-medium">状态</th>
                                <th className="px-6 py-3 font-medium">时间</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {allAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                        当日无挂号记录
                                    </td>
                                </tr>
                            ) : (
                                allAppointments.map(app => (
                                    <tr key={app.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-mono text-gray-500">{app.id}</td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{app.patientName}</td>
                                        <td className="px-6 py-3 text-gray-600">{app.departmentName}</td>
                                        <td className="px-6 py-3 text-gray-600">{app.doctorName || '随机分配'}</td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                app.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {app.status === 'completed' ? '已完成' : '候诊中'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500 text-xs">{app.createTime}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  }

  // --- DOCTOR VIEW RENDER ---
  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 animate-fade-in">
      {/* Left: Queue */}
      <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden flex-shrink-0">
         <div className="p-2 bg-gray-50 border-b border-gray-100">
            {/* Tabs */}
            <div className="flex bg-gray-200 p-1 rounded-lg mb-2">
                <button 
                  onClick={() => setQueueTab('mine')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${queueTab === 'mine' ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}
                >
                    我的挂号 ({myQueue.length})
                </button>
                <button 
                  onClick={() => setQueueTab('all')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${queueTab === 'all' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}
                >
                    科室协助 ({deptQueue.length})
                </button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {activeQueue.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                    {queueTab === 'mine' ? '暂无我的挂号' : '科室无其他挂号'}
                </div>
            ) : (
                activeQueue.map((app, idx) => (
                    <div 
                      key={app.id} 
                      className={`p-3 rounded-lg border flex flex-col transition-colors cursor-default
                        ${idx === 0 ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 opacity-80'}`}
                    >
                       <div className="flex justify-between items-start">
                          <div className="font-semibold text-gray-800 flex items-center gap-2">
                             <span className={`text-sm w-6 h-6 flex items-center justify-center rounded-full font-mono font-bold
                                ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                               {idx + 1}
                             </span>
                             {app.patientName}
                          </div>
                          {idx === 0 && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">下一位</span>}
                       </div>
                       <div className="text-xs text-gray-500 mt-2 ml-8 space-y-1">
                          <div className="flex justify-between">
                            <span>{app.departmentName}</span>
                            <span className="font-medium">{app.gender} | {app.age}岁</span>
                          </div>
                          <div className="bg-gray-50 p-1 rounded border border-gray-100">
                             <span className="text-gray-400">预约医生:</span> <span className="text-gray-700 font-medium">{app.doctorName || '随机分配'}</span>
                          </div>
                       </div>
                    </div>
                ))
            )}
         </div>
         <div className="p-4 border-t border-gray-100 bg-gray-50">
             <button 
               onClick={handleCallNext}
               disabled={activeQueue.length === 0 || !!currentAppointment}
               className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                 ${activeQueue.length === 0 || currentAppointment 
                   ? 'bg-gray-300 cursor-not-allowed' 
                   : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-95'}`}
             >
                <Stethoscope className="h-5 w-5" />
                {currentAppointment ? '诊疗进行中...' : `叫号 (系统自动顺位)`}
             </button>
             {activeQueue.length > 0 && !currentAppointment && (
               <p className="text-xs text-center text-gray-400 mt-2">
                 * 将呼叫{queueTab === 'mine' ? '我的' : '科室'}队列中的第 1 位患者
               </p>
             )}
         </div>
      </div>

      {/* Right: Workspace */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
         {!currentAppointment ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <div className="bg-gray-50 p-6 rounded-full mb-4">
                  <UserCheck className="h-16 w-16 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-600">工作台就绪</p>
                <p className="text-sm mt-2 text-gray-400">请点击左侧底部的“叫号”按钮开始接诊</p>
             </div>
         ) : (
             <>
               {/* Header */}
               <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                     <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl border-2 border-white shadow-sm">
                        {currentAppointment.patientName[0]}
                     </div>
                     <div>
                        <h2 className="text-xl font-bold text-gray-900">{currentAppointment.patientName}</h2>
                        <div className="text-sm text-gray-500 flex items-center gap-3">
                           <span>{currentAppointment.gender}</span>
                           <span>{currentAppointment.age}岁</span>
                           <span className="bg-yellow-100 text-yellow-800 px-2 rounded-full text-xs font-mono">
                             {currentAppointment.patientPhone}
                           </span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100 shadow-sm">
                         <BadgeCheck className="h-4 w-4" />
                         <span className="text-sm font-bold">接诊医生: {user?.name || '未知'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === 'current' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            本次就诊
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            历史记录 ({patientHistory.length})
                        </button>
                      </div>
                  </div>
               </div>
               
               {/* Content */}
               <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === 'current' ? (
                     <div className="space-y-6 max-w-4xl mx-auto">
                        {/* 1. Subjective */}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 shadow-sm">
                           <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" /> 主诉 / 病情描述
                           </h4>
                           <p className="text-gray-800">{currentAppointment.description}</p>
                        </div>

                        {/* 2. Assessment */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">诊断结果 (Diagnosis)</label>
                              <input 
                                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                placeholder="请输入确诊结果"
                                value={diagnosis}
                                onChange={e => setDiagnosis(e.target.value)}
                              />
                           </div>
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">治疗方案 (Plan)</label>
                              <textarea 
                                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none h-[50px] shadow-sm"
                                placeholder="请输入医嘱"
                                value={treatmentPlan}
                                onChange={e => setTreatmentPlan(e.target.value)}
                              />
                           </div>
                        </div>

                        {/* 3. Prescription */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                           <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-700 flex items-center gap-2">
                              <Pill className="h-4 w-4" /> 电子处方
                           </div>
                           <div className="p-4 bg-gray-50/50 space-y-4">
                              {/* Add Bar */}
                              <div className="flex gap-2 items-end">
                                 <div className="flex-1">
                                    <label className="text-xs text-gray-500 block mb-1">药品名称</label>
                                    <select 
                                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                                      value={tempPrescription.medicineId}
                                      onChange={e => setTempPrescription({...tempPrescription, medicineId: e.target.value})}
                                    >
                                       {medicines.map(m => (
                                          <option key={m.id} value={m.id}>{m.name} (库存:{m.stock})</option>
                                       ))}
                                    </select>
                                 </div>
                                 <div className="w-20">
                                    <label className="text-xs text-gray-500 block mb-1">用量</label>
                                    <input 
                                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                                      placeholder="0.5g"
                                      value={tempPrescription.dosage}
                                      onChange={e => setTempPrescription({...tempPrescription, dosage: e.target.value})}
                                    />
                                 </div>
                                 <div className="w-28">
                                    <label className="text-xs text-gray-500 block mb-1">用法</label>
                                    <input 
                                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                                      placeholder="每日3次"
                                      value={tempPrescription.usage}
                                      onChange={e => setTempPrescription({...tempPrescription, usage: e.target.value})}
                                    />
                                 </div>
                                 <div className="w-20">
                                    <label className="text-xs text-gray-500 block mb-1">天数</label>
                                    <input 
                                      type="number"
                                      className="w-full border p-2 rounded text-sm outline-none focus:border-blue-500"
                                      placeholder="3"
                                      value={tempPrescription.days}
                                      onChange={e => setTempPrescription({...tempPrescription, days: Number(e.target.value)})}
                                    />
                                 </div>
                                 <button 
                                   onClick={addPrescriptionItem}
                                   className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                                 >
                                   添加
                                 </button>
                              </div>
                              
                              {/* List */}
                              {prescriptionBuffer.length > 0 && (
                                 <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                       <tr className="text-gray-500 border-b">
                                          <th className="py-2 font-normal">药品</th>
                                          <th className="py-2 font-normal">用量</th>
                                          <th className="py-2 font-normal">用法</th>
                                          <th className="py-2 font-normal">天数</th>
                                          <th className="py-2 font-normal text-right">操作</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                       {prescriptionBuffer.map((item, idx) => (
                                          <tr key={idx}>
                                             <td className="py-2">{getMedicineName(item.medicineId!)}</td>
                                             <td className="py-2">{item.dosage}</td>
                                             <td className="py-2">{item.usage}</td>
                                             <td className="py-2">{item.days}天</td>
                                             <td className="py-2 text-right">
                                                <button onClick={() => removePrescriptionItem(idx)} className="text-red-500 hover:text-red-700">
                                                   <Trash2 className="h-4 w-4" />
                                                </button>
                                             </td>
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              )}
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-4">
                        {loadingHistory && <div className="text-center text-gray-500 py-4">加载中...</div>}
                        {!loadingHistory && patientHistory.length === 0 && <div className="text-center text-gray-500 py-10">无历史就诊记录</div>}
                        {patientHistory.map(record => (
                           <div key={record.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                              <div className="flex justify-between mb-2">
                                 <div className="font-bold text-gray-800">{record.diagnosis}</div>
                                 <div className="text-xs text-gray-500">{record.visitDate}</div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">医生: {record.doctorName}</div>
                              <div className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-100">
                                 {record.treatmentPlan}
                              </div>
                              {/* Prescription Preview in History Tab */}
                              {record.details && record.details.length > 0 && (
                                 <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2">
                                    <span className="font-bold">处方:</span> {record.details.map((d: any) => `${d.medicineName || d.medicineId} x${d.days}天`).join(', ')}
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  )}
               </div>

               {/* Footer */}
               <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                  <button 
                    onClick={() => {
                        if(window.confirm("确定取消当前诊疗？")) {
                            setCurrentAppointment(null);
                        }
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100"
                  >
                     取消
                  </button>
                  <button 
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2"
                  >
                     <CheckCircle className="h-5 w-5" /> 完成诊疗
                  </button>
               </div>
             </>
         )}
      </div>
    </div>
  );
};
