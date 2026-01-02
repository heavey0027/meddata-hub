
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Zap, FileText, AlertCircle, Loader2, Image as ImageIcon, Settings, Save, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { fileToGenerativePart, analyzeMedicalImage, DEFAULT_CONFIGS } from '../services/aiService';
import { addLog } from '../services/logger';
import { AIConfig, AIProvider } from '../types';

export const RadiologyAI: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config State
  const [showConfig, setShowConfig] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
      provider: 'gemini',
      apiKey: '',
      baseUrl: '',
      modelName: 'gemini-2.5-flash'
  });

  useEffect(() => {
    const savedConfig = localStorage.getItem('meddata_ai_config');
    if (savedConfig) {
      setAiConfig(JSON.parse(savedConfig));
    } else {
       const envKey = localStorage.getItem('meddata_gemini_key') || '';
       if (envKey) setAiConfig(prev => ({ ...prev, apiKey: envKey }));
    }
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as AIProvider;
      const defaults = DEFAULT_CONFIGS[newProvider];
      setAiConfig(prev => ({
        ...prev,
        provider: newProvider,
        baseUrl: defaults?.baseUrl || '',
        modelName: defaults?.modelName || '',
        apiKey: ''
      }));
  };
  
  const saveConfig = () => {
      localStorage.setItem('meddata_ai_config', JSON.stringify(aiConfig));
      setShowConfig(false);
      addLog('INFO', '医学影像AI', '更新配置', `切换模型至 ${aiConfig.provider}`);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 'image/bmp' 和 'image/tiff' 等格式支持
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      alert("不支持的文件格式。请上传 JPG, PNG, WEBP 或 BMP 格式的医学影像。");
      return;
    }

    try {
      const base64Data = await fileToGenerativePart(file);
      const fullBase64 = `data:${file.type};base64,${base64Data}`;
      setSelectedImage(fullBase64);
      setAnalysis('');
      addLog('INFO', '医学影像AI', '上传图片', `文件: ${file.name} (${file.type})`);
    } catch (e) {
      console.error("Error reading file", e);
      alert("读取文件失败。");
    }
  };

  const runAnalysis = async () => {
    if (!selectedImage) return;
    if (!aiConfig.apiKey) {
        setShowConfig(true);
        alert("请先配置 API Key");
        return;
    }

    setLoading(true);
    setAnalysis('');

    try {
      const matches = selectedImage.match(/^data:(.+);base64,(.+)$/);
      if (!matches || matches.length !== 3) throw new Error("图像数据格式错误");

      const mimeType = matches[1];
      const base64ForApi = matches[2];

      // 注意：部分 AI 模型（如Gemini）可能不原生支持 BMP。
      // 如果后端服务不自动转码，这里可能需要前端 Canvas 转码逻辑。
      // 但大多数现代多模态接口（如 GPT-4o）处理 base64 兼容性较好。
      const result = await analyzeMedicalImage(
        aiConfig,
        base64ForApi, 
        mimeType,
        "请详细分析这张医学扫描图。首先识别影像模态（如X光 X-Ray、CT、MRI、超声等）。接着指出关键解剖结构，并识别潜在的异常、病灶或骨折。最后给出初步的影像学诊断建议。请使用清晰的结构化Markdown格式输出（包含标题、列表、加粗重点）。"
      );
      setAnalysis(result);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "未知错误";
      setAnalysis(`**分析失败**: ${errMsg}`);
      if (aiConfig.provider === 'deepseek') {
          setAnalysis(prev => prev + "\n\n> 注意: DeepSeek 等部分模型可能暂不支持直接的图像分析功能，建议切换至 Gemini 或 ChatGPT-4o");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-8rem)]">
      {/* Left Column: Image Upload & Config */}
      <div className="space-y-6 flex flex-col h-full">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                医学影像上传
            </h2>
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 border px-2 py-1 rounded"
            >
                <Settings className="h-3 w-3" />
                {showConfig ? '收起配置' : 'AI 设置'}
            </button>
          </div>

          {/* Config Panel */}
          {showConfig && (
            <div className="mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-sm space-y-3 animate-fade-in flex-shrink-0">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">AI 厂商</label>
                        <select 
                            className="w-full border rounded px-2 py-1"
                            value={aiConfig.provider}
                            onChange={handleProviderChange}
                        >
                             <option value="gemini">Google Gemini (推荐)</option>
                             <option value="openai">ChatGPT (GPT-4o)</option>
                             <option value="deepseek">DeepSeek (可能仅文本)</option>
                             <option value="doubao">豆包 (Doubao)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">模型名称</label>
                        <input 
                            className="w-full border rounded px-2 py-1"
                            value={aiConfig.modelName}
                            onChange={e => setAiConfig({...aiConfig, modelName: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                     <label className="block text-xs font-semibold text-gray-600 mb-1">API Key</label>
                     <input 
                        type="password"
                        className="w-full border rounded px-2 py-1"
                        value={aiConfig.apiKey}
                        onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
                        placeholder="在此输入对应厂商的 API Key"
                    />
                </div>
                {aiConfig.provider !== 'gemini' && (
                     <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Base URL</label>
                        <input 
                            className="w-full border rounded px-2 py-1 font-mono text-xs"
                            value={aiConfig.baseUrl}
                            onChange={e => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                        />
                    </div>
                )}
                <div className="flex justify-end">
                    <button onClick={saveConfig} className="bg-blue-600 text-white px-3 py-1 rounded text-xs flex items-center gap-1">
                        <Save className="h-3 w-3" /> 保存
                    </button>
                </div>
            </div>
          )}
          
          <div 
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer min-h-[200px]
              ${selectedImage ? 'border-blue-200 bg-blue-50/30' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                 <img 
                  src={selectedImage} 
                  alt="Medical Scan" 
                  className="max-h-full w-full object-contain rounded-lg shadow-sm"
                />
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                   点击更换
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
                  <ImageIcon className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-gray-900 font-medium text-lg">点击上传医学影像</p>
                <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                  支持 X光 (X-Ray), CT, MRI, 超声 (JPG/PNG/WEBP/BMP)
                </p>
              </div>
            )}
            {/* 属性增加 image/bmp */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg, image/png, image/webp, image/bmp, image/tiff"
              onChange={handleFileChange} 
            />
          </div>

          <div className="mt-6 flex gap-3 flex-shrink-0">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              {selectedImage ? '更换图片' : '选择图片'}
            </button>
            <button 
              onClick={runAnalysis}
              disabled={!selectedImage || loading}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2
                ${!selectedImage || loading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
              {loading ? '正在分析...' : '运行AI诊断'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Analysis Results */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 flex-shrink-0">
          <FileText className="h-5 w-5 text-indigo-600" />
          智能诊断报告
        </h2>
        <div className="flex-1 bg-gray-50 rounded-xl p-6 overflow-y-auto border border-gray-200">
          {!analysis && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
              <p>请上传影像并点击“运行AI诊断”</p>
            </div>
          )}
          {loading && (
            <div className="space-y-6 animate-pulse">
               <div className="text-center text-sm text-blue-500 mb-4">正在请求 {aiConfig.provider} 模型...</div>
               <div className="h-4 bg-gray-200 rounded w-3/4"></div>
               <div className="h-4 bg-gray-200 rounded w-full"></div>
               <div className="h-4 bg-gray-200 rounded w-5/6"></div>
               <div className="h-32 bg-gray-200 rounded w-full mt-6"></div>
            </div>
          )}
          {analysis && (
            // 使用 ReactMarkdown 替换普通 div
            // prose 类用于自动美化 Markdown 转换后的 HTML 样式
            <div className="prose prose-blue prose-sm max-w-none text-gray-800">
              <ReactMarkdown 
                components={{
                    // 自定义渲染组件以增强样式 (可选)
                    h3: ({node, ...props}) => <h3 className="text-blue-700 font-bold mt-4 mb-2" {...props} />,
                    strong: ({node, ...props}) => <strong className="text-blue-900 font-bold" {...props} />,
                    li: ({node, ...props}) => <li className="my-1" {...props} />
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <div className="mt-4 text-xs text-gray-500 border-t pt-4 flex items-center gap-2 flex-shrink-0">
           <AlertCircle className="h-3 w-3 text-orange-500" />
          <span>免责声明：AI分析结果仅供教学和辅助参考，严禁直接用于临床诊断。</span>
        </div>
      </div>
    </div>
  );
};
