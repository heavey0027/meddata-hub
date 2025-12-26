
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLogs, clearLogs } from '../services/logger';
import { SystemLog } from '../types';
import { Trash2, Filter, AlertTriangle, CheckCircle, Info, XCircle, ScrollText, RefreshCw, Pause, Eye, X } from 'lucide-react';

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterModule, setFilterModule] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const refreshLogs = () => {
    setLogs(getLogs());
  };

  useEffect(() => {
    refreshLogs();
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(refreshLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClear = () => {
    if (window.confirm('确定要清空所有系统日志吗？')) {
      clearLogs();
      refreshLogs();
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (filterModule !== 'ALL' && log.module !== filterModule) return false;
    return true;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'SUCCESS': return 'bg-green-50 text-green-700 border-green-100';
      case 'WARNING': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'ERROR': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  const modules = Array.from(new Set(logs.map(l => l.module)));

  return (
    <div className="space-y-6 animate-fade-in flex flex-col relative">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-20 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">系统操作日志</h2>
            <p className="text-xs text-gray-500">实时监控前端请求与API调用</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
             onClick={() => setAutoRefresh(!autoRefresh)}
             className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                 autoRefresh ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-500 border-gray-200'
             }`}
             title={autoRefresh ? "暂停刷新" : "开启自动刷新"}
          >
             {autoRefresh ? <RefreshCw className="h-4 w-4 animate-spin-slow" /> : <Pause className="h-4 w-4" />}
             {autoRefresh ? '实时' : '暂停'}
          </button>

          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm">
            <Filter className="h-4 w-4 text-gray-400" />
            <select 
              value={filterLevel} 
              onChange={e => setFilterLevel(e.target.value)}
              className="bg-transparent outline-none text-gray-600 cursor-pointer"
            >
              <option value="ALL">所有级别</option>
              <option value="INFO">信息 (INFO)</option>
              <option value="SUCCESS">成功 (SUCCESS)</option>
              <option value="WARNING">警告 (WARNING)</option>
              <option value="ERROR">错误 (ERROR)</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg text-sm">
             <Filter className="h-4 w-4 text-gray-400" />
            <select 
              value={filterModule} 
              onChange={e => setFilterModule(e.target.value)}
              className="bg-transparent outline-none text-gray-600 max-w-[120px] cursor-pointer"
            >
              <option value="ALL">所有模块</option>
              {modules.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <button 
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
          >
            <Trash2 className="h-4 w-4" /> 清空
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold w-40">时间</th>
                <th className="px-6 py-3 font-semibold w-24">级别</th>
                <th className="px-6 py-3 font-semibold w-32">模块</th>
                <th className="px-6 py-3 font-semibold w-48">动作</th>
                <th className="px-6 py-3 font-semibold">详情</th>
                <th className="px-6 py-3 font-semibold w-16">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-sans">
                    暂无日志记录
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${getLevelClass(log.level)}`}>
                        {getLevelIcon(log.level)}
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 font-medium">
                      {log.module}
                    </td>
                    <td className="px-6 py-3 text-gray-800 font-medium">
                      {log.action}
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs break-all">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-3 text-center">
                       <button className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50">
                         <Eye className="h-4 w-4" />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between">
          <span>当前显示 {filteredLogs.length} 条</span>
          <span>日志上限: 200 条 (自动轮替)</span>
        </div>
      </div>

      {/* Detail Modal - Portal */}
      {selectedLog && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                 <span className={`p-1.5 rounded-lg border ${getLevelClass(selectedLog.level)}`}>
                   {getLevelIcon(selectedLog.level)}
                 </span>
                 <div>
                    <h3 className="font-bold text-gray-800">日志详情</h3>
                    <p className="text-xs text-gray-500">{selectedLog.timestamp}</p>
                 </div>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 font-mono text-sm flex-1">
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">模块</span>
                    <span className="text-gray-800">{selectedLog.module}</span>
                 </div>
                 <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">动作</span>
                    <span className="text-gray-800">{selectedLog.action}</span>
                 </div>
                 <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="block text-xs text-gray-500 uppercase font-semibold mb-1">基本信息</span>
                    <span className="text-gray-800 whitespace-pre-wrap">{selectedLog.details}</span>
                 </div>
              </div>

              {selectedLog.metadata && (
                <div>
                   <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Request / Response Metadata</h4>
                   <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto shadow-inner">
                     <pre className="whitespace-pre-wrap break-all">
                       {JSON.stringify(selectedLog.metadata, null, 2)}
                     </pre>
                   </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end flex-shrink-0">
               <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
               >
                 关闭
               </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
