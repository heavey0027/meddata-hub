
import { UserRole, UserSession, Patient } from '../types';
import { createPatient, loginUser } from './apiService';
import { addLog } from './logger';

const SESSION_KEY = process.env.REACT_APP_SESSION_KEY;
const DEBUG_KEY = 'meddata_debug_mode';

// 用户登录 
export const login = async (role: UserRole, id: string, password?: string): Promise<UserSession> => {
  try {
      // 直接调用后端 API (该请求不会带 Token)
      const apiResponse = await loginUser(role, id, password || '');
      
      const session: UserSession = {
          id: apiResponse.user.id,
          name: apiResponse.user.name,
          role: apiResponse.user.role,
          // 确保存储 Token
          token: apiResponse.token 
      };
      
      // 持久化会话
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      
      addLog('SUCCESS', 'AUTH', '登录成功', `User: ${session.name} (${session.id})`);
      return session;
  } catch (error: any) {
      addLog('ERROR', 'AUTH', '登录失败', error.message || '未知错误');
      // 直接抛出后端返回的错误信息给 UI 层展示
      throw error;
  }
};

/**
 * 患者注册
 * 移除客户端查重逻辑，依赖后端数据库唯一性约束
 */
export const registerPatient = async (patient: Partial<Patient> & { password?: string }): Promise<Patient> => {
  if (!patient.name || !patient.phone || !patient.password) {
    throw new Error('请填写完整注册信息');
  }

  // 生成 ID (如果后端不自动生成 ID，前端在此生成。通常建议后端生成，此处保留是为了兼容旧逻辑)
  // 注意：不再调用 getPatients() 进行客户端查重，重复检测交由后端 API 返回 409 错误处理
  const newId = `P${Date.now().toString().slice(-4)}`;
  
  const newPatient: Patient = {
    id: newId,
    name: patient.name!,
    password: patient.password, // 实际生产中密码不应明文存储在对象中，这里仅构建请求体
    gender: patient.gender || '男',
    age: patient.age || 18,
    phone: patient.phone!,
    address: patient.address || '未填写',
    createTime: new Date().toISOString().split('T')[0]
  };

  try {
    // 调用 API 创建患者
    await createPatient(newPatient);
    
    addLog('SUCCESS', 'AUTH', '患者注册成功', `New Patient: ${newPatient.name} (${newId})`);
    return newPatient;
  } catch (error: any) {
    addLog('ERROR', 'AUTH', '注册失败', error.message);
    throw error;
  }
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