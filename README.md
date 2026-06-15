# AthleteOS

AthleteOS 是一个面向中国耐力运动用户的训练决策支持工具，基于 Intervals.icu 的数据提供个性化的训练建议和风险评估。

## 技术栈

### 后端
- NestJS + TypeScript
- Prisma ORM + SQLite
- Intervals.icu API 集成

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS (淡绿色设计系统)
- React Router v6

## 核心功能 (MVP v1.1)

1. **今日训练首页**
   - 今日训练能力评分 (Training Capacity)
   - 个性化训练建议
   - 训练决策依据
   - 用户状态反馈入口

2. **数据同步**
   - Intervals.icu 训练数据同步
   - 自动去重和数据质量评估

3. **核心计算引擎**
   - Training Capacity 计算
   - Training Risk 评估
   - ACWR (急性/慢性负荷比) 计算
   - Monotony (训练单调性) 计算
   - 8条硬性安全规则 (Hard Safety Rules)

4. **动态调整**
   - 基于用户反馈的训练计划调整
   - 疼痛和不适的安全处理

5. **周复盘**
   - 周训练总结和负荷分析
   - 亮点和风险提示
   - 下周训练建议

## 开发进度

- [x] PRD 分析和任务分解
- [x] 项目初始化和技术栈选型
- [ ] 数据库模型设计
- [ ] Intervals.icu 同步服务开发
- [ ] 核心计算引擎开发
- [ ] 决策引擎开发
- [ ] API 接口开发
- [ ] 前端 UI 开发
- [ ] 测试和验收

## 快速开始

### 前端开发
```bash
cd frontend
npm install
npm run dev
```
前端运行在 http://localhost:3000

### 后端开发
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```
后端运行在 http://localhost:3001

## 设计规范

严格遵循 [UI 设计文档](doc/ui-design.md)：
- 中文优先的界面
- 淡绿色主色调 (#5BBE8A)
- 低焦虑的健康专业风格
- 清晰的信息层级

## 禁止实现 (MVP 阶段)

- 社交功能、排行榜、商城
- Garmin/Apple Health/Strava 等其他数据源集成
- 自由形式 AI 聊天
- 医疗诊断和治疗建议
- 复杂仪表盘和过多技术指标展示

## 安全声明

AthleteOS 提供训练建议仅供参考，不构成医疗建议。如有疼痛或不适，请咨询专业医生。
