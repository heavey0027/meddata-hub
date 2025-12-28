
import React, { useState, useEffect } from 'react';
import { getDepartments, getDoctors, createAppointment, findPatientByQuery } from '../services/apiService';
import { getCurrentUser } from '../services/authService';
import { Department, Doctor, Appointment } from '../types';
import { UserPlus, Calendar, Stethoscope, Building2, CheckCircle, FileText, Lock } from 'lucide-react';

export const AppointmentHall: React.FC = () => {
  const user = getCurrentUser();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');  // 新增错误信息状态

  const [form, setForm] = useState({
    patientName: '',
    patientPhone: '',
    age: '',
    gender: '男' as '男' | '女',
    departmentId: '',
    doctorId: '',
    description: ''
  });

  useEffect(() => {
    const init = async () => {
      const [depts, docs] = await Promise.all([getDepartments(), getDoctors()]);
      setDepartments(depts);
      setDoctors(docs);
      if (depts.length > 0) setForm(prev => ({ ...prev, departmentId: depts[0].id }));
      if (user && user.role === 'patient') {
         const patient = await findPatientByQuery(user.id);
         if (patient) {
             setForm(prev => ({
                 ...prev,
                 patientName: patient.name,
                 patientPhone: patient.phone,
                 age: patient.age.toString(),
                 gender: patient.gender,
             }));
         }
      }
      setLoading(false);
    };
    init();
  }, []);

  const availableDoctors = doctors.filter(d => d.departmentId === form.departmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.patientName || !form.patientPhone || !form.description) {
      alert("请填写完整信息");
      return;
    }

    const dept = departments.find(d => d.id === form.departmentId);
    const doc = doctors.find(d => d.id === form.doctorId);

    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const newAppointment: Appointment = {
      id: `APT${Date.now()}`,
      patientId: user?.role === 'patient' ? user.id : undefined,
      patientName: form.patientName,
      patientPhone: form.patientPhone,
      age: parseInt(form.age) || 0,
      gender: form.gender,
      departmentId: form.departmentId,
      departmentName: dept?.name || 'Unknown',
      doctorId: form.doctorId || undefined,
      doctorName: doc?.name,
      description: form.description,
      status: 'pending',
      createTime: formattedTime
    };

    try {
      await createAppointment(newAppointment);
      setSuccessMsg(`挂号成功！您的号码是: ${newAppointment.id.slice(-4)}`);
      setForm(prev => ({
        ...prev,
        doctorId: '', 
        description: '',
        patientName: user?.role === 'patient' ? prev.patientName : '',
        patientPhone: user?.role === 'patient' ? prev.patientPhone : '',
        age: user?.role === 'patient' ? prev.age : '',
        gender: user?.role === 'patient' ? prev.gender : '男',
      }));
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error: any) {
      setErrorMsg(error.message || '挂号失败');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">正在初始化挂号系统...</div>;
  const isPatient = user?.role === 'patient';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-800 flex justify-center items-center gap-3">
          <UserPlus className="h-8 w-8 text-blue-600" />
          自助挂号大厅
        </h2>
        <p className="text-gray-500">填写病情主诉，选择科室，快速完成预约</p>
      </div>

      {/* 错误弹窗 */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-center gap-2 animate-fade-in">
          <Lock className="h-5 w-5" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        <div className="bg-blue-600 p-8 text-white md:w-1/3 flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-xl font-bold border-b border-blue-500 pb-4">挂号流程</h3>
            <ul className="space-y-4 text-blue-50">
              <li className="flex gap-3"><div><UserPlus className="h-5 w-5" /></div><div><p className="font-semibold">1. 确认身份</p><p className="text-xs opacity-80">{isPatient ? '系统已自动调取档案' : '输入患者真实姓名'}</p></div></li>
              <li className="flex gap-3"><div><Building2 className="h-5 w-5" /></div><div><p className="font-semibold">2. 选择科室</p><p className="text-xs opacity-80">根据病情选择对应科室</p></div></li>
              <li className="flex gap-3"><div><FileText className="h-5 w-5" /></div><div><p className="font-semibold">3. 描述病情</p><p className="text-xs opacity-80">简述主要症状</p></div></li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:w-2/3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名 <span className="text-red-500">*</span></label>
              <input 
                className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${isPatient ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                value={form.patientName} 
                onChange={e => setForm({...form, patientName: e.target.value})} 
                disabled={isPatient}
              />
              {isPatient && <Lock className="absolute right-3 top-9 h-4 w-4 text-gray-400" />}
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">电话 <span className="text-red-500">*</span></label>
              <input 
                className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${isPatient ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                value={form.patientPhone} 
                onChange={e => setForm({...form, patientPhone: e.target.value})} 
                disabled={isPatient}
              />
              {isPatient && <Lock className="absolute right-3 top-9 h-4 w-4 text-gray-400" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
                 <select 
                   className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white ${isPatient ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`} 
                   value={form.gender} 
                   onChange={e => setForm({...form, gender: e.target.value as any})} 
                   disabled={isPatient}
                 >
                   <option value="男">男</option>
                   <option value="女">女</option>
                 </select>
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
                 <input 
                   type="number" 
                   className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${isPatient ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`} 
                   value={form.age} 
                   onChange={e => setForm({...form, age: e.target.value})} 
                   disabled={isPatient}
                 />
               </div>
            </div>
          </div>

          <div className="border-t border-gray-100 my-4 pt-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">就诊科室 <span className="text-red-500">*</span></label>
                  <div className="relative">
                     <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                     <select 
                       className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 outline-none bg-white focus:ring-2 focus:ring-blue-500" 
                       value={form.departmentId} 
                       onChange={e => setForm({...form, departmentId: e.target.value, doctorId: ''})}
                     >
                       {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </select>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">指定医生</label>
                  <div className="relative">
                     <Stethoscope className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                     <select 
                       className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 outline-none bg-white focus:ring-2 focus:ring-blue-500" 
                       value={form.doctorId} 
                       onChange={e => setForm({...form, doctorId: e.target.value})}
                     >
                       <option value="">随机分配</option>
                       {availableDoctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.title})</option>)}
                     </select>
                  </div>
               </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">病情简述 <span className="text-red-500">*</span></label>
                <textarea 
                  rows={4} 
                  className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})} 
                  placeholder="症状描述..." 
                />
             </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform active:scale-95">
            确认挂号
          </button>
        </form>
      </div>
    </div>
  );
};
