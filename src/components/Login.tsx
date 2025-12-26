
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, registerPatient, setDebugMode, isDebugMode } from '../services/authService';
import { UserRole } from '../types';
import { User, Stethoscope, ShieldCheck, Database, Eye, EyeOff, UserPlus, LogIn, MapPin } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('patient');
  const [isRegistering, setIsRegistering] = useState(false);
  const [debug, setDebug] = useState(isDebugMode());
  
  // Login State
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  // Register State
  const [regForm, setRegForm] = useState({
    name: '', phone: '', password: '', age: '', gender: '男', address: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(role, id, password);
      // Redirect based on role
      if (role === 'patient') navigate('/appointment');
      else if (role === 'doctor') navigate('/consultation');
      else navigate('/');
      window.location.reload(); // Force app re-render to update sidebar
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const p = await registerPatient({
        name: regForm.name,
        phone: regForm.phone,
        password: regForm.password,
        age: parseInt(regForm.age),
        gender: regForm.gender as any,
        address: regForm.address
      });
      alert(`注册成功！您的ID是: ${p.id}，请使用此ID登录。`);
      setIsRegistering(false);
      setId(p.id); // Auto fill ID
      setPassword(''); 
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDebug(e.target.checked);
    setDebugMode(e.target.checked);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-blue-600 p-8 text-center">
          <div className="inline-flex bg-white/20 p-4 rounded-full mb-4">
            <Database className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MedData Hub</h1>
          <p className="text-blue-100 text-sm">智能医疗综合数据管理平台</p>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => { setRole('patient'); setIsRegistering(false); setError(''); }}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${role === 'patient' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <User className="h-4 w-4" /> 患者
          </button>
          <button 
            onClick={() => { setRole('doctor'); setIsRegistering(false); setError(''); }}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${role === 'doctor' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Stethoscope className="h-4 w-4" /> 医生
          </button>
          <button 
            onClick={() => { setRole('admin'); setIsRegistering(false); setError(''); }}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${role === 'admin' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <ShieldCheck className="h-4 w-4" /> 管理员
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">新患者注册</h3>
              <div className="grid grid-cols-2 gap-3">
                 <input 
                   placeholder="真实姓名" required
                   className="border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                   value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})}
                 />
                 <input 
                   placeholder="年龄" type="number" required
                   className="border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                   value={regForm.age} onChange={e => setRegForm({...regForm, age: e.target.value})}
                 />
              </div>
              <input 
                placeholder="手机号 (将作为联系方式)" required
                className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})}
              />
              <input 
                placeholder="设置密码" type="password" required
                className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})}
              />
              <div className="relative">
                 <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                 <input 
                    placeholder="居住地址" required
                    className="w-full border p-2 pl-9 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})}
                 />
              </div>
              <div className="flex gap-4 items-center">
                 <label className="flex items-center gap-2 text-sm text-gray-600">
                   <input type="radio" name="gender" value="男" checked={regForm.gender === '男'} onChange={() => setRegForm({...regForm, gender: '男'})} /> 男
                 </label>
                 <label className="flex items-center gap-2 text-sm text-gray-600">
                   <input type="radio" name="gender" value="女" checked={regForm.gender === '女'} onChange={() => setRegForm({...regForm, gender: '女'})} /> 女
                 </label>
              </div>
              <button disabled={loading} className="w-full bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 font-bold transition-colors">
                {loading ? '注册中...' : '立即注册'}
              </button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-sm text-gray-500 hover:text-blue-600 mt-2">
                已有账号？去登录
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {role === 'admin' ? '管理员账号' : role === 'doctor' ? '医生工号 (ID)' : '患者ID / 手机号'}
                </label>
                <input 
                  type="text" required
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder={role === 'admin' ? 'admin' : role === 'doctor' ? 'DOC...' : 'P...'}
                  value={id}
                  onChange={e => setId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <div className="relative">
                  <input 
                    type={showPass ? "text" : "password"} required
                    className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="请输入密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <LogIn className="h-5 w-5" />
                {loading ? '登录中...' : '登 录'}
              </button>
              
              {role === 'patient' && (
                <div className="text-center pt-2">
                  <button type="button" onClick={() => setIsRegistering(true)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                    <UserPlus className="h-4 w-4" /> 没有账号？注册新档案
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Debug Toggle */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2">
             <input 
               type="checkbox" 
               id="debugMode"
               checked={debug}
               onChange={handleDebugToggle}
               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
             />
             <label htmlFor="debugMode" className="text-xs text-gray-500 select-none cursor-pointer">
               启用 Debug 模式 (显示系统日志)
             </label>
          </div>
        </div>
      </div>
    </div>
  );
};
