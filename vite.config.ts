import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // --- 新增代理配置 (Proxy) ---
        proxy: {
          '/api': {
            target: 'http://localhost:5000', // 后端地址 (Docker 暴露端口或本地 python 运行)
            changeOrigin: true,
            secure: false,
            // 如果后端路由本来就带 /api 前缀，则不需要 rewrite
            // 如果后端是 /login 而非 /api/login，则需取消注释下一行：
            // rewrite: (path) => path.replace(/^\/api/, ''),
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});