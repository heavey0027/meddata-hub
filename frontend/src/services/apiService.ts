import { Patient, MedicalRecord, Doctor, Department, Medicine, PrescriptionDetail, DashboardStats, PatientDemographics, Appointment, UserRole, MonthlyStats, MultimodalData } from '../types';
import { addLog } from './logger';

// 配置后端 API 地址。
const API_BASE_URL = '/api';
const SESSION_KEY = process.env.REACT_APP_SESSION_KEY;

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
export const invalidateCache = (keyPattern: string) => {
  // No-op
};

// --- API Helpers ---

// 获取 JWT Auth Headers
const getAuthHeaders = (): Record<string, string> => {
  try {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return {};
    const session = JSON.parse(sessionStr);
    return session.token ? { 'Authorization': `Bearer ${session.token}` } : {};
  } catch (e) {
    return {};
  }
};

async function fetchFromApi<T>(endpoint: string): Promise<T> {
  // Use timestamp to prevent browser 304 caching
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${API_BASE_URL}${endpoint}${separator}_t=${Date.now()}`; 
  
  addLog('INFO', 'API_REQUEST', 'GET 请求发起', `Target: ${endpoint}`, {
    method: 'GET',
    requestUrl: url
  });
  
  try {
    const controller = new AbortController();
    // 增加超时时间，避免真实网络环境下过早中断
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        ...getAuthHeaders(), // 注入 JWT
        'Content-Type': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        addLog('ERROR', 'AUTH', 'Token失效或未登录', endpoint);
        // 可选：在这里触发登出逻辑
      }
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    addLog('SUCCESS', 'API_RESPONSE', '请求成功', `Endpoint: ${endpoint}`, {
      statusCode: response.status,
      dataSize: JSON.stringify(data).length
    });
    
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown';
    addLog('ERROR', 'API_FAIL', 'API 请求失败', `Endpoint: ${endpoint}`, {
      error: errorMsg
    });
    throw error; 
  }
};

// Login API Call (不需要 Auth Header)
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
    addLog('ERROR', 'AUTH', '登录请求异常', '', {
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
      headers: { ...getAuthHeaders() }, // Health check 也带上 Token
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
  // API Request Construction
  let endpoint = '/patients';
  const params: string[] = [];
  if (limit !== undefined) params.push(`limit=${limit}`);
  if (offset !== undefined) params.push(`offset=${offset}`);
  
  if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
  }

  return fetchFromApi<Patient[]>(endpoint);
};

// Optimize for total count retrieval
export const getPatientCount = async (): Promise<number> => {
  const response = await fetchFromApi<any>('/patients/count');
  return typeof response === 'number' ? response : (response.total_patients ?? response.count ?? 0);
};

// Fetch Patient Gender Ratio stats
const getPatientGenderStats = async (): Promise<{name: string, value: number}[]> => {
    const data = await fetchFromApi<any>('/patients/gender_ratio');
    return [
        { name: '男', value: data.male || 0 },
        { name: '女', value: data.female || 0 },
        { name: '未知性别', value: data.other || 0 }
    ];
};

// Fetch Patient Age Ratio stats
const getPatientAgeStats = async (): Promise<{name: string, value: number}[]> => {
    const data = await fetchFromApi<any>('/patients/age_ratio');
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
  
  const url = `${API_BASE_URL}/patients?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 新增患者', `ID: ${patient.id}`, { url, body: patient });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders() 
      },
      body: JSON.stringify(patient)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '创建失败');
    
    addLog('SUCCESS', 'API_RESPONSE', '患者创建成功 (DB)');
  } catch (e: any) {
    addLog('ERROR', 'API_FAIL', '创建患者失败', e.message);
    throw e;
  }
};

// 2. Update Patient (PUT /api/patients/<id>)
export const updatePatient = async (patient: Patient) => {
  const url = `${API_BASE_URL}/patients/${patient.id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'PUT 更新患者', `ID: ${patient.id}`, { url, body: patient });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(patient)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '更新失败');
    
    addLog('SUCCESS', 'API_RESPONSE', '患者更新成功 (DB)');
  } catch (e: any) { 
    addLog('ERROR', 'API_FAIL', '更新患者失败', e.message);
    throw e; 
  }
};

export const deletePatient = async (id: string) => {
  const url = `${API_BASE_URL}/patients/${id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'DELETE 删除患者', `ID: ${id}`, { url });

  try {
    const response = await fetch(url, { 
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
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
  let endpoint = '/records';
  if (patientId) {
      endpoint += `?patient_id=${patientId}`;
  }
  return fetchFromApi<MedicalRecord[]>(endpoint);
};

export const deleteMedicalRecord = async (id: string) => {
  const url = `${API_BASE_URL}/records/${id}?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'DELETE 删除病历', `ID: ${id}`, { url });

  try {
    const response = await fetch(url, { 
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
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
  return fetchFromApi<Doctor[]>('/doctors');
};

export const getDoctorById = async (id: string): Promise<Doctor | undefined> => {
    // Call /api/doctors/<doctor_id>
    try {
        return await fetchFromApi<Doctor>(`/doctors/${id}`);
    } catch (e) {
        return undefined;
    }
};

export const updateDoctor = async (id: string, data: Partial<Doctor>) => {
    const url = `${API_BASE_URL}/doctors/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新医生信息', `ID: ${id}`, { url, body: data });
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.message || '更新失败');
        
        addLog('SUCCESS', 'API_RESPONSE', '医生更新成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '更新医生失败', e.message);
        throw e;
    }
};

export const deleteDoctor = async (id: string) => {
    const url = `${API_BASE_URL}/doctors/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除医生', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { 
          method: 'DELETE',
          headers: { ...getAuthHeaders() }
        });
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
  return fetchFromApi<Department[]>('/departments');
};

export const getDepartmentById = async (id: string): Promise<Department | undefined> => {
    try {
        return await fetchFromApi<Department>(`/departments/${id}`);
    } catch (e) {
        return undefined;
    }
};

export const deleteDepartment = async (id: string) => {
    const url = `${API_BASE_URL}/departments/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除科室', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { 
          method: 'DELETE',
          headers: { ...getAuthHeaders() }
        });
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
  return fetchFromApi<Medicine[]>('/medicines');
};

export const getMedicineById = async (id: string): Promise<Medicine | undefined> => {
    try {
        return await fetchFromApi<Medicine>(`/medicines/${id}`);
    } catch (e) {
        return undefined;
    }
};

export const updateMedicine = async (id: string, data: Partial<Medicine>) => {
    const url = `${API_BASE_URL}/medicines/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新药品信息', `ID: ${id}`, { url, body: data });

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.message || '更新失败');

        addLog('SUCCESS', 'API_RESPONSE', '药品更新成功');
    } catch(e: any) {
        addLog('ERROR', 'API_FAIL', '更新药品失败', e.message);
        throw e;
    }
};

export const deleteMedicine = async (id: string) => {
    const url = `${API_BASE_URL}/medicines/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除药品', `ID: ${id}`, { url });
    try {
        const response = await fetch(url, { 
          method: 'DELETE',
          headers: { ...getAuthHeaders() }
        });
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

// --- Multimodal Data CRUD ---

export const getMultimodalData = async (): Promise<MultimodalData[]> => {
    return fetchFromApi<MultimodalData[]>('/multimodal');
};

export const createMultimodalData = async (formData: FormData) => {
    // Real API Call Only
    const url = `${API_BASE_URL}/multimodal?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'POST 多模态数据上传', `Patient: ${formData.get('patientId')}`, { modality: formData.get('modality') });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...getAuthHeaders() // 注意：这里不要设置 Content-Type，浏览器会自动处理 multipart/form-data boundary
            },
            body: formData 
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '上传失败');
        
        addLog('SUCCESS', 'API_RESPONSE', '多模态数据上传成功');
    } catch (e: any) {
        addLog('ERROR', 'API_FAIL', '多模态数据上传失败', e.message);
        throw e;
    }
};

export const deleteMultimodalData = async (id: string) => {
    const url = `${API_BASE_URL}/multimodal/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'DELETE 删除多模态数据', `ID: ${id}`, { url });

    try {
        const response = await fetch(url, { 
          method: 'DELETE',
          headers: { ...getAuthHeaders() }
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || '删除失败');
        }
        addLog('SUCCESS', 'API_RESPONSE', '多模态数据删除成功');
    } catch (e: any) {
        addLog('ERROR', 'API_FAIL', '删除失败', e.message);
        throw e;
    }
};

export const getFileUrl = (item: MultimodalData) => {
  const { filePath, id } = item;
  if (!filePath) return '';
  
  if (filePath.startsWith('blob:') || filePath.startsWith('http')) {
      return filePath;
  }
  
  // 仅返回 API 路径，不带 Token
  return `${API_BASE_URL}/multimodal/file/${id}?_t=${Date.now()}`;
};

export const fetchFileBlob = async (url: string): Promise<Blob> => {
  // 复用之前的 getAuthHeaders 函数
  const headers = getAuthHeaders(); 
  
  const response = await fetch(url, {
      method: 'GET',
      headers: {
          ...headers 
          // 注意：不需要 Content-Type，因为是下载
      }
  });

  if (!response.ok) {
      throw new Error(`文件下载失败: ${response.status} ${response.statusText}`);
  }

  return await response.blob();
};
export const getPrescriptionDetails = async (recordId?: string): Promise<PrescriptionDetail[]> => {
  let endpoint = '/prescription_details';
  if (recordId) {
      endpoint += `?record_id=${recordId}`;
  }
  return fetchFromApi<PrescriptionDetail[]>(endpoint);
};

// 3. Create Medical Record (POST /api/records)
export const saveMedicalRecord = async (record: MedicalRecord, details: PrescriptionDetail[]) => {
  if (!record.visitDate) {
      record.visitDate = getLocalDate();
  }

  if (!record.id || !record.patientId || !record.doctorId || !record.diagnosis || !record.treatmentPlan) {
      addLog('WARNING', 'API_REQUEST', '病历字段缺失', '未发送请求', { record });
      throw new Error("病历信息不完整");
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(backendPayload)
    });
    const data = await response.json();
    if(!response.ok) throw new Error(data.message || '病历提交失败');
    
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
  return fetchFromApi<Appointment[]>(endpoint);
};

// 5. Create Appointment (POST /api/appointments)
export const createAppointment = async (appointment: Appointment) => {
  appointment.createTime = getLocalDatetime();

  const backendPayload = { ...appointment, status: 'pending' };
  const url = `${API_BASE_URL}/appointments?_t=${Date.now()}`;
  addLog('INFO', 'API_REQUEST', 'POST 挂号', `Patient: ${appointment.patientName}`, { url, body: backendPayload });

  try {
     const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(backendPayload)
     });
     const data = await response.json();
     if (!response.ok) throw new Error(data.message || '挂号失败');
     
     addLog('SUCCESS', 'API_RESPONSE', '挂号成功 (DB)');
  } catch(e: any) {
     addLog('ERROR', 'API_FAIL', '挂号失败', e.message);
     throw e; 
  }
};

// 6. Update Appointment Status (PUT /api/appointments/<id>)
export const updateAppointmentStatus = async (id: string, status: 'completed' | 'cancelled') => {
    const url = `${API_BASE_URL}/appointments/${id}?_t=${Date.now()}`;
    addLog('INFO', 'API_REQUEST', 'PUT 更新挂号状态', `ID: ${id}`, { url, status });

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
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
  let queryString = `role=admin`;
  if (date) queryString += `&date=${date}`;
  const endpoint = `/appointments/statistics?${queryString}`;
  return fetchFromApi(endpoint);
};

// 8. Get Sankey Data for Flow Analysis
export const getSankeyData = async () => {
  return fetchFromApi<any>('/stats/sankey');
};

/**
 * 9. Get Monthly Statistics
 * Requirement: The 'month' parameter is MANDATORY.
 * Endpoint: GET /api/statistics/monthly?month=YYYY-MM
 */
export const getMonthlyStatistics = async (month: string): Promise<MonthlyStats> => {
  if (!month) throw new Error("Month parameter is required (Format: YYYY-MM)");
  return fetchFromApi<MonthlyStats>(`/statistics/monthly?month=${month}`);
};

// --- Logic Helpers ---

export const findPatientByQuery = async (query: string | undefined | null): Promise<Patient | undefined> => {
  if (!query) return undefined;
  const q = String(query).trim();
  if (!q) return undefined;
  
  const endpoint = `/patients?query=${encodeURIComponent(q)}`;
  const patients = await fetchFromApi<Patient[]>(endpoint);
  
  // 简单的客户端过滤，虽然 API 应该处理这个，但为了保证精确匹配
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

// 注意：此函数现在完全依赖 API 返回的数据进行客户端聚合
// 如果数据量过大，建议将这些统计逻辑移至后端 /stats/dashboard 接口
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
  const vipPatients: Patient[] = []; // 需要后端支持VIP筛选，暂空

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