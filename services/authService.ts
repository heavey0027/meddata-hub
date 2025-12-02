
import { UserRole, UserSession, Patient, Doctor } from '../types';
import { getPatients, getDoctors, createPatient, loginUser } from './mockDb';
import { addLog } from './logger';

const SESSION_KEY = 'meddata_user_session';
const DEBUG_KEY = 'meddata_debug_mode';

// Helper: Get users by role (Mock Fallback)
const findUserMock = async (role: UserRole, id: string): Promise<Patient | Doctor | null> => {
  if (role === 'patient') {
    const patients = await getPatients();
    return patients.find(p => p.id === id) || null;
  } else if (role === 'doctor') {
    const doctors = await getDoctors();
    return doctors.find(d => d.id === id) || null;
  }
  return null;
};

export const login = async (role: UserRole, id: string, password?: string): Promise<UserSession> => {
  // 1. Try Backend API First
  try {
      const apiResponse = await loginUser(role, id, password || '');
      const session: UserSession = {
          id: apiResponse.user.id,
          name: apiResponse.user.name,
          role: apiResponse.user.role,
          token: apiResponse.token
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
  } catch (error: any) {
      if (error.message === '用户名或密码错误' || error.message.includes('错误')) {
          throw error;
      }
      console.warn("Backend Login Failed/Offline, falling back to Mock Data validation.");
  }

  // 2. Mock Fallback Logic
  if (role === 'admin') {
    if (id === 'admin' && password === 'admin123') {
      const session: UserSession = { id: 'admin', name: '系统管理员', role: 'admin' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      addLog('SUCCESS', 'AUTH', '管理员登录成功 (Mock)', 'Session Started');
      return session;
    }
    throw new Error('管理员账号或密码错误 (默认 admin/admin123)');
  }

  const user = await findUserMock(role, id);
  if (!user) throw new Error('用户不存在，请检查ID');

  const storedPass = (user as any).password || 'password'; 
  if (password !== storedPass) throw new Error('密码错误');

  const session: UserSession = { id: user.id, name: user.name, role: role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  addLog('SUCCESS', 'AUTH', `${role === 'doctor' ? '医生' : '患者'}登录成功 (Mock)`, `User: ${user.name} (${user.id})`);
  return session;
};

export const registerPatient = async (patient: Partial<Patient> & { password?: string }): Promise<Patient> => {
  if (!patient.name || !patient.phone || !patient.password) {
    throw new Error('请填写完整注册信息');
  }

  const patients = await getPatients();
  if (patients.some(p => p.phone === patient.phone)) {
    throw new Error('该手机号已被注册');
  }

  const newId = `P${Date.now().toString().slice(-4)}`;
  const newPatient: Patient = {
    id: newId,
    name: patient.name!,
    password: patient.password,
    gender: patient.gender || '男',
    age: patient.age || 18,
    phone: patient.phone!,
    address: patient.address || '未填写',
    createTime: new Date().toISOString().split('T')[0]
  };

  // Use the new createPatient method to ensure POST /api/patients
  await createPatient(newPatient);
  
  addLog('SUCCESS', 'AUTH', '患者注册成功', `New Patient: ${newPatient.name} (${newId})`);
  return newPatient;
};

export const logout = () => {
  const session = getCurrentUser();
  if (session) {
      addLog('INFO', 'AUTH', '用户登出', `User: ${session.name}`);
  }
  localStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): UserSession | null => {
  try {
    const json = localStorage.getItem(SESSION_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
};

export const setDebugMode = (enabled: boolean) => {
  localStorage.setItem(DEBUG_KEY, String(enabled));
};

export const isDebugMode = (): boolean => {
  return localStorage.getItem(DEBUG_KEY) === 'true';
};
