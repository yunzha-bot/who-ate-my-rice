import { defineConfig } from 'vite';

/**
 * 本地开发固定使用 http://127.0.0.1:5173/。
 * strictPort: 端口被占用时直接报错退出，绝不静默切换到 5174 等其他端口。
 */
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
