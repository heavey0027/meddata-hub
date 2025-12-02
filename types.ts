
export interface Department {
  id: string; // 科室ID
  name: string; // 科室名称
  location: string; // 位置
}

export interface Doctor {
  id: string; // 医生ID
  name: string; // 姓名
  password?: string; // 登录密码
  departmentId: string; // 科室ID (FK)
  specialty: string; // 专业方向
  phone: string; // 电话
  title: string; // 职称
  pendingCount?: number; // Added: 当前候诊人数 (Queue size)
}

export interface Medicine {
  id: string; // 药品ID
  name: string; // 药品名称
  price: number; // 价格
  stock: number; // 库存数量
  specification: string; // 规格
}

export interface Patient {
  id: string; // 患者ID
  name: string; // 姓名
  password?: string; // 登录密码
  gender: '男' | '女'; // 性别
  age: number; // 年龄
  phone: string; // 电话
  address: string; // 地址
  createTime: string; // 创建时间
  isVip?: boolean; // Added: 是否挂过所有科室的号
}

export interface MedicalRecord {
  id: string; // 病历ID
  patientId: string; // 患者ID (FK)
  patientName: string; // Snapshot for display
  doctorId: string; // 医生ID (FK)
  doctorName: string; // Snapshot for display
  diagnosis: string; // 诊断结果
  treatmentPlan: string; // 治疗方案
  visitDate: string; // 就诊时间
}

export interface PrescriptionDetail {
  id: string; // 处方明细ID
  recordId: string; // 病历ID (FK)
  medicineId: string; // 药品ID (FK)
  dosage: string; // 用量
  usage: string; // 用法
  days: number; // 天数
}

export interface Appointment {
  id: string;
  patientId?: string; // Added: Link to patient table
  patientName: string;
  patientPhone: string;
  gender: '男' | '女';
  age: number;
  departmentId: string;
  departmentName: string;
  doctorId?: string; // Optional (if picking specific doctor)
  doctorName?: string;
  description: string; // 病情描述
  status: 'pending' | 'completed' | 'cancelled';
  createTime: string;
}

export interface MedicalImage {
  id: string;
  patientId: string;
  url: string; 
  modality: 'X光' | 'MRI' | 'CT' | '超声';
  aiAnalysis?: string;
  date: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalVisits: number;
  totalDoctors: number;
  totalMedicines: number;
  visitsByDepartment: { name: string; value: number }[];
  diagnosisDistribution: { name: string; value: number }[];
  lowStockMedicines: Medicine[];
  recentRecords: MedicalRecord[];
  vipPatients: Patient[]; // Added: For dashboard display
}

export interface PatientDemographics {
  totalPatients: number;
  totalVisits: number;
  genderDistribution: { name: string; value: number }[];
  ageDistribution: { name: string; value: number }[];
  diagnosisDistribution: { name: string; value: number }[];
  deptVisits: { name: string; value: number }[];
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  module: string;
  action: string;
  details?: string;
  metadata?: any; // Stores structured data like request body, response json, etc.
}

export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'doubao' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // Optional for custom/proxy
  modelName: string;
}

// --- AUTH TYPES ---
export type UserRole = 'patient' | 'doctor' | 'admin';

export interface UserSession {
  id: string;
  name: string;
  role: UserRole;
  token?: string; // For future real backend use
}