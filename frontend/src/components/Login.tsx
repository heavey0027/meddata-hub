import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, registerPatient, setDebugMode, isDebugMode } from '../services/authService';
import { UserRole } from '../types';
import { 
  User, Stethoscope, ShieldCheck, Database, Eye, EyeOff, 
  UserPlus, LogIn, MapPin, Lock, Phone, Calendar 
} from 'lucide-react';

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
      window.location.reload(); 
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
      setId(p.id); 
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

  // 根据角色显示不同的提示语
  const getRolePlaceholder = () => {
    if (role === 'admin') return '请输入管理员账号';
    if (role === 'doctor') return '请输入医生工号 (ID)';
    return '请输入患者ID 或 手机号';
  };

  return (
    // 外部容器：设置背景图 + 居中
    <div 
      className="min-h-screen flex items-center justify-center relative bg-gray-900"
      style={{
        backgroundImage: "url('/登陆界面.jpg')", // 假设图片在 public 文件夹下
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* 背景遮罩层：增加黑色半透明和模糊效果，突出前景卡片 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0"></div>

      {/* 登录主卡片 */}
      <div className="relative z-10 max-w-md w-full mx-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-white/20">
        
        {/* Header 区域 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center relative overflow-hidden">
          {/* 装饰性背景圆 */}
          <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3"></div>

          <div className="inline-flex bg-white/20 p-3 rounded-xl mb-4 shadow-inner">
            <Database className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">MedData Hub</h1>
          <p className="text-blue-100 text-xs opacity-90 uppercase tracking-widest">智能医疗综合数据管理平台</p>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          {[
            { id: 'patient', label: '患者', icon: User },
            { id: 'doctor', label: '医生', icon: Stethoscope },
            { id: 'admin', label: '管理员', icon: ShieldCheck }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setRole(item.id as UserRole); setIsRegistering(false); setError(''); }}
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200
                ${role === item.id 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
            >
              <item.icon className={`h-4 w-4 ${role === item.id ? 'animate-pulse' : ''}`} /> 
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded flex items-start gap-2 animate-shake">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {isRegistering ? (
            /* 注册表单 */
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-800">注册新档案</h3>
                <span className="text-xs text-gray-400">仅限患者</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className="relative">
                   <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                   <input 
                     placeholder="真实姓名" required
                     className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                     value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})}
                   />
                 </div>
                 <div className="relative">
                   <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                   <input 
                     placeholder="年龄" type="number" required
                     className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                     value={regForm.age} onChange={e => setRegForm({...regForm, age: e.target.value})}
                   />
                 </div>
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input 
                  placeholder="手机号" required
                  className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input 
                  placeholder="设置密码" type="password" required
                  className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})}
                />
              </div>

              <div className="relative">
                 <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                 <input 
                    placeholder="居住地址" required
                    className="w-full border border-gray-300 pl-9 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})}
                 />
              </div>

              <div className="flex gap-6 items-center bg-gray-50 p-2 rounded-lg justify-center">
                 <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600">
                   <input type="radio" className="accent-blue-600" name="gender" value="男" checked={regForm.gender === '男'} onChange={() => setRegForm({...regForm, gender: '男'})} /> 男
                 </label>
                 <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600">
                   <input type="radio" className="accent-blue-600" name="gender" value="女" checked={regForm.gender === '女'} onChange={() => setRegForm({...regForm, gender: '女'})} /> 女
                 </label>
              </div>

              <button disabled={loading} className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl hover:from-green-600 hover:to-green-700 font-bold shadow-lg shadow-green-200 transition-all active:scale-95">
                {loading ? '注册中...' : '立即注册'}
              </button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-sm text-gray-500 hover:text-blue-600 py-2">
                已有账号？去登录
              </button>
            </form>
          ) : (
            /* 登录表单 */
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                  账号
                </label>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" required
                    className="w-full border border-gray-300 rounded-xl pl-10 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={getRolePlaceholder()}
                    value={id}
                    onChange={e => setId(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">密码</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type={showPass ? "text" : "password"} required
                    className="w-full border border-gray-300 rounded-xl pl-10 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="请输入密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(!showPass)} 
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                  >
                    {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200/50 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
              >
                <LogIn className="h-5 w-5" />
                {loading ? '正在验证...' : '登 录 系 统'}
              </button>
              
              {role === 'patient' && (
                <div className="text-center pt-2">
                  <button type="button" onClick={() => setIsRegistering(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto hover:underline transition-all">
                    <UserPlus className="h-4 w-4" /> 没有账号？点击注册新档案
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Debug Toggle */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
             <input 
               type="checkbox" 
               id="debugMode"
               checked={debug}
               onChange={handleDebugToggle}
               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
             />
             <label htmlFor="debugMode" className="text-xs text-gray-500 select-none cursor-pointer">
               Developer Mode (Debug Logs)
             </label>
          </div>
        </div>
      </div>
    </div>
  );
};