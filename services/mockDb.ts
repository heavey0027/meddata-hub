
import { Patient, MedicalRecord, Doctor, Department, Medicine, PrescriptionDetail, DashboardStats, PatientDemographics, Appointment, UserRole } from '../types';
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
  if (limit !== undefined && offset !== undefined) {
      fallback = allPatients.slice(offset, offset + limit);
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

// 1. Create Patient (POST /api/patients)
export const createPatient = async (patient: Patient) => {
  // Ensure createTime is set to current browser date
  patient.createTime = getLocalDate();

  // Local persistence for fallback
  const current = await getPatients(); // gets all if no params
  localStorage.setItem('meddata_patients', JSON.stringify([...current, patient]));
  
  const url = `${API_BASE_URL}/patients?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 新增患者', `ID: ${patient.id}`, { url, body: patient });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });

     const data = await response.json(); // 解析后端返回的数据

    if (!response.ok) {
      // 关键：抛出后端返回的 message (例如 "ID已存在", "服务器内部错误")
      throw new Error(data.message || '创建失败');
    }

    // 只有后端成功了，才更新本地 Mock 数据以保持一致
    const current = await getPatients();
    localStorage.setItem('meddata_patients', JSON.stringify([...current, patient]));
    
    addLog('SUCCESS', 'API_RESPONSE', '患者创建成功 (DB)');
  } catch (e: any) {
    addLog('ERROR', 'API_FAIL', '创建患者失败', e.message);
    throw e; // 继续向上抛出，让 UI 层捕获
  }
};

// 2. Update Patient (PUT /api/patients/<id>)
export const updatePatient = async (patient: Patient) => {
  // Local persistence
  const current = await getPatients();
  const updated = current.map(p => p.id === patient.id ? patient : p);
  localStorage.setItem('meddata_patients', JSON.stringify(updated));

  // Backend: PUT with ID in URL
  const url = `${API_BASE_URL}/patients/${patient.id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'PUT 更新患者', `ID: ${patient.id}`, { url, body: patient });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '更新失败');
    }

    // 后端成功后，更新本地
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
  // Local persistence
  const current = await getPatients();
  const updated = current.filter(p => p.id !== id);
  localStorage.setItem('meddata_patients', JSON.stringify(updated));

  // Backend: DELETE with ID in URL
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

export const getDoctors = async (): Promise<Doctor[]> => {
  return fetchWithFallback('/doctors', mockDoctors);
};

export const getDepartments = async (): Promise<Department[]> => {
  return fetchWithFallback('/departments', mockDepartments);
};

export const getMedicines = async (): Promise<Medicine[]> => {
  return fetchWithFallback('/medicines', mockMedicines);
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
  // Ensure visitDate is set to current browser date if missing
  if (!record.visitDate) {
      record.visitDate = getLocalDate();
  }

  // Mock Persistence
  const currentRecords = await getRecords();
  localStorage.setItem('meddata_records', JSON.stringify([...currentRecords, record]));
  const currentDetails = await getPrescriptionDetails();
  localStorage.setItem('meddata_prescriptions', JSON.stringify([...currentDetails, ...details]));
  
  // Validate
  if (!record.id || !record.patientId || !record.doctorId || !record.diagnosis || !record.treatmentPlan) {
      addLog('WARNING', 'API_REQUEST', '病历字段缺失', '未发送请求', { record });
      return;
  }

  // Convert to camelCase payload (as required by backend record_data.get('patientId'))
  const backendPayload = {
      record: {
          id: record.id,
          patientId: record.patientId,
          doctorId: record.doctorId,
          diagnosis: record.diagnosis,
          treatmentPlan: record.treatmentPlan,
          visitDate: record.visitDate // Uses local date from browser
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

    if(!response.ok) {
        // 关键：这里会捕获 "药品ID xxx 库存不足", "数据插入失败"
        throw new Error(data.message || '病历提交失败');
    }

    // 后端成功后，更新本地
    const currentRecords = await getRecords();
    localStorage.setItem('meddata_records', JSON.stringify([...currentRecords, record]));
    // ...略...
    
    addLog('SUCCESS', 'API_RESPONSE', '病历提交成功 (DB)');
  } catch (e: any) { 
    addLog('ERROR', 'API_FAIL', '病历提交异常', e.message);
    throw e; // 必须抛出，否则 UI 会以为保存成功并关闭弹窗
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

  // Mock Logic:
  if (doctorId) {
    const doctors = await getDoctors();
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      fallback = fallback.filter((a: Appointment) => a.departmentId === doc.departmentId);
    }
  }

  // Filter by Patient ID for "My Appointments"
  if (patientId) {
    fallback = fallback.filter((a: Appointment) => a.patientId === patientId);
  }

  if (specificDate) {
      fallback = fallback.filter((a: Appointment) => a.createTime.startsWith(specificDate));
  }

  // API Logic: Build query params
  let params = [];
  if (doctorId) params.push(`doctor_id=${doctorId}`);
  if (patientId) params.push(`patient_id=${patientId}`);
  
  // If Admin is querying for dashboard, pass role and date
  if (queryRole === 'admin') {
      params.push(`role=admin`);
      // Update: Make date optional for admin to allow full history fetching
      if (specificDate) {
          params.push(`date=${specificDate}`);
      }
  } else {
      // For doctor/patient view, pass date if provided
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
  
  // Backend expects camelCase payload. 
  // It includes all required fields like patientId, createTime, etc.
  const backendPayload = {
      ...appointment,
      status: 'pending',
  };

  const url = `${API_BASE_URL}/appointments?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 挂号', `Patient: ${appointment.patientName}`, { url, body: backendPayload });

  try {
     const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
     });
     const data = await response.json();

     if (!response.ok) {
        // 关键：捕获 "挂号重复", "科室无医生排班"
        throw new Error(data.message || '挂号失败');
     }
     
     // 后端成功后，更新本地
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

        if (!response.ok) {
            throw new Error(data.message || '更新状态失败');
        }

        addLog('SUCCESS', 'API_RESPONSE', '状态更新成功 (DB)');
    } catch (e: any) {
        addLog('ERROR', 'API_FAIL', '更新挂号状态失败', e.message);
        throw e;
    }
};

// 7. Get Appointment Statistics (Hourly Trend)
export const getAppointmentStatistics = async (date?: string): Promise<{ hour: number; count: number }[]> => {
  // 1. Mock Mode Fallback Logic (Client-side aggregation)
  const mockFallback = async () => {
    // Determine scope based on date string length
    // If no date, use a large multiplier to simulate all-time
    const scopeMultiplier = !date ? 50 : (date.length === 4 ? 20 : (date.length === 7 ? 5 : 1));
    
    // Simulate API response structure [ { hour: 0, count: 5 }, ... ]
    // Generate a bell curve peaking at 9am and 2pm
    const trend = Array.from({ length: 24 }, (_, i) => {
        let base = 0;
        if (i >= 8 && i <= 11) base = Math.floor(Math.random() * 10) + 5; // Morning peak
        if (i >= 13 && i <= 16) base = Math.floor(Math.random() * 8) + 4; // Afternoon peak
        if (i < 8 || i > 18) base = Math.floor(Math.random() * 2); // Off hours
        return { hour: i, count: base * scopeMultiplier };
    });
    return trend;
  };

  // 2. API Call
  let queryString = `role=admin`;
  if (date) {
      queryString += `&date=${date}`;
  }
  const endpoint = `/appointments/statistics?${queryString}`;

  // Using fetchWithFallback but passing the generated mock as fallback
  const fallbackData = await mockFallback();
  
  return fetchWithFallback(endpoint, fallbackData);
};

// --- Logic Helpers ---

export const findPatientByQuery = async (query: string | undefined | null): Promise<Patient | undefined> => {
  if (!query) return undefined;
  const q = String(query).trim();
  if (!q) return undefined;
  
  // Prepare fallback from local data
  const local = localStorage.getItem('meddata_patients');
  const allPatients = local ? JSON.parse(local) : mockPatients;
  
  // Local find logic (Fallback)
  const localMatch = allPatients.find((p: Patient) => 
    p.id.toLowerCase() === q.toLowerCase() || 
    p.phone === q || 
    p.name === q
  );
  
  // Construct URL with query param to let backend filter
  // Using generic 'query' param to match the function name intent.
  // This allows the backend to efficiently lookup the patient by ID, phone, or name without returning the full list.
  const endpoint = `/patients?query=${encodeURIComponent(q)}`;
  
  // Fetch specific match from backend using query param
  const patients = await fetchWithFallback<Patient[]>(endpoint, localMatch ? [localMatch] : []);
  
  // Return the best match from the returned list
  return patients.find(p => p.id.toLowerCase() === q.toLowerCase() || p.phone === q) || patients[0];
};

// STRICT: Only get existing patients. NEVER create.
export const getExistingPatient = async (appointment: Appointment): Promise<Patient> => {
    if (!appointment) {
      throw new Error("挂号单数据无效");
    }

    // 1. Try to find by ID if available (Best practice)
    if (appointment.patientId) {
        // Use optimized findPatientByQuery to hit backend with query param
        const existing = await findPatientByQuery(appointment.patientId);
        if (existing) {
             addLog('INFO', 'PATIENT_LOOKUP', '患者已存在 (ID Match)', existing.id);
             return existing;
        }
    }

    // 2. Try to find by Phone
    if (appointment.patientPhone) {
        const existingByPhone = await findPatientByQuery(appointment.patientPhone);
        if (existingByPhone) {
            addLog('INFO', 'PATIENT_LOOKUP', '患者已存在 (Phone Match)', existingByPhone.id);
            return existingByPhone;
        }
    }

    // 3. Not Found -> Throw Error
    addLog('ERROR', 'PATIENT_LOOKUP', '未找到患者档案', `挂号信息: ${appointment.patientName} ${appointment.patientPhone}`);
    throw new Error(`未找到患者档案！请确认该患者是否已注册。 (姓名: ${appointment.patientName}, 电话: ${appointment.patientPhone})`);
};

export const getFullPatientDetails = async (patientId: string) => {
  // 1. Fetch Records filtered by Patient ID
  const records = await getRecords(patientId);
  const medicines = await getMedicines();

  records.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

  // 2. Fetch details for each record (N+1 requests, as requested to use record_id)
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
  const [patients, records, doctors, departments, medicines] = await Promise.all([
    getPatients(), getRecords(), getDoctors(), getDepartments(), getMedicines()
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
  
  // Calculate VIP Patients (Mock logic: In a real app this might come from backend, 
  // but for mock/demo we use the field we added to mockPatients)
  const vipPatients = patients.filter(p => p.isVip);

  return {
    totalPatients: patients.length,
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
  const [patients, records, doctors, departments] = await Promise.all([
      getPatients(), getRecords(), getDoctors(), getDepartments()
  ]);

  const genderCount = patients.reduce((acc, p) => {
      acc[p.gender] = (acc[p.gender] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  const genderDist = Object.entries(genderCount).map(([name, value]) => ({ name, value }));

  const ageGroups = { '0-18岁 (青少年)': 0, '19-35岁 (青年)': 0, '36-60岁 (中年)': 0, '60岁以上 (老年)': 0 };
  patients.forEach(p => {
      if (p.age <= 18) ageGroups['0-18岁 (青少年)']++;
      else if (p.age <= 35) ageGroups['19-35岁 (青年)']++;
      else if (p.age <= 60) ageGroups['36-60岁 (中年)']++;
      else ageGroups['60岁以上 (老年)']++;
  });
  const ageDist = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

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
      totalPatients: patients.length,
      totalVisits: records.length,
      genderDistribution: genderDist,
      ageDistribution: ageDist,
      diagnosisDistribution: diagDist,
      deptVisits: deptDist
  };
};
