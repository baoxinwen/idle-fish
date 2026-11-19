import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
/* 变量字体：暗色字重补偿（400→360 等小数档）依赖连续 wght 轴，静态整档包做不到 */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import App from './App';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
