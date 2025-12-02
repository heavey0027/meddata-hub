
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Database, Sparkles, Settings, ChevronDown, ChevronUp, Save, Server } from 'lucide-react';
import { chatWithAI, DEFAULT_CONFIGS } from '../services/aiService';
import { getPatients, getRecords, getDoctors, getMedicines, getDepartments } from '../services/mockDb';
import { getCurrentUser } from '../services/authService';
import { addLog } from '../services/logger';
import { AIConfig, AIProvider } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export const AskAI: React.FC = () => {
  const currentUser = getCurrentUser();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    modelName: 'gemini-2.5-flash'
  });

  useEffect(() => {
    // Initial Greeting based on role
    let greeting = "您好！我是您的智能数据库助手。";
    if (currentUser?.role === 'patient') {
        greeting = `您好 ${currentUser.name}，我是您的导诊助手。请描述您的症状，我可以为您推荐科室，或帮您查询医院信息。`;
    } else if (currentUser?.role === 'doctor') {
        greeting = `Dr. ${currentUser.name} 您好，我是临床辅助AI。我可以协助您查询病历、药品库存或提供诊疗参考。`;
    } else {
        greeting = "管理员您好，全院数据已准备就绪，您可以查询任意统计信息。";
    }
    setMessages([{ id: '0', sender: 'ai', text: greeting, timestamp: new Date() }]);

    // Load config
    const savedConfig = localStorage.getItem('meddata_ai_config');
    if (savedConfig) setAiConfig(JSON.parse(savedConfig));
    else {
      const envKey = localStorage.getItem('meddata_gemini_key') || '';
      if (envKey) setAiConfig(prev => ({ ...prev, apiKey: envKey }));
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    if (aiConfig.provider === 'gemini') {
      localStorage.setItem('meddata_gemini_key', aiConfig.apiKey);
    }
    setShowConfig(false);
    addLog('INFO', '智能问答', '更新配置', `切换模型至 ${aiConfig.provider}`);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!aiConfig.apiKey) {
      setShowConfig(true);
      alert("请先配置 API Key");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const [patients, records, doctors, depts, meds] = await Promise.all([
        getPatients(), getRecords(), getDoctors(), getDepartments(), getMedicines()
      ]);

      const context = JSON.stringify({
        // Filter sensitive data for patients
        patients: currentUser?.role === 'patient' ? [] : patients, 
        medicalRecords: currentUser?.role === 'patient' ? [] : records,
        doctors,
        departments: depts,
        medicines: currentUser?.role === 'patient' ? [] : meds
      });

      // Adjust persona prompt
      let persona = "";
      if (currentUser?.role === 'patient') {
          persona = "你是一位热情、专业的医院导诊护士。你的主要任务是根据患者的主诉推荐科室，或回答关于医院科室分布的问题。请不要给出具体的医疗诊断，不要开药。回答要通俗易懂，温暖亲切。";
      } else if (currentUser?.role === 'doctor') {
          persona = "你是一位专业的临床医学助手。你的任务是协助医生进行鉴别诊断、查询药品信息（包括库存）、回顾类似病历。回答应当专业、精确，使用医学术语。";
      } else {
          persona = "你是一个强大的数据库分析专家。你有权限访问所有医院数据。请根据上下文回答关于统计、运营和资源分配的问题。";
      }

      const fullPrompt = `${persona}\n\n上下文数据: ${context}\n\n用户问题: ${userMsg.text}`;
      
      const enhancedContext = `[SYSTEM PERSONA: ${persona}]\n\n[DATA]: ${context}`;

      const responseText = await chatWithAI(aiConfig, userMsg.text, enhancedContext);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `Error: ${errMsg}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-blue-600 h-6 w-6" />
            <div>
              <h2 className="font-semibold text-gray-800">
                  {currentUser?.role === 'patient' ? '智能导诊助手' : currentUser?.role === 'doctor' ? '临床决策支持系统' : '数据库智能分析'}
              </h2>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Database className="h-3 w-3" />
                当前角色: <span className="font-bold uppercase">{currentUser?.role}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-gray-600"
          >
            <Settings className="h-3 w-3" /> 设置
          </button>
        </div>

        {/* Config Panel */}
        {showConfig && (
          <div className="mt-3 animate-fade-in bg-white p-4 rounded-lg border border-blue-100 shadow-md space-y-3 relative z-20">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">AI 提供商</label>
                <select 
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={aiConfig.provider}
                  onChange={handleProviderChange}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="doubao">豆包</option>
                  <option value="openai">ChatGPT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">模型名称</label>
                <input 
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={aiConfig.modelName}
                  onChange={e => setAiConfig({...aiConfig, modelName: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">API Key</label>
              <input 
                type="password"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={aiConfig.apiKey}
                onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
              />
            </div>
             {aiConfig.provider !== 'gemini' && (
               <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Base URL</label>
                  <input 
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={aiConfig.baseUrl}
                    onChange={e => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                  />
               </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={saveConfig} className="bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700">保存</button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 
                ${msg.sender === 'user' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                {msg.sender === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap
                ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && <div className="text-xs text-gray-500 ml-12">AI 正在思考...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg pl-4 pr-12 py-3 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            placeholder={aiConfig.apiKey ? "输入您的问题..." : "请先配置 API Key"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={!aiConfig.apiKey}
          />
          <button onClick={handleSend} disabled={!input.trim()} className="absolute right-2 top-2 p-1.5 bg-blue-100 text-blue-600 rounded-md">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
