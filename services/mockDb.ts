
import { Patient, MedicalRecord, Doctor, Department, Medicine, PrescriptionDetail, DashboardStats, PatientDemographics, Appointment, UserRole, MonthlyStats } from '../types';
import { addLog } from './logger';

// 配置后端 API 地址。
const API_BASE_URL = 'http://localhost:5000/api';

// --- TIME HELPERS ---
const getTwoDigit = (num: number) => String(num).padStart(2, '0');

// Return YYYY-MM-DD HH:mm:ss (Local Browser Time)
export const getLocalDatetime = () => {
  const now = new Date();
  return `${now.getFullYear()}-${getTwoDigit(now.getMonth() + 1)}-${getTwoDigit(now.getDate())} ${getTwoDigit(now.getHours())}:${getTwoDigit(now.getMinutes())}:${getTwoDigit(now.getSeconds())}`;
};

// Return YYYY-MM-DD (Local Browser Time)
export const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${getTwoDigit(now.getMonth() + 1)}-${getTwoDigit(now.getDate())}`;
};

// --- CACHE STUB (Deprecated) ---
// Caching is removed to ensure real-time data consistency with backend.
export const invalidateCache = (keyPattern: string) => {
  // No-op
};

// --- MOCK DATA (Fallback) ---
const mockDepartments: Department[] = [
  { id: 'D01', name: '心内科', location: '门诊楼 2F' },
  { id: 'D02', name: '呼吸科', location: '门诊楼 3F' },
  { id: 'D03', name: '骨科', location: '外科楼 1F' },
  { id: 'D04', name: '急诊科', location: '急诊楼 1F' },
  { id: 'D05', name: '神经内科', location: '门诊楼 4F' },
];

const mockDoctors: Doctor[] = [
  { id: 'DOC01', name: '张伟', password: 'password', departmentId: 'D01', specialty: '高血压', phone: '13800001111', title: '主任医师', pendingCount: 3 },
  { id: 'DOC02', name: '李娜', password: 'password', departmentId: 'D02', specialty: '肺炎', phone: '13800002222', title: '副主任医师', pendingCount: 8 },
  { id: 'DOC03', name: '王强', password: 'password', departmentId: 'D03', specialty: '创伤骨科', phone: '13800003333', title: '主治医师', pendingCount: 0 },
  { id: 'DOC04', name: '赵敏', password: 'password', departmentId: 'D01', specialty: '冠心病', phone: '13800004444', title: '主治医师', pendingCount: 12 },
  { id: 'DOC05', name: '陈杰', password: 'password', departmentId: 'D05', specialty: '脑卒中', phone: '13800005555', title: '主任医师', pendingCount: 1 },
];

const mockMedicines: Medicine[] = [
  { id: 'MED01', name: '阿司匹林肠溶片', price: 15.5, stock: 500, specification: '100mg*30片' },
  { id: 'MED02', name: '阿莫西林胶囊', price: 22.0, stock: 300, specification: '0.25g*24粒' },
  { id: 'MED03', name: '布洛芬缓释胶囊', price: 28.5, stock: 150, specification: '0.3g*20粒' },
  { id: 'MED04', name: '硝苯地平控释片', price: 35.0, stock: 400, specification: '30mg*7片' },
  { id: 'MED05', name: '头孢拉定胶囊', price: 18.0, stock: 80, specification: '0.25g*24粒' },
  { id: 'MED06', name: '连花清瘟胶囊', price: 24.0, stock: 50, specification: '0.35g*24粒' },
];

const mockPatients: Patient[] = [
  { id: 'P001', name: '刘洋', password: 'password', gender: '男', age: 45, phone: '13911112222', address: '北京市海淀区中关村', createTime: '2023-01-10', isVip: true },
  { id: 'P002', name: '陈晨', password: 'password', gender: '女', age: 32, phone: '13933334444', address: '北京市朝阳区建国路', createTime: '2023-02-15', isVip: false },
  { id: 'P003', name: '赵铁柱', password: 'password', gender: '男', age: 67, phone: '13955556666', address: '北京市丰台区西四环', createTime: '2023-03-20', isVip: true },
  { id: 'P004', name: '孙小美', password: 'password', gender: '女', age: 28, phone: '13977778888', address: '北京市西城区金融街', createTime: '2023-05-05', isVip: false },
  { id: 'P005', name: '周杰', password: 'password', gender: '男', age: 55, phone: '13999990000', address: '北京市通州区运河大街', createTime: '2023-06-12', isVip: false },
];

const mockRecords: MedicalRecord[] = [
  { 
    id: 'R001', patientId: 'P001', patientName: '刘洋', doctorId: 'DOC01', doctorName: '张伟',
    diagnosis: '原发性高血压', treatmentPlan: '药物控制血压，低盐饮食', 
    visitDate: '2023-10-01' 
  },
  { 
    id: 'R002', patientId: 'P002', patientName: '陈晨', doctorId: 'DOC02', doctorName: '李娜',
    diagnosis: '急性支气管炎', treatmentPlan: '抗感染，止咳化痰', 
    visitDate: '2023-10-05' 
  },
  { 
    id: 'R003', patientId: 'P003', patientName: '赵铁柱', doctorId: 'DOC01', doctorName: '张伟',
    diagnosis: '冠心病', treatmentPlan: '改善心肌供血，二级预防', 
    visitDate: '2023-10-12' 
  },
  { 
    id: 'R004', patientId: 'P004', patientName: '孙小美', doctorId: 'DOC03', doctorName: '王强',
    diagnosis: '踝关节扭伤', treatmentPlan: '冷敷，制动休息', 
    visitDate: '2023-10-15' 
  },
  {
    id: 'R005', patientId: 'P001', patientName: '刘洋', doctorId: 'DOC04', doctorName: '赵敏',
    diagnosis: '高血压复诊', treatmentPlan: '继续当前治疗方案',
    visitDate: '2023-11-01'
  }
];

const mockPrescriptionDetails: PrescriptionDetail[] = [
  { id: 'PD01', recordId: 'R001', medicineId: 'MED04', dosage: '30mg', usage: '口服，每日一次', days: 14 },
  { id: 'PD02', recordId: 'R002', medicineId: 'MED02', dosage: '0.5g', usage: '口服，每日三次', days: 7 },
  { id: 'PD03', recordId: 'R003', medicineId: 'MED01', dosage: '100mg', usage: '口服，每日一次', days: 30 },
  { id: 'PD04', recordId: 'R004', medicineId: 'MED03', dosage: '0.3g', usage: '口服，必要时', days: 3 },
  { id: 'PD05', recordId: 'R005', medicineId: 'MED04', dosage: '30mg', usage: '口服，每日一次', days: 28 },
];

const mockAppointments: Appointment[] = [];

// --- API Helpers (Direct Fetch, No Cache) ---

async function fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T> {
  // Use timestamp to prevent browser 304 caching
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${API_BASE_URL}${endpoint}${separator}_t=${Date.now()}`; 
  
  addLog('INFO', 'API_REQUEST', 'GET 请求发起', `Target: ${endpoint}`, {
    method: 'GET',
    requestUrl: url
  });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); 

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    addLog('SUCCESS', 'API_RESPONSE', '请求成功', `Endpoint: ${endpoint}`, {
      statusCode: response.status,
      dataSize: JSON.stringify(data).length
    });
    
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown';
    if (endpoint !== '/doctors') { // Ignore initial health check noise
         addLog('WARNING', 'API_FAIL', '请求失败 - 使用 Mock 数据', `Endpoint: ${endpoint}`, {
           error: errorMsg,
           fallback: true
         });
    }
    return fallbackData;
  }
};

// Login API Call
export const loginUser = async (role: UserRole, id: string, password: string): Promise<any> => {
  const url = `${API_BASE_URL}/login?_t=${Date.now()}`;
  const body = { role, id, password };

  addLog('INFO', 'API_REQUEST', 'POST 登录请求', `Role: ${role}, User: ${id}`, {
    requestUrl: url,
    method: 'POST',
    body: { ...body, password: '***' }
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      addLog('SUCCESS', 'AUTH', '后端验证通过', `User: ${id}`, { response: data });
      return data;
    } else {
      throw new Error(data.message || '登录失败');
    }
  } catch (error) {
    addLog('WARNING', 'AUTH', '后端登录失败/不可用', '尝试切换至本地 Mock 验证', {
      error: error instanceof Error ? error.message : 'Unknown Error'
    });
    throw error;
  }
};

export const checkBackendHealth = async (): Promise<boolean> => {
  const targetUrl = `${API_BASE_URL}/doctors?_t=${Date.now()}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(targetUrl, { 
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
};

// --- CRUD Operations (Strictly matching Backend Routes) ---

export const getPatients = async (limit?: number, offset?: number): Promise<Patient[]> => {
  const local = localStorage.getItem('meddata_patients');
  const allPatients = local ? JSON.parse(local) : mockPatients;
  
  // Local Mock Pagination
  let fallback = allPatients;
  if (limit !== undefined) {
      const start = offset || 0;
      fallback = allPatients.slice(start, start + limit);
  }

  // API Request Construction
  let endpoint = '/patients';
  const params: string[] = [];
  if (limit !== undefined) params.push(`limit=${limit}`);
  if (offset !== undefined) params.push(`offset=${offset}`);
  
  if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
  }

  return fetchWithFallback(endpoint, fallback);
};

// Optimize for total count retrieval
export const getPatientCount = async (): Promise<number> => {
  const local = localStorage.getItem('meddata_patients');
  const count = local ? JSON.parse(local).length : mockPatients.length;
  
  const response = await fetchWithFallback<any>('/patients/count', { total_patients: count });
  return typeof response === 'number' ? response : (response.total_patients ?? response.count ?? count);
};

// Fetch Patient Gender Ratio stats
const getPatientGenderStats = async (): Promise<{name: string, value: number}[]> => {
    const local = localStorage.getItem('meddata_patients');
    const allPatients = local ? JSON.parse(local) : mockPatients;
    const fallbackStats = allPatients.reduce((acc: any, p: Patient) => {
        if (p.gender === '男') acc.male++;
        else if (p.gender === '女') acc.female++;
        else acc.other++;
        return acc;
    }, { male: 0, female: 0, other: 0 });

    const data = await fetchWithFallback<any>('/patients/gender_ratio', fallbackStats);

    return [
        { name: '男', value: data.male || 0 },
        { name: '女', value: data.female || 0 },
        { name: '未知性别', value: data.other || 0 }
    ];
};

// Fetch Patient Age Ratio stats
const getPatientAgeStats = async (): Promise<{name: string, value: number}[]> => {
    const local = localStorage.getItem('meddata_patients');
    const allPatients = local ? JSON.parse(local) : mockPatients;
    const fallbackStats = { '青少年': 0, '青年': 0, '中年': 0, '老年': 0 };
    
    allPatients.forEach((p: Patient) => {
        if (p.age <= 18) fallbackStats['青少年']++;
        else if (p.age <= 35) fallbackStats['青年']++;
        else if (p.age <= 60) fallbackStats['中年']++;
        else fallbackStats['老年']++;
    });

    const data = await fetchWithFallback<any>('/patients/age_ratio', fallbackStats);

    return [
        { name: '0-18岁 (青少年)', value: data['青少年'] || 0 },
        { name: '19-35岁 (青年)', value: data['青年'] || 0 },
        { name: '36-60岁 (中年)', value: data['中年'] || 0 },
        { name: '60岁以上 (老年)', value: data['老年'] || 0 }
    ];
};

// 1. Create Patient (POST /api/patients)
export const createPatient = async (patient: Patient) => {
  patient.createTime = getLocalDate();
  const current = await getPatients(); 
  localStorage.setItem('meddata_patients', JSON.stringify([...current, patient]));
  
  const url = `${API_BASE_URL}/patients?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 新增患者', `ID: ${patient.id}`, { url, body: patient });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
     const data = await response.json();
    if (!response.ok) throw new Error(data.message || '创建失败');
    const current = await getPatients();
    localStorage.setItem('meddata_patients', JSON.stringify([...current, patient]));
    addLog('SUCCESS', 'API_RESPONSE', '患者创建成功 (DB)');
  } catch (e: any) {
    addLog('ERROR', 'API_FAIL', '创建患者失败', e.message);
    throw e;
  }
};

// 2. Update Patient (PUT /api/patients/<id>)
export const updatePatient = async (patient: Patient) => {
  const current = await getPatients();
  const updated = current.map(p => p.id === patient.id ? patient : p);
  localStorage.setItem('meddata_patients', JSON.stringify(updated));

  const url = `${API_BASE_URL}/patients/${patient.id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'PUT 更新患者', `ID: ${patient.id}`, { url, body: patient });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '更新失败');
    const current = await getPatients();
    const updated = current.map(p => p.id === patient.id ? patient : p);
    localStorage.setItem('meddata_patients', JSON.stringify(updated));
    addLog('SUCCESS', 'API_RESPONSE', '患者更新成功 (DB)');
  } catch (e: any) { 
    addLog('ERROR', 'API_FAIL', '更新患者失败', e.message);
    throw e; 
  }
};

export const deletePatient = async (id: string) => {
  const current = await getPatients();
  const updated = current.filter(p => p.id !== id);
  localStorage.setItem('meddata_patients', JSON.stringify(updated));

  const url = `${API_BASE_URL}/patients/${id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'DELETE 删除患者', `ID: ${id}`, { url });

  try {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || '删除失败');
    }
    addLog('SUCCESS', 'API_RESPONSE', '患者删除成功 (DB)');
  } catch (e: any) {
    addLog('ERROR', 'API_FAIL', '删除患者失败', e.message);
    throw e;
  }
};

export const getRecords = async (patientId?: string): Promise<MedicalRecord[]> => {
  const local = localStorage.getItem('meddata_records');
  let fallback = local ? JSON.parse(local) : mockRecords;
  
  if (patientId) {
      fallback = fallback.filter((r: MedicalRecord) => r.patientId === patientId);
  }
  
  let endpoint = '/records';
  if (patientId) {
      endpoint += `?patient_id=${patientId}`;
  }

  return fetchWithFallback(endpoint, fallback);
};

export const deleteMedicalRecord = async (id: string) => {
  const current = await getRecords();
  const updated = current.filter(r => r.id !== id);
  localStorage.setItem('meddata_records', JSON.stringify(updated));

  const url = `${API_BASE_URL}/records/${id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'DELETE 删除病历', `ID: ${id}`, { url });

  try {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || '删除失败');
    }
    addLog('SUCCESS', 'API_RESPONSE', '病历删除成功');
  } catch (e: any) {
    addLog('ERROR', 'API_FAIL', '删除病历失败', e.message);
    throw e;
  }
};

// --- Doctor CRUD ---

export const getDoctors = async (): Promise<Doctor[]> => {
  const local = localStorage.getItem('meddata_doctors');
  const fallback = local ? JSON.parse(local) : mockDoctors;
  return fetchWithFallback('/doctors', fallback);
};

export const getDoctorById = async (id: string): Promise<Doctor | undefined> => {
    const local = localStorage.getItem('meddata_doctors');
    const fallbackList = local ? JSON.parse(local) : mockDoctors;
    const fallback = fallbackList.find((d: Doctor) => d.id === id);

    // Call /api/doctors/<doctor_id>
    return fetchWithFallback(`/doctors/${id}`, fallback);
};

export const updateDoctor = async (id: string, data: Partial<Doctor>) => {
    // Local persistence
    const current = await getDoctors();
    const updated = current.map(d => d.id === id ? { ...d, ...data } : d);
    localStorage.setItem('meddata_doctors', JSON.stringify(updated));

    const url = `${API_BASE_URL}/doctors/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新医生信息', `ID: ${id}`, { url, body: data });
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.message || '更新失败');
        
        const current = await getDoctors();
        const updated = current.map(d => d.id === id ? { ...d, ...data } : d);
        localStorage.setItem('meddata_doctors', JSON.stringify(updated));
        
        addLog('SUCCESS', 'API_RESPONSE', '医生更新成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '更新医生失败', e.message);
        throw e;
    }
};

export const deleteDoctor = async (id: string) => {
    const current = await getDoctors();
    const updated = current.filter(d => d.id !== id);
    localStorage.setItem('meddata_doctors', JSON.stringify(updated));

    const url = `${API_BASE_URL}/doctors/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除医生', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || '删除失败');
        }
        addLog('SUCCESS', 'API_RESPONSE', '医生删除成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '删除医生失败', e.message);
        throw e;
    }
};

// --- Department CRUD ---

export const getDepartments = async (): Promise<Department[]> => {
  const local = localStorage.getItem('meddata_departments');
  const fallback = local ? JSON.parse(local) : mockDepartments;
  return fetchWithFallback('/departments', fallback);
};

export const getDepartmentById = async (id: string): Promise<Department | undefined> => {
    const local = localStorage.getItem('meddata_departments');
    const fallbackList = local ? JSON.parse(local) : mockDepartments;
    const fallback = fallbackList.find((d: Department) => d.id === id);

    // Call /api/departments/<department_id>
    return fetchWithFallback(`/departments/${id}`, fallback);
};

export const deleteDepartment = async (id: string) => {
    const current = await getDepartments();
    const updated = current.filter(d => d.id !== id);
    localStorage.setItem('meddata_departments', JSON.stringify(updated));

    const url = `${API_BASE_URL}/departments/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除科室', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || '删除失败');
        }
        addLog('SUCCESS', 'API_RESPONSE', '科室删除成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '删除科室失败', e.message);
        throw e;
    }
};

// --- Medicine CRUD ---

export const getMedicines = async (): Promise<Medicine[]> => {
  const local = localStorage.getItem('meddata_medicines');
  const fallback = local ? JSON.parse(local) : mockMedicines;
  return fetchWithFallback('/medicines', fallback);
};

export const getMedicineById = async (id: string): Promise<Medicine | undefined> => {
    const local = localStorage.getItem('meddata_medicines');
    const fallbackList = local ? JSON.parse(local) : mockMedicines;
    const fallback = fallbackList.find((m: Medicine) => m.id === id);

    // Call /api/medicines/<medicine_id>
    return fetchWithFallback(`/medicines/${id}`, fallback);
};

export const updateMedicine = async (id: string, data: Partial<Medicine>) => {
    // Local persistence
    const current = await getMedicines();
    const updated = current.map(m => m.id === id ? { ...m, ...data } : m);
    localStorage.setItem('meddata_medicines', JSON.stringify(updated));

    const url = `${API_BASE_URL}/medicines/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新药品信息', `ID: ${id}`, { url, body: data });

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.message || '更新失败');

        const current = await getMedicines();
        const updated = current.map(m => m.id === id ? { ...m, ...data } : m);
        localStorage.setItem('meddata_medicines', JSON.stringify(updated));
        
        addLog('SUCCESS', 'API_RESPONSE', '药品更新成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '更新药品失败', e.message);
        throw e;
    }
};

export const deleteMedicine = async (id: string) => {
    const current = await getMedicines();
    const updated = current.filter(m => m.id !== id);
    localStorage.setItem('meddata_medicines', JSON.stringify(updated));

    const url = `${API_BASE_URL}/medicines/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除药品', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || '删除失败');
        }
        addLog('SUCCESS', 'API_RESPONSE', '药品删除成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '删除药品失败', e.message);
        throw e;
    }
};

export const getPrescriptionDetails = async (recordId?: string): Promise<PrescriptionDetail[]> => {
  const local = localStorage.getItem('meddata_prescriptions');
  let fallback = local ? JSON.parse(local) : mockPrescriptionDetails;
  
  if (recordId) {
      fallback = fallback.filter((d: PrescriptionDetail) => d.recordId === recordId);
  }

  let endpoint = '/prescription_details';
  if (recordId) {
      endpoint += `?record_id=${recordId}`;
  }

  return fetchWithFallback(endpoint, fallback);
};

// 3. Create Medical Record (POST /api/records)
export const saveMedicalRecord = async (record: MedicalRecord, details: PrescriptionDetail[]) => {
  if (!record.visitDate) {
      record.visitDate = getLocalDate();
  }

  const currentRecords = await getRecords();
  localStorage.setItem('meddata_records', JSON.stringify([...currentRecords, record]));
  const currentDetails = await getPrescriptionDetails();
  localStorage.setItem('meddata_prescriptions', JSON.stringify([...currentDetails, ...details]));
  
  if (!record.id || !record.patientId || !record.doctorId || !record.diagnosis || !record.treatmentPlan) {
      addLog('WARNING', 'API_REQUEST', '病历字段缺失', '未发送请求', { record });
      return;
  }

  const backendPayload = {
      record: {
          id: record.id,
          patientId: record.patientId,
          doctorId: record.doctorId,
          diagnosis: record.diagnosis,
          treatmentPlan: record.treatmentPlan,
          visitDate: record.visitDate 
      },
      details: details.map(d => ({
          id: d.id,
          recordId: record.id,
          medicineId: d.medicineId,
          dosage: d.dosage,
          usage: d.usage,
          days: d.days
      }))
  };

  const url = `${API_BASE_URL}/records?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 提交病历', `RecordID: ${record.id}`, { url, body: backendPayload });

  try {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
    });
     const data = await response.json();
    if(!response.ok) throw new Error(data.message || '病历提交失败');
    
    const currentRecords = await getRecords();
    localStorage.setItem('meddata_records', JSON.stringify([...currentRecords, record]));
    addLog('SUCCESS', 'API_RESPONSE', '病历提交成功 (DB)');
  } catch (e: any) { 
    addLog('ERROR', 'API_FAIL', '病历提交异常', e.message);
    throw e;
  }
};

// 4. Get Appointments (Updated for My Appointments)
export const getAppointments = async (
  doctorId?: string, 
  queryRole?: UserRole, 
  specificDate?: string,
  patientId?: string
): Promise<Appointment[]> => {
  const local = localStorage.getItem('meddata_appointments');
  let fallback = local ? JSON.parse(local) : mockAppointments;

  if (doctorId) {
    const doctors = await getDoctors();
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) fallback = fallback.filter((a: Appointment) => a.departmentId === doc.departmentId);
  }

  if (patientId) fallback = fallback.filter((a: Appointment) => a.patientId === patientId);
  if (specificDate) fallback = fallback.filter((a: Appointment) => a.createTime.startsWith(specificDate));

  let params = [];
  if (doctorId) params.push(`doctor_id=${doctorId}`);
  if (patientId) params.push(`patient_id=${patientId}`);
  
  if (queryRole === 'admin') {
      params.push(`role=admin`);
      if (specificDate) params.push(`date=${specificDate}`);
  } else {
      if (specificDate) params.push(`date=${specificDate}`);
  }

  const queryString = params.length > 0 ? `?${params.join('&')}` : '';
  const endpoint = `/appointments${queryString}`;
  return fetchWithFallback(endpoint, fallback);
};

// 5. Create Appointment (POST /api/appointments)
export const createAppointment = async (appointment: Appointment) => {
  appointment.createTime = getLocalDatetime();
  const current = await getAppointments();
  localStorage.setItem('meddata_appointments', JSON.stringify([...current, appointment]));

  const backendPayload = { ...appointment, status: 'pending' };
  const url = `${API_BASE_URL}/appointments?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 挂号', `Patient: ${appointment.patientName}`, { url, body: backendPayload });

  try {
     const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
     });
     const data = await response.json();
     if (!response.ok) throw new Error(data.message || '挂号失败');
     
     const current = await getAppointments();
     localStorage.setItem('meddata_appointments', JSON.stringify([...current, appointment]));
     addLog('SUCCESS', 'API_RESPONSE', '挂号成功 (DB)');
  } catch(e: any) {
     addLog('ERROR', 'API_FAIL', '挂号失败', e.message);
     throw e; 
  }
};

// 6. Update Appointment Status (PUT /api/appointments/<id>)
export const updateAppointmentStatus = async (id: string, status: 'completed' | 'cancelled') => {
    const current = await getAppointments();
    const updated = current.map(a => a.id === id ? { ...a, status } : a);
    localStorage.setItem('meddata_appointments', JSON.stringify(updated));

    const url = `${API_BASE_URL}/appointments/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新挂号状态', `ID: ${id}`, { url, status });

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '更新状态失败');
        addLog('SUCCESS', 'API_RESPONSE', '状态更新成功 (DB)');
    } catch (e: any) {
        addLog('ERROR', 'API_FAIL', '更新挂号状态失败', e.message);
        throw e;
    }
};

// 7. Get Appointment Statistics (Hourly Trend)
export const getAppointmentStatistics = async (date?: string): Promise<{ hour: number; count: number }[]> => {
  const mockFallback = async () => {
    const scopeMultiplier = !date ? 50 : (date.length === 4 ? 20 : (date.length === 7 ? 5 : 1));
    const trend = Array.from({ length: 24 }, (_, i) => {
        let base = 0;
        if (i >= 8 && i <= 11) base = Math.floor(Math.random() * 10) + 5; 
        if (i >= 13 && i <= 16) base = Math.floor(Math.random() * 8) + 4; 
        if (i < 8 || i > 18) base = Math.floor(Math.random() * 2); 
        return { hour: i, count: base * scopeMultiplier };
    });
    return trend;
  };

  let queryString = `role=admin`;
  if (date) queryString += `&date=${date}`;
  const endpoint = `/appointments/statistics?${queryString}`;
  const fallbackData = await mockFallback();
  return fetchWithFallback(endpoint, fallbackData);
};

// 8. Get Sankey Data for Flow Analysis
export const getSankeyData = async () => {
  const mockNodes = [
    { name: "挂号总数" }, { name: "科室: 心内科" }, { name: "科室: 呼吸科" },
    { name: "确诊/检查" }, { name: "开药/治疗" }, { name: "离院/康复" }
  ];
  const mockLinks = [
    { source: "挂号总数", target: "科室: 心内科", value: 50 },
    { source: "挂号总数", target: "科室: 呼吸科", value: 30 },
    { source: "科室: 心内科", target: "确诊/检查", value: 45 },
    { source: "科室: 呼吸科", target: "确诊/检查", value: 25 },
    { source: "确诊/检查", target: "开药/治疗", value: 60 },
    { source: "确诊/检查", target: "离院/康复", value: 10 },
    { source: "开药/治疗", target: "离院/康复", value: 60 }
  ];
  return fetchWithFallback('/stats/sankey', { nodes: mockNodes, links: mockLinks });
};

// 9. Get Monthly Statistics (New Endpoint)
export const getMonthlyStatistics = async (): Promise<MonthlyStats> => {
  // Mock Fallback: Use client side calculation logic or stubs
  const mockFallback: MonthlyStats = {
      currentMonthPatients: (await getPatientCount()),
      patientGrowthRate: 5.2, // Simulated positive growth
      currentMonthVisits: (await getRecords()).length,
      visitGrowthRate: 12.5
  };

  return fetchWithFallback('/statistics/monthly', mockFallback);
};

// --- Logic Helpers ---

export const findPatientByQuery = async (query: string | undefined | null): Promise<Patient | undefined> => {
  if (!query) return undefined;
  const q = String(query).trim();
  if (!q) return undefined;
  
  const local = localStorage.getItem('meddata_patients');
  const allPatients = local ? JSON.parse(local) : mockPatients;
  
  const localMatch = allPatients.find((p: Patient) => 
    p.id.toLowerCase() === q.toLowerCase() || 
    p.phone === q || 
    p.name === q
  );

  const endpoint = `/patients?query=${encodeURIComponent(q)}`;
  const patients = await fetchWithFallback<Patient[]>(endpoint, localMatch ? [localMatch] : []);
  return patients.find(p => p.id.toLowerCase() === q.toLowerCase() || p.phone === q) || patients[0];
};

export const getExistingPatient = async (appointment: Appointment): Promise<Patient> => {
    if (!appointment) throw new Error("挂号单数据无效");

    if (appointment.patientId) {
        const existing = await findPatientByQuery(appointment.patientId);
        if (existing) {
             addLog('INFO', 'PATIENT_LOOKUP', '患者已存在 (ID Match)', existing.id);
             return existing;
        }
    }

    if (appointment.patientPhone) {
        const existingByPhone = await findPatientByQuery(appointment.patientPhone);
        if (existingByPhone) {
            addLog('INFO', 'PATIENT_LOOKUP', '患者已存在 (Phone Match)', existingByPhone.id);
            return existingByPhone;
        }
    }

    addLog('ERROR', 'PATIENT_LOOKUP', '未找到患者档案', `挂号信息: ${appointment.patientName} ${appointment.patientPhone}`);
    throw new Error(`未找到患者档案！请确认该患者是否已注册。 (姓名: ${appointment.patientName}, 电话: ${appointment.patientPhone})`);
};

export const getFullPatientDetails = async (patientId: string) => {
  const records = await getRecords(patientId);
  const medicines = await getMedicines();

  records.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

  const enrichedRecords = await Promise.all(records.map(async (record) => {
      const details = await getPrescriptionDetails(record.id);
      const recordDetails = details.map(d => {
        const med = medicines.find(m => m.id === d.medicineId);
        return { 
          ...d, 
          medicineName: med?.name, 
          medicinePrice: med?.price, 
          medicineSpec: med?.specification
        };
      });
      return { ...record, details: recordDetails };
  }));

  return enrichedRecords;
};

export const getStats = async (): Promise<DashboardStats> => {
  const [totalPatients, records, doctors, departments, medicines] = await Promise.all([
    getPatientCount(), getRecords(), getDoctors(), getDepartments(), getMedicines()
  ]);
  
  const diagnosisCounts = records.reduce((acc, r) => {
    acc[r.diagnosis] = (acc[r.diagnosis] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const diagnosisDist = Object.entries(diagnosisCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const deptCounts: Record<string, number> = {};
  records.forEach(r => {
    const doc = doctors.find(d => d.id === r.doctorId);
    if (doc) {
      const dept = departments.find(dep => dep.id === doc.departmentId);
      if (dept) deptCounts[dept.name] = (deptCounts[dept.name] || 0) + 1;
    }
  });
  const deptDist = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));
  const lowStock = medicines.filter(m => m.stock < 100);
  const recent = [...records].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()).slice(0, 5);
  const vipPatients: Patient[] = [];

  return {
    totalPatients: totalPatients,
    totalVisits: records.length,
    totalDoctors: doctors.length,
    totalMedicines: medicines.length,
    visitsByDepartment: deptDist,
    diagnosisDistribution: diagnosisDist,
    lowStockMedicines: lowStock,
    recentRecords: recent,
    vipPatients: vipPatients
  };
};

export const getPatientDemographics = async (): Promise<PatientDemographics> => {
  const [totalPatients, genderDist, ageDist, records, doctors, departments] = await Promise.all([
      getPatientCount(),
      getPatientGenderStats(), 
      getPatientAgeStats(),
      getRecords(), 
      getDoctors(), 
      getDepartments()
  ]);

  const diagCount = records.reduce((acc, r) => {
      acc[r.diagnosis] = (acc[r.diagnosis] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  const diagDist = Object.entries(diagCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

  const deptCount: Record<string, number> = {};
  records.forEach(r => {
       const doc = doctors.find(d => d.id === r.doctorId);
       if (doc) {
           const dept = departments.find(dp => dp.id === doc.departmentId);
           if (dept) deptCount[dept.name] = (deptCount[dept.name] || 0) + 1;
       }
  });
  const deptDist = Object.entries(deptCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);

  return {
      totalPatients: totalPatients, 
      totalVisits: records.length,
      genderDistribution: genderDist, 
      ageDistribution: ageDist, 
      diagnosisDistribution: diagDist,
      deptVisits: deptDist
  };
};
