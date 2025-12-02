
import { GoogleGenAI } from "@google/genai";
import { addLog } from './logger';
import { AIConfig } from '../types';

// --- Utility: File to Base64 ---
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- Defaults & Constants ---
export const DEFAULT_CONFIGS: Record<string, Partial<AIConfig>> = {
  gemini: {
    provider: 'gemini',
    modelName: 'gemini-2.5-flash',
    baseUrl: ''
  },
  deepseek: {
    provider: 'deepseek',
    modelName: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com'
  },
  doubao: {
    provider: 'doubao',
    modelName: '', // User must input Endpoint ID (e.g. ep-2024...)
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  },
  openai: {
    provider: 'openai',
    modelName: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1'
  }
};

// --- Core Logic ---

// 1. Unified Chat Function
export const chatWithAI = async (config: AIConfig, query: string, contextData: string): Promise<string> => {
  const { provider, apiKey, baseUrl, modelName } = config;

  if (!apiKey) throw new Error(`${provider} API Key 未配置`);

  // Log Request
  addLog('INFO', 'AI_REQUEST', `发起对话 (${provider})`, `Model: ${modelName}`, {
    provider,
    model: modelName,
    baseUrl,
    queryLength: query.length,
    contextLength: contextData.length
  });

  try {
    const systemPrompt = `你是一个医疗数据库的智能助手。
    以下是当前的数据集上下文（JSON格式）：${contextData}
    用户问题：${query}
    请基于提供的数据简明扼要地回答。请务必使用中文回答。`;

    let result = '';

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: { parts: [{ text: systemPrompt }] }
      });
      result = response.text || "未生成回答。";

    } else {
      // Standard OpenAI-compatible Format (DeepSeek, Doubao, ChatGPT)
      const url = `${baseUrl?.replace(/\/+$/, '')}/chat/completions`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: "你是一个专业的医疗数据助手。" },
            { role: 'user', content: systemPrompt }
          ],
          stream: false
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || "API 返回内容为空";
    }

    addLog('SUCCESS', 'AI_RESPONSE', `对话成功 (${provider})`, `长度: ${result.length}`, { result });
    return result;

  } catch (error: any) {
    console.error("AI Chat Error:", error);
    addLog('ERROR', 'AI_FAIL', `对话失败 (${provider})`, error.message, { stack: error.stack });
    throw error;
  }
};

// 2. Unified Image Analysis Function
export const analyzeMedicalImage = async (
  config: AIConfig, 
  base64Image: string, 
  mimeType: string, 
  prompt: string
): Promise<string> => {
  const { provider, apiKey, baseUrl, modelName } = config;

  if (!apiKey) throw new Error(`${provider} API Key 未配置`);

  // Warning for text-only models
  if (provider === 'deepseek') {
    // DeepSeek V3 is text only usually, unless using specific endpoints. 
    // For this demo, we'll warn.
    addLog('WARNING', 'AI_REQUEST', 'DeepSeek 不支持原生视觉输入', '尝试调用但可能会失败');
  }

  addLog('INFO', 'AI_REQUEST', `影像分析 (${provider})`, `Model: ${modelName}`, {
    provider,
    imageType: mimeType
  });

  try {
    let result = '';

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: `你是一位专业的医学AI助手。${prompt} 请用中文回答。` }
          ]
        }
      });
      result = response.text || "未生成结果";

    } else {
      // OpenAI Compatible Vision (GPT-4o supported. Doubao/DeepSeek might vary)
      // Note: base64 image format for OpenAI is `data:image/jpeg;base64,{base64_image}`
      
      const url = `${baseUrl?.replace(/\/+$/, '')}/chat/completions`;
      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || "API 返回内容为空";
    }

    addLog('SUCCESS', 'AI_RESPONSE', `分析成功 (${provider})`, `长度: ${result.length}`, { result });
    return result;

  } catch (error: any) {
    console.error("AI Vision Error:", error);
    addLog('ERROR', 'AI_FAIL', `分析失败 (${provider})`, error.message);
    throw error;
  }
};
