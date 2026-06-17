# AthleteOS 下一阶段任务清单（V2 / V3）

来源：
- `/Users/ivan/workspace/AthleteOS/doc/bak/AthleteOS V2 Product Requirements.docx`
- `/Users/ivan/workspace/AthleteOS/doc/bak/AthleteOS V3 Product Requirements.docx`

当前建议顺序：先完成 V2 的 Goal / Performance / Structured Workout / Recovery / Weekly Coaching，再进入 V3 的 Season Planner / Digital Athlete Graph / Autonomous Coach。

## P0 基础补齐：AI Coach 与 LLM 配置

- [x] 定义 AI Coach 边界：LLM 只负责解释、总结、问答和话术，不直接决定训练负荷。
- [x] 完成 LLM 设置持久化与设置页配置。
- [x] 新增 `LlmCoachService` 抽象，支持 OpenAI-compatible Provider、model、baseUrl、apiKey。
- [x] 为 AI Coach 输出建立安全 guardrail：不得覆盖 Hard Safety Rules、不得医疗诊断、不得建议忽略疼痛。
- [x] 在训练解释中增加可选 LLM polish 层：输入系统生成的结构化证据，输出更自然解释。
- [x] 在训练反馈中增加可选 LLM 解释层：只解释“为什么调整”，不改变调整结果。
- [x] 在训练分析中增加可选 LLM 总结层：基于周报、模型覆盖、恢复趋势生成自然语言总结。
- [x] 添加 AI Coach 审计日志：记录输入证据、LLM 输出、规则结果和是否被安全过滤。

## V2 Epic 1：Performance Prediction Engine

- [ ] 新增 `PerformancePrediction` 数据模型与 migration。
- [ ] 构建跑步预测 MVP：半马优先，输入 CTL/ATL/Form、周跑量、周 TSS、长距离历史、节奏训练历史、睡眠趋势、HRV 趋势。
- [ ] 支持预测窗口：4 / 8 / 12 / 16 周。
- [ ] 输出 current prediction、未来预测、confidence、data quality、main drivers。
- [ ] 冷启动限制：data level < B 时不输出精确预测，只提示继续积累数据。
- [ ] 后续扩展：5K、10K、马拉松、FTP/eFTP/Critical Power。
- [ ] API：`GET /api/performance/prediction?event=half_marathon`。
- [ ] 验收：至少支持半马和 FTP 之一；必须输出 confidence；数据不足时必须隐藏精确预测。

## V2 Epic 2：Goal / Goal Gap Analysis

- [ ] 新增 `Goal` 数据模型：event_type、event_name、event_date、target_result、priority、status。
- [ ] 新增 `GoalAnalysis` 数据模型：probability、grade、required/expected improvement、limiting factors、goal options。
- [ ] 设置页或独立 Goal 页面支持创建/编辑目标。
- [ ] 实现目标差距分析：当前能力 vs 目标能力，输出差距秒数/功率差距。
- [ ] 识别限制因素：阈值配速、周跑量、训练频率、长距离、节奏课完成率、恢复不足。
- [ ] 生成 A/B/C Goal：挑战、稳妥、保底。
- [ ] API：`GET /api/goals/{goal_id}/gap-analysis`。
- [ ] API：`GET /api/goals/{goal_id}/options`。
- [ ] 验收：输出目标等级、主要限制因素、A/B/C Goal。

## V2 Epic 3：Structured Workout Prescription

- [ ] 新增 `StructuredWorkout` 数据模型：recommendation_id、workout_json、export_status。
- [ ] 扩展 workout schema：purpose、warmup、main_set、cooldown、target、notes。
- [ ] 跑步训练类型：easy、recovery、tempo、threshold、interval、vo2max、long、progression。
- [ ] 骑行训练类型：recovery、endurance、tempo、sweet spot、threshold、vo2max、long。
- [ ] 力量/恢复训练类型：core、mobility、glute activation、general strength。
- [ ] 实现配速/功率目标生成：threshold_pace > race_result > time_trial > history estimate；FTP > eFTP > power curve > manual。
- [ ] 数据不足时回退 RPE。
- [ ] API：`GET /api/workouts/{recommendation_id}/structured`。
- [ ] Today / Workout Detail 页面展示结构化训练、训练目的、目标配速/功率/RPE。
- [ ] 验收：必须输出 warmup、main_set、cooldown、target、expected_tss、purpose。

## V2 Epic 4：Dynamic Workout Scaling

- [ ] 训练前重新评估 Training Capacity。
- [ ] 对比 morning capacity 与 pre-workout capacity。
- [ ] 根据 capacity drop 执行：不变、减少量、降强度、恢复训练。
- [ ] 输入主观疲劳、睡眠、风险等级、可用时间。
- [ ] 禁止绕过 Hard Safety Rules。
- [ ] API：`POST /api/workouts/{recommendation_id}/scale`。
- [ ] Today / Workout Detail 页面显示“已缩放”原因和原计划/调整后对比。
- [ ] 验收：状态下降时能降低 TSS/强度，并解释原因。

## V2 Epic 5：Recovery Recommendation Engine

- [ ] 定义 recovery score。
- [ ] 触发条件：Training Capacity < 40、Training Risk > 0.5、连续 3 天 sleep < 60、连续 3 天 HRV 下降 > 15%、Form < -25、疼痛反馈。
- [ ] 恢复建议类型：Rest Day、Recovery Run/Ride、Mobility、Core、Sleep Focus、Nutrition Reminder、Stress Reduction、Light Walk。
- [ ] 输出 trigger、recommendations、duration、intensity、message。
- [ ] 接入 Today 页面和反馈弹窗。
- [ ] 验收：低能力/高风险触发恢复建议，不输出医学诊断。

## V2 Epic 6：Enhanced Weekly Coaching Report

- [ ] 周报增加 goal_progress：当前预测、上周预测、变化、解释。
- [ ] 周报增加 load_analysis：TSS、周增幅、合理性。
- [ ] 周报增加 recovery_analysis：睡眠趋势、HRV 趋势、恢复提醒。
- [ ] 周报增加 next_week_focus。
- [ ] 周报增加“哪些训练最有效”分析。
- [ ] 页面增强：目标进度、负荷、恢复趋势、下周重点。
- [ ] 验收：周报能回答“是否更接近目标”和“下周应该重点做什么”。

## V2 Epic 7：页面与信息架构

- [ ] Today 页面增强：结构化训练详情、训练目的、动态缩放提示、替代训练选项。
- [ ] Goal 页面：当前目标、预测能力、目标成绩、达成概率、A/B/C Goal、限制因素。
- [ ] Performance 页面：当前能力、4/8/12/16 周预测、Performance Trend、Gain Velocity、Confidence。
- [ ] Weekly Review 页面增强：目标进度变化、负荷分析、恢复趋势、下周重点。

## V3 Epic 1：Annual Training Planner

- [ ] 新增 `Race` 数据模型：name、event_type、race_date、priority、target_result、status。
- [ ] 新增 `SeasonBlock` 数据模型：phase、start/end、focus、weekly_tss_min/max。
- [ ] 支持 A/B/C Race。
- [ ] 根据 A Race 自动生成 Base / Build / Peak / Taper。
- [ ] 支持 12/16/20/24 周和 Annual Plan。
- [ ] API：`GET /api/season-plan`。
- [ ] API：`POST /api/races`。
- [ ] API：`POST /api/season-plan/generate`。
- [ ] 验收：多个赛事、A/B/C Race、Season Blocks、Peak/Taper 对齐 A Race、输出规划原因。

## V3 Epic 2：Multi-Sport Optimization

- [ ] 支持 Running / Cycling / Strength / Mobility / Recovery 资源分配。
- [ ] 输入目标优先级、可用时间、适应 profile、风险 profile。
- [ ] 公式：goal_priority × adaptation_score × available_time × safety_modifier。
- [ ] 输出 allocation、weekly_plan_direction、reason。
- [ ] API：`GET /api/multisport/allocation`。
- [ ] 验收：根据目标优先级和风险输出资源分配原因。

## V3 Epic 3：Adaptive Goal Adjustment

- [ ] 监控 goal_probability 连续 3 周下降。
- [ ] 监控训练完成率 < 60%、长期低 Capacity、高 Risk、伤病/中断、赛事临近。
- [ ] 输出 maintain / adjust target / extend timeline / change priority / add recovery block / switch focus。
- [ ] 关键调整必须用户确认。
- [ ] API：`GET /api/goals/{goal_id}/optimization`。
- [ ] API：`POST /api/goals/{goal_id}/confirm-adjustment`。
- [ ] 验收：概率下降时生成调整建议，输出 A/B/C Goal，确认后才落地。

## V3 Epic 4：Digital Athlete Graph

- [ ] 新增 `AthleteGraphNode` / `AthleteGraphEdge` 数据模型。
- [ ] 节点：fitness、fatigue、adaptation、risk、behavior、goal。
- [ ] 边：responds_well_to、high_fatigue_cost_from、risk_increases_when、prefers、goal。
- [ ] 计算训练特征总结：最有效刺激、高风险刺激、恢复模式、偏好、目标 profile。
- [ ] API：`GET /api/athlete-graph`。
- [ ] Athlete Graph 页面展示用户训练特征。
- [ ] 验收：记录训练刺激响应、疲劳成本、偏好、风险特征，并输出总结。

## V3 Epic 5：Adaptation Learning Engine 2.0

- [ ] 新增 `AdaptationScore` 数据模型。
- [ ] 跟踪训练刺激类型：easy、tempo、threshold、interval、vo2max、long、sweet spot、strength、mobility。
- [ ] 计算 fitness gain、fatigue cost、recovery time、next day capacity change、HRV/sleep response。
- [ ] adaptation_score = fitness_gain × adherence_modifier × subjective_quality / fatigue_cost。
- [ ] 输出每类训练的收益/成本和 confidence。

## V3 Epic 6：Autonomous Coach

- [ ] 新增 `AutonomousAction` 数据模型：action_type、payload、reason、requires_confirmation、status。
- [ ] 允许动作：生成周期、调整下周结构、重排错过训练、降低强度、插入恢复日、建议目标调整、解释长期规划、生成月报。
- [ ] 禁止动作：绕过安全规则、高风险安排高强度、医学判断、强制改目标、未经确认改 A Race、大幅增量。
- [ ] 建立每日/每周/月度执行流程。
- [ ] 所有动作必须可解释、可审计、可回滚。
- [ ] 验收：自动建议计划调整，但关键调整必须确认。

## V3 Epic 7：页面规划

- [ ] Season 页面：赛事列表、A/B/C Race、Season Blocks、当前阶段、下一个关键赛事。
- [ ] Planner 页面：月度周期、周负荷趋势、阶段、自动调整记录、未来 4 周计划。
- [ ] Athlete Graph 页面：有效刺激、高风险刺激、恢复模式、执行习惯、偏好。
- [ ] Goal Optimization 页面：原目标、当前预测、A/B/C Goal、推荐目标、调整原因、确认入口。

## 跨阶段工程任务

- [ ] 建立 seed/test fixtures：冷启动、正常数据、HRV 缺失、睡眠差、高风险、目标落后、疼痛反馈。
- [ ] 扩展 PRD 验收脚本覆盖 V2/V3 API。
- [ ] 建立引擎单元测试：prediction、goal gap、structured workout、scaling、recovery、planner、graph。
- [ ] 统一数据质量层：训练、睡眠、HRV、Garmin、Intervals 多源 merge 规则。
- [ ] 密钥加密：Intervals、Garmin、LLM API Key 不能长期明文保存。
- [ ] 增加用户确认/审计表，支撑 V3 autonomous actions。
- [ ] 明确 Pro 付费边界：V2 Goal/Performance/Structured Workout、V3 Planner/Graph/Autonomous Coach。
