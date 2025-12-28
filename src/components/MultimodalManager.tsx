
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMultimodalData, createMultimodalData, deleteMultimodalData } from '../services/apiService';
import { MultimodalData, ModalityType } from '../types';
import { 
  FileImage, FileAudio, FileVideo, FileText, File, Activity, 
  Trash2, Upload, Plus, X, Search, DatabaseZap, Clock, FileType, Eye, Filter, PlayCircle
} from 'lucide-react';
import { getCurrentUser } from '../services/authService';

export const MultimodalManager: React.FC = () => {
  const [dataList, setDataList] = useState<MultimodalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModality, setFilterModality] = useState<ModalityType | 'all'>('all');
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: `MM${Date.now().toString().slice(-4)}`,
    modality: 'image' as ModalityType,
    patientId: '',
    recordId: '',
    textContent: '',
    description: '',
    sourceTable: '',
    sourcePk: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Preview State
  const [viewingItem, setViewingItem] = useState<MultimodalData | null>(null);

  const user = getCurrentUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getMultimodalData();
      setDataList(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定要删除这条多模态数据吗？此操作不可逆。")) return;
    try {
      await deleteMultimodalData(id);
      setDataList(prev => prev.filter(d => d.id !== id));
      alert("删除成功");
    } catch (e: any) {
      alert("删除失败: " + e.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id) return alert("请输入ID");
    if (!selectedFile && formData.modality !== 'text') return alert("请选择要上传的文件");

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('id', formData.id);
      fd.append('modality', formData.modality);
      if (formData.patientId) fd.append('patient_id', formData.patientId);
      if (formData.recordId) fd.append('record_id', formData.recordId);
      if (formData.description) fd.append('description', formData.description);
      if (formData.sourceTable) fd.append('source_table', formData.sourceTable);
      if (formData.sourcePk) fd.append('source_pk', formData.sourcePk);
      if (formData.textContent) fd.append('text_content', formData.textContent);
      
      if (selectedFile) {
        fd.append('file', selectedFile);
      }

      await createMultimodalData(fd);
      
      alert("上传成功");
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (e: any) {
      alert("上传失败: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: `MM${Date.now().toString().slice(-4)}`,
      modality: 'image',
      patientId: '',
      recordId: '',
      textContent: '',
      description: '',
      sourceTable: '',
      sourcePk: ''
    });
    setSelectedFile(null);
  };

  const getModalityIcon = (modality: ModalityType) => {
    switch (modality) {
      case 'image': return <FileImage className="h-5 w-5 text-blue-500" />;
      case 'audio': return <FileAudio className="h-5 w-5 text-purple-500" />;
      case 'video': return <FileVideo className="h-5 w-5 text-red-500" />;
      case 'text': return <FileText className="h-5 w-5 text-gray-500" />;
      case 'timeseries': return <Activity className="h-5 w-5 text-orange-500" />;
      case 'pdf': return <File className="h-5 w-5 text-red-700" />;
      default: return <File className="h-5 w-5 text-gray-400" />;
    }
  };

  const getFileUrl = (item: MultimodalData) => {
      const { filePath, id } = item;
      if (!filePath) return '';
      
      if (filePath.startsWith('blob:') || filePath.startsWith('http')) {
          return filePath;
      }
      
      return `http://localhost:5000/api/multimodal/file/${id}?_t=${Date.now()}`;
  };

  const renderPreviewContent = (item: MultimodalData) => {
      const src = getFileUrl(item);
      
      switch (item.modality) {
          case 'image':
              return <img src={src} alt={item.description} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm mx-auto" />;
          case 'audio':
              return (
                  <div className="w-full max-w-2xl mx-auto p-12 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-indigo-100 shadow-inner flex flex-col items-center">
                      <div className="relative mb-8">
                          <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full"></div>
                          <div className="relative bg-white p-6 rounded-full shadow-lg border border-purple-100">
                             <FileAudio className="h-20 w-20 text-purple-600" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-full text-white shadow-md animate-pulse">
                             <PlayCircle className="h-6 w-6" />
                          </div>
                      </div>
                      
                      <div className="text-center mb-10">
                         <h4 className="text-xl font-bold text-gray-800 mb-2">音频记录播放</h4>
                         <p className="text-sm text-gray-500">ID: {item.id} | 格式: {item.fileFormat || 'Unknown'}</p>
                      </div>

                      {/* Full width audio player to optimize progress bar length */}
                      <div className="w-full bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-white/80 shadow-sm">
                          <audio controls src={src} className="w-full" />
                      </div>
                  </div>
              );
          case 'video':
              return <video controls src={src} className="w-full max-h-[70vh] rounded-lg shadow-sm" />;
          case 'text':
              return (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-y-auto max-h-[60vh]">
                      <pre className="whitespace-pre-wrap font-sans text-gray-700">{item.textContent || '无文本内容'}</pre>
                  </div>
              );
          case 'pdf':
              return <iframe src={src} className="w-full h-[70vh] border rounded-lg" title="PDF Preview" />;
          case 'timeseries':
              return (
                  <div className="p-6 bg-gray-50 rounded-lg text-center">
                      <Activity className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                      <p className="text-gray-600 mb-4">时序数据文件 (CSV/JSON)</p>
                      <a 
                        href={src} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-600 hover:underline bg-white px-4 py-2 rounded border border-blue-200"
                      >
                          下载/查看源文件
                      </a>
                  </div>
              );
          default:
              return (
                  <div className="text-center p-10 text-gray-500">
                      <p>暂不支持预览此格式 ({item.fileFormat})</p>
                      <a href={src} target="_blank" rel="noreferrer" className="text-blue-500 mt-2 block hover:underline">下载文件</a>
                  </div>
              );
      }
  };

  const filteredData = dataList.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.patientId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModality = filterModality === 'all' || d.modality === filterModality;
    return matchesSearch && matchesModality;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
               <DatabaseZap className="h-6 w-6" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-gray-800">多模态数据中心</h2>
               <p className="text-xs text-gray-500">统一管理影像、音频、时序数据及文档</p>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
           <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm">
             <Filter className="h-4 w-4 text-gray-400" />
             <select 
               className="text-sm text-gray-700 outline-none bg-transparent cursor-pointer"
               value={filterModality}
               onChange={(e) => setFilterModality(e.target.value as any)}
             >
                <option value="all">所有类型</option>
                <option value="image">影像 (Image)</option>
                <option value="audio">音频 (Audio)</option>
                <option value="video">视频 (Video)</option>
                <option value="text">文本 (Text)</option>
                <option value="pdf">文档 (PDF)</option>
                <option value="timeseries">时序 (Timeseries)</option>
             </select>
           </div>
           <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <input 
               type="text" 
               placeholder="搜索 ID / 描述 / 患者..."
               className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
           >
             <Upload className="h-4 w-4" /> <span>上传数据</span>
           </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3">数据ID</th>
                <th className="px-6 py-3">模态类型</th>
                <th className="px-6 py-3">关联信息</th>
                <th className="px-6 py-3">描述/内容</th>
                <th className="px-6 py-3">格式</th>
                <th className="px-6 py-3">创建时间</th>
                <th className="px-6 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                 <tr><td colSpan={7} className="text-center py-10 text-gray-400">加载数据中...</td></tr>
              ) : filteredData.length === 0 ? (
                 <tr><td colSpan={7} className="text-center py-10 text-gray-400">未找到符合条件的数据</td></tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 group">
                    <td className="px-6 py-4 font-mono text-gray-500">{item.id}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          {getModalityIcon(item.modality)}
                          <span className="capitalize">{item.modality}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {item.patientId ? (
                         <div className="text-xs">
                            <span className="block text-gray-500">Patient: {item.patientId}</span>
                            {item.recordId && <span className="block text-gray-400">Record: {item.recordId}</span>}
                         </div>
                       ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={item.textContent || item.description}>
                       {item.description || item.textContent || <span className="text-gray-300">无描述</span>}
                    </td>
                    <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono uppercase">
                            {item.fileFormat || 'N/A'}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{item.createdAt}</td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2">
                           <button
                             onClick={() => setViewingItem(item)}
                             className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                             title="预览文件"
                           >
                               <Eye className="h-4 w-4" />
                           </button>
                           <button 
                             onClick={() => handleDelete(item.id)}
                             className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                             title="删除"
                           >
                              <Trash2 className="h-4 w-4" />
                           </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {viewingItem && createPortal(
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-md" onClick={() => setViewingItem(null)}>
              <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
                      <div>
                          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                              {getModalityIcon(viewingItem.modality)}
                              {viewingItem.id} - 预览
                          </h3>
                          {viewingItem.description && <p className="text-sm text-gray-500 mt-1">{viewingItem.description}</p>}
                      </div>
                      <button onClick={() => setViewingItem(null)} className="text-gray-500 hover:text-gray-800 p-2 rounded hover:bg-gray-200">
                          <X className="h-6 w-6" />
                      </button>
                  </div>
                  <div className="p-6 overflow-y-auto bg-gray-100/50 flex items-center justify-center min-h-[300px]">
                      {renderPreviewContent(viewingItem)}
                  </div>
                  <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-xs text-gray-500">
                      <span>Format: {viewingItem.fileFormat || 'Unknown'}</span>
                      <a 
                        href={getFileUrl(viewingItem)} 
                        download={`file_${viewingItem.id}.${viewingItem.fileFormat}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                          直接下载
                      </a>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Upload Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                   <Upload className="h-5 w-5 text-indigo-600" /> 上传多模态数据
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5"/></button>
             </div>
             
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">数据 ID</label>
                      <input 
                        className="w-full border p-2 rounded bg-gray-50"
                        value={formData.id}
                        onChange={e => setFormData({...formData, id: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">模态类型</label>
                      <select 
                        className="w-full border p-2 rounded bg-white"
                        value={formData.modality}
                        onChange={e => setFormData({...formData, modality: e.target.value as ModalityType})}
                      >
                         <option value="image">Image (影像)</option>
                         <option value="text">Text (文本)</option>
                         <option value="audio">Audio (音频)</option>
                         <option value="video">Video (视频)</option>
                         <option value="pdf">PDF (文档)</option>
                         <option value="timeseries">Timeseries (时序)</option>
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">患者 ID (可选)</label>
                      <input 
                        className="w-full border p-2 rounded"
                        placeholder="P001"
                        value={formData.patientId}
                        onChange={e => setFormData({...formData, patientId: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">病历 ID (可选)</label>
                      <input 
                        className="w-full border p-2 rounded"
                        placeholder="R..."
                        value={formData.recordId}
                        onChange={e => setFormData({...formData, recordId: e.target.value})}
                      />
                   </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">数据描述</label>
                    <input 
                      className="w-full border p-2 rounded"
                      placeholder="例如：胸部CT扫描、初诊录音..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                </div>

                {formData.modality === 'text' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">文本内容</label>
                        <textarea 
                           className="w-full border p-2 rounded h-32"
                           placeholder="输入纯文本内容..."
                           value={formData.textContent}
                           onChange={e => setFormData({...formData, textContent: e.target.value})}
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">文件上传</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer relative">
                            <input 
                               type="file" 
                               className="absolute inset-0 opacity-0 cursor-pointer"
                               onChange={handleFileChange}
                            />
                            {selectedFile ? (
                                <div className="text-center">
                                    <FileType className="h-8 w-8 mx-auto text-indigo-500 mb-2" />
                                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            ) : (
                                <>
                                   <Upload className="h-8 w-8 mb-2 text-gray-400" />
                                   <p className="text-sm">点击或拖拽文件至此</p>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      disabled={uploading}
                      className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center gap-2"
                    >
                      {uploading ? <Clock className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? '上传中...' : '确认上传'}
                    </button>
                </div>
             </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
