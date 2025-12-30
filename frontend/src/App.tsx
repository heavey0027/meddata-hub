import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileImage, MessageSquareText, Menu, X, Database, Layers, PieChart as PieChartIcon, ScrollText, CalendarPlus, History, UserCheck, LogOut, Clock, Calendar, DatabaseZap, AlertTriangle } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { PatientList } from './components/PatientList';
import { RadiologyAI } from './components/RadiologyAI';
import { AskAI } from './components/AskAI';
import { Resources } from './components/Resources';
import { PatientStats } from './components/PatientStats';
import { SystemLogs } from './components/SystemLogs';
import { AppointmentHall } from './components/AppointmentHall';
import { PatientHistory } from './components/PatientHistory';
import { DoctorConsultation } from './components/DoctorConsultation';
import { MyAppointments } from './components/MyAppointments';
import { MultimodalManager } from './components/MultimodalManager';
import { Login } from './components/Login';
import { checkBackendHealth } from './services/apiService';
import { addLog } from './services/logger';
import { getCurrentUser, logout, isDebugMode } from './services/authService';
import { UserRole } from './types';

const SESSION_KEY = process.env.REACT_APP_SESSION_KEY;

// --- 新增：全局 401 弹窗组件 ---
const GlobalAuthModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleAuthExpired = () => {
      // 只有当前不在登录页时才弹窗，避免死循环
      if (!window.location.hash.includes('/login')) {
        setIsOpen(true);
      }
    };

    window.addEventListener('auth-session-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-session-expired', handleAuthExpired);
  }, []);

  const handleConfirm = () => {
    // 1. 清理本地存储
    logout();
    // 2. 关闭弹窗
    setIsOpen(false);
    // 3. 强制重定向到登录页
    window.location.href = '#/login';
    //刷新页面以确保状态完全重置
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">会话已过期</h3>
          <p className="text-gray-500 mb-6 text-sm">
            您的登录状态已失效（Token 过期或未登录）。<br/>为了您的账户安全，请重新登录。
          </p>
          <button 
            onClick={handleConfirm}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            确定并跳转登录
          </button>
        </div>
      </div>
    </div>
  );
};

const SidebarLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap
      ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}
    `}
  >
    <div className="flex-shrink-0">{icon}</div>
    <span className="font-medium">{label}</span>
  </NavLink>
);

// Route Guard
const RequireAuth = ({ children, roles }: { children: React.ReactNode, roles?: UserRole[] }) => {
  const user = getCurrentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const SystemClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 font-mono text-sm hidden sm:flex">
      <Clock className="h-4 w-4 text-blue-500" />
      <span>{time.toLocaleString('zh-CN', { hour12: false })}</span>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  
  // 修改：移除 'mock' 状态，严格区分连接成功与错误
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  const user = getCurrentUser();
  const debug = isDebugMode();
  const location = useLocation();

  useEffect(() => {
    // 修改：检测到有 token (JWT) 后再检查后端健康状态
    const sessionStr = localStorage.getItem(SESSION_KEY);
    const session = sessionStr ? JSON.parse(sessionStr) : null;

    if (session?.token) {
      checkBackendHealth().then(isConnected => {
        // 修改：不再回退到 mock，连接失败即为 error
        setDbStatus(isConnected ? 'connected' : 'error');
        
        if (isConnected) {
          addLog('SUCCESS', '系统', '后端连接成功');
        } else {
          addLog('ERROR', '系统', '后端连接失败', '无法连接到 API 服务器');
        }
      });
    } else {
      // 如果没有 token，保持 checking 或视情况设为其他状态（这里保持 checking 以避免在登录页显示错误红点）
      setDbStatus('checking');
    }
  }, []);

  if (location.pathname === '/login') return <>{children}</>;

  const handleLogout = () => {
    logout();
    window.location.href = '#/login';
    window.location.reload();
  };

  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
    } else {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-30 bg-white border-r border-gray-200 
          transition-all duration-300 ease-in-out flex flex-col overflow-hidden shadow-sm
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isDesktopSidebarOpen ? 'lg:w-64' : 'lg:w-0 lg:border-r-0 lg:overflow-hidden'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
          <Database className="h-8 w-8 text-blue-600 mr-2 flex-shrink-0" />
          <span className="text-xl font-bold text-gray-800 tracking-tight whitespace-nowrap">MedData</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
          {/* Admin Menu */}
          {user?.role === 'admin' && (
            <>
              <div className="text-xs font-semibold text-gray-400 px-4 mb-2 mt-2 uppercase whitespace-nowrap">管理中心</div>
              <SidebarLink to="/" icon={<LayoutDashboard className="h-5 w-5" />} label="综合仪表盘" />
              <SidebarLink to="/stats" icon={<PieChartIcon className="h-5 w-5" />} label="数据分析" />
              <SidebarLink to="/patients" icon={<Users className="h-5 w-5" />} label="患者管理" />
              <SidebarLink to="/resources" icon={<Layers className="h-5 w-5" />} label="资源管理" />
              <SidebarLink to="/multimodal" icon={<DatabaseZap className="h-5 w-5" />} label="多模态数据" />
            </>
          )}

          {/* Patient Menu */}
          {(user?.role === 'patient' || user?.role === 'admin') && (
            <>
              <div className="text-xs font-semibold text-gray-400 px-4 mb-2 mt-6 uppercase whitespace-nowrap">患者服务</div>
              <SidebarLink to="/appointment" icon={<CalendarPlus className="h-5 w-5" />} label="自助挂号" />
              {/* Only show My Appointments for patients */}
              {user?.role === 'patient' && (
                  <SidebarLink to="/my-appointments" icon={<Calendar className="h-5 w-5" />} label="我的预约" />
              )}
              <SidebarLink to="/history" icon={<History className="h-5 w-5" />} label="我的就诊记录" />
              <SidebarLink to="/ask-ai" icon={<MessageSquareText className="h-5 w-5" />} label="智能导诊" />
            </>
          )}

          {/* Doctor Menu */}
          {(user?.role === 'doctor' || user?.role === 'admin') && (
            <>
              <div className="text-xs font-semibold text-gray-400 px-4 mb-2 mt-6 uppercase whitespace-nowrap">医生工作台</div>
              <SidebarLink to="/consultation" icon={<UserCheck className="h-5 w-5" />} label="医生坐诊" />
              <SidebarLink to="/resources" icon={<Layers className="h-5 w-5" />} label="药品查询" />
              <SidebarLink to="/multimodal" icon={<DatabaseZap className="h-5 w-5" />} label="多模态中心" />
              <SidebarLink to="/radiology" icon={<FileImage className="h-5 w-5" />} label="影像诊断 AI" />
              <SidebarLink to="/ask-ai" icon={<MessageSquareText className="h-5 w-5" />} label="临床助手" />
            </>
          )}

          {/* Debug Menu */}
          {(user?.role === 'admin' || debug) && (
            <>
              <div className="text-xs font-semibold text-gray-400 px-4 mb-2 mt-6 uppercase whitespace-nowrap">系统监控</div>
              <SidebarLink to="/logs" icon={<ScrollText className="h-5 w-5" />} label="系统日志" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 mb-4 px-2">
             <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
               {user?.name?.[0]}
             </div>
             <div className="flex-1 min-w-0 overflow-hidden">
               <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
               <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
             </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
          >
            <LogOut className="h-4 w-4" /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between px-6 z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="text-gray-500 hover:text-blue-600 transition-colors">
              {window.innerWidth < 1024 ? (
                  isMobileMenuOpen ? <X /> : <Menu />
              ) : (
                  isDesktopSidebarOpen ? <Menu /> : <Menu className="transform rotate-90" />
              )}
            </button>
            <h1 className="text-lg font-bold text-gray-800 hidden md:block">
              MedData Hub
            </h1>
          </div>
          
          <div className="flex items-center gap-4 ml-auto">
             <SystemClock />
             <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>
             <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 animate-pulse' : dbStatus === 'error' ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                <span className={`text-xs font-medium ${dbStatus === 'connected' ? 'text-green-600' : dbStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                    {dbStatus === 'connected' ? 'API Online' : dbStatus === 'error' ? 'Connection Error' : 'Checking...'}
                </span>
             </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <>
      <GlobalAuthModal />
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Admin Routes */}
            <Route path="/" element={<RequireAuth roles={['admin']}><Dashboard /></RequireAuth>} />
            <Route path="/stats" element={<RequireAuth roles={['admin']}><PatientStats /></RequireAuth>} />
            <Route path="/patients" element={<RequireAuth roles={['admin']}><PatientList /></RequireAuth>} />
            <Route path="/logs" element={<RequireAuth><SystemLogs /></RequireAuth>} />

            {/* Shared Routes (Resources accessible by Admin & Doctor) */}
            <Route path="/resources" element={<RequireAuth roles={['admin', 'doctor']}><Resources /></RequireAuth>} />
            <Route path="/multimodal" element={<RequireAuth roles={['admin', 'doctor']}><MultimodalManager /></RequireAuth>} />
            
            {/* Patient Routes */}
            <Route path="/appointment" element={<RequireAuth roles={['patient', 'admin']}><AppointmentHall /></RequireAuth>} />
            
            {/* Restrict My Appointments to Patient only */}
            <Route path="/my-appointments" element={<RequireAuth roles={['patient']}><MyAppointments /></RequireAuth>} />
            
            <Route path="/history" element={<RequireAuth roles={['patient', 'admin', 'doctor']}><PatientHistory /></RequireAuth>} />
            
            {/* Doctor Routes */}
            <Route path="/consultation" element={<RequireAuth roles={['doctor', 'admin']}><DoctorConsultation /></RequireAuth>} />
            <Route path="/radiology" element={<RequireAuth roles={['doctor', 'admin']}><RadiologyAI /></RequireAuth>} />

            {/* AI (Accessible by all) */}
            <Route path="/ask-ai" element={<RequireAuth><AskAI /></RequireAuth>} />
          </Routes>
        </Layout>
      </Router>
    </>
  );
};

export default App;