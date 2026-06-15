# AthleteOS MVP v1.1 任务分解

## 任务优先级和实施顺序（按照PRD 26节要求）

### Phase 1: 项目初始化和数据模型设计
- ✅ Task 00: PRD分析和任务分解
- ⬜ Task 01: 技术栈选型和项目初始化
- ⬜ Task 02: 数据库模型设计（users, athlete_profiles, connected_accounts, activities, daily_athlete_states, daily_recommendations, user_feedback, weekly_reviews）

### Phase 2: 数据同步层
- ⬜ Task 03: Intervals.icu API 同步服务开发
- ⬜ Task 04: 数据同步去重和存储实现
- ⬜ Task 05: Mock数据生成器开发（用于UI和逻辑测试）

### Phase 3: 核心计算引擎
- ⬜ Task 06: Daily Athlete State Builder 开发
- ⬜ Task 07: Data Level 和 Cold Start 逻辑实现
- ⬜ Task 08: ACWR Engine 开发（含边界处理）
- ⬜ Task 09: Monotony Engine 开发（含边界处理）
- ⬜ Task 10: Training Risk Engine 开发
- ⬜ Task 11: Training Capacity Engine 开发
- ⬜ Task 12: Hard Safety Rules 引擎开发（8条安全规则）

### Phase 4: 决策引擎
- ⬜ Task 13: Daily Training Decision Engine 开发
- ⬜ Task 14: Workout Generator 开发（生成具体训练计划）
- ⬜ Task 15: Explanation Engine 开发（用户友好和技术解释）
- ⬜ Task 16: Dynamic Adjustment Engine 开发（用户反馈处理）
- ⬜ Task 17: decision_json 生成和持久化实现

### Phase 5: API层
- ⬜ Task 18: RESTful API 设计和实现
  - GET /api/today
  - POST /api/today/feedback
  - GET /api/state/daily
  - GET /api/weekly-review/latest
  - POST /api/sync/intervals
- ⬜ Task 19: API 接口文档和测试

### Phase 6: 前端UI开发
- ⬜ Task 20: 前端项目初始化和设计系统实现
- ⬜ Task 21: /connect/intervals 页面开发
- ⬜ Task 22: /today 页面开发（主页面）
  - Capacity Hero Card
  - Workout Recommendation Card
  - Simple Explanation Card
  - Feedback Action Bar
  - Technical Detail Drawer
- ⬜ Task 23: /history 页面开发
- ⬜ Task 24: /weekly-review 页面开发
- ⬜ Task 25: /goals 页面开发（基础信息展示）
- ⬜ Task 26: /settings 页面开发
- ⬜ Task 27: /debug/state 页面开发（开发用）

### Phase 7: 高级功能
- ⬜ Task 28: Weekly Review 聚合逻辑开发
- ⬜ Task 29: AI Coach 功能开发（约束范围内）
- ⬜ Task 30: 安全声明和风险提示实现

### Phase 8: 测试和验收
- ⬜ Task 31: 单元测试（核心计算引擎）
- ⬜ Task 32: 集成测试（API和数据流）
- ⬜ Task 33: 验收场景测试（PRD 25节 9个验收场景）
- ⬜ Task 34: 性能优化和边界情况测试
- ⬜ Task 35: MVP 最终验收

## 禁止实现功能列表（严格遵守）
1. Dashboard 术语（首页必须叫"今日训练"）
2. Readiness 指标在用户可见页面展示
3. Injury Risk / 受伤概率 等用户可见表述
4. 社交功能、排行榜、商城
5. 自由形式AI聊天和训练计划生成
6. Garmin/Apple Health/Strava等其他数据源集成
7. 医疗诊断和治疗建议
8. VO2Max/Threshold等高强度训练建议在data_level < B时展示
