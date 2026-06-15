# Task 02: 数据库模型设计

## 完成状态: ✅ 已完成

## 设计依据
完全按照PRD第21节"数据库设计要求"和各模块的数据结构需求设计。

## 模型列表 (8个核心模型)

### 1. User (用户表)
- 存储基础用户信息
- 关联所有其他业务数据

### 2. AthleteProfile (运动员档案)
- 存储用户的运动偏好、目标等信息
- 对应PRD Goal Planning 模块需求

### 3. ConnectedAccount (已连接账户)
- 存储Intervals.icu连接信息和同步状态
- 支持多个第三方账户连接（当前仅Intervals.icu）
- 对应PRD第4节"数据源同步"需求

### 4. Activity (训练活动记录)
- 存储从Intervals.icu同步的所有训练记录
- 包含TSS、距离、时长、心率、功率等所有训练指标
- 保留原始API响应数据用于回溯
- 对应PRD第4.2节"活动同步结构"需求

### 5. DailyAthleteState (每日运动员状态)
- 存储每日计算的运动员状态数据
- 包含所有核心计算指标: CTL/ATL/Form, ACWR, Monotony, Training Capacity, Training Risk等
- 包含数据质量和置信度信息
- 对应PRD第7节"Daily Athlete State Builder"需求

### 6. DailyRecommendation (每日训练建议)
- 存储系统生成的每日训练建议
- 包含训练内容、决策依据、安全规则触发情况
- 必须存储decision_json用于审计和回溯
- 支持调整后的建议与原建议关联
- 对应PRD第13节"Daily Training Decision Engine"和21.1节"decision_json要求"

### 7. UserFeedback (用户反馈)
- 存储用户对训练建议的反馈
- 支持所有反馈类型: 太累、没时间、疼痛、调整运动类型等
- 对应PRD第14节"Dynamic Adjustment Engine"需求

### 8. WeeklyReview (周复盘)
- 存储每周训练复盘数据
- 包含周负荷、完成率、亮点、风险、下周建议等
- 对应PRD第18节"Weekly Review"需求

## 设计特点
1. 所有模型都包含必要的关联关系
2. 唯一约束设计避免重复数据（如用户+日期的唯一索引）
3. Json字段用于存储灵活的结构化数据（如训练结构、决策依据等）
4. 完全符合PRD中对数据持久化的所有要求
5. 支持MVP阶段的所有功能需求，同时预留扩展空间

## 下一步
1. 执行数据库迁移
2. 开发Intervals.icu同步服务
