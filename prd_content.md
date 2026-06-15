AthleteOS MVP v1.1 详细特性描述与 Agent 开发说明
0. 文档目的
本说明用于指导开发 agent 实现 AthleteOS MVP v1.1。
当前目标不是让 agent 自由设计产品，而是让 agent 严格按照本文定义实现第一阶段核心闭环：
连接数据源
→ 同步训练数据
→ 构建 Daily Athlete State
→ 计算 Training Capacity
→ 计算 Training Risk
→ 应用 Hard Safety Rules
→ 生成 Today 训练建议
→ 支持用户反馈后动态调整
→ 保存解释与决策日志
本文中出现的 MUST 表示必须实现；SHOULD 表示强烈建议实现；MUST NOT 表示禁止实现。

1. 产品边界与开发原则
1.1 MVP 要实现什么
MVP 只实现一个核心场景：
用户每天打开 AthleteOS 后，可以在 10 秒内知道今天该怎么练、为什么这样练、如果状态变化如何调整。
第一阶段必须实现：
Intervals.icu 数据接入
训练活动数据同步
Daily Athlete State 构建
Data Level 与 Data Quality 判断
Training Capacity Engine
Training Risk Engine
ACWR Engine
Monotony Engine
Hard Safety Rules
Daily Training Decision Engine
Dynamic Adjustment Engine
Explainable Decision Engine
Today 页面
Weekly Review 基础版
AI Coach 解释边界控制
用户反馈记录与调整建议保存
1.2 MVP 不实现什么
MVP 阶段禁止 agent 自行添加以下能力：
社交社区
排行榜
好友系统
视频课程
Marketplace
多人教练后台
完整年度训练计划自动生成
多赛事赛季规划
医学诊断
伤病治疗方案
AI 自由生成高强度训练计划
AI 绕过规则引擎直接给训练负荷建议
复杂大屏 Dashboard
与 Today 无关的复杂图表
如需展示图表，只能作为辅助信息，不能影响 MVP 核心闭环。

2. 统一命名规范
2.1 用户侧主指标
用户侧唯一主指标是：
Training Capacity
中文可显示为：
今日训练承受力
前端首页不得将 Readiness 与 Training Capacity 并列展示。
2.2 Readiness 命名限制
Readiness 只能作为内部子维度使用。
允许出现位置：
Debug 页面
Technical Detail Drawer
后端 state_json
开发日志
专业详情中的子项
禁止出现位置：
Today 首页主卡片
与 Training Capacity 平级的主指标
用户首次打开页面看到的位置
2.3 Injury Risk 命名限制
用户侧禁止出现：
Injury Risk
受伤概率
受伤风险 xx%
你会受伤
用户侧统一使用：
Training Risk
训练风险
内部字段可使用：
training_risk_score
training_risk_level
2.4 Dashboard 命名限制
首页必须命名为：
Today
中文可显示为：
今日训练
禁止将首页命名为：
Dashboard
数据看板
训练大屏

3. MVP 用户流程
3.1 首次使用流程
用户登录
→ 进入连接数据源页面
→ 连接 Intervals.icu
→ 系统同步历史 Activities
→ 系统计算 history_days / activity_count / data_level
→ 系统构建初始 Athlete Model
→ 系统生成今日 Daily Athlete State
→ 系统生成 Today Recommendation
→ 用户进入 Today 页面
3.2 每日使用流程
用户打开 Today
→ 查看 Training Capacity
→ 查看今日建议
→ 查看一句话解释
→ 查看 2-3 条关键原因
→ 用户选择：
   - 按计划训练
   - 太累了
   - 只有 30 分钟
   - 腿部不适
   - 换成骑行
   - 今天休息
   - 已完成
→ 系统记录反馈
→ 系统根据反馈生成调整建议
→ 用户完成训练后，下一次同步更新模型
3.3 每周复盘流程
每周结束
→ 汇总计划完成情况
→ 汇总 weekly_tss
→ 计算 load_change_vs_last_week
→ 识别训练风险变化
→ 生成 highlights / warnings
→ 生成下周建议
→ AI Coach 只负责把结果转化为用户可读总结

4. 数据源特性：Intervals.icu Sync
4.1 功能目标
系统需要从 Intervals.icu 获取用户训练数据，作为 AthleteOS 的主要训练数据来源。
4.2 必须同步的数据
每条 activity 至少包含：
{
  "provider_activity_id": "string",
  "sport": "running | cycling | swimming | strength | other",
  "start_time": "datetime",
  "duration_seconds": 3600,
  "distance_meters": 10000,
  "tss": 65,
  "intensity_factor": 0.78,
  "avg_hr": 145,
  "max_hr": 178,
  "avg_power": 230,
  "normalized_power": 245,
  "avg_pace": 295,
  "elevation_gain": 120,
  "raw_data": {}
}
4.3 同步规则
MUST：
支持首次全量同步。
支持后续增量同步。
根据 provider_activity_id 去重。
保存原始数据到 raw_data。
每次同步后更新 connected_accounts.last_sync_at。
同步失败时返回清晰错误，不得静默失败。
即使部分字段缺失，也要保存可用字段，并标记 data_quality。
SHOULD：
首次同步默认拉取最近 180 天数据。
如果 API 支持分页，必须处理分页。
如果 API 限流，必须有失败提示与重试机制。
开发环境可以使用 mock data，但不得替代真实 API 结构。
4.4 同步状态
前端 /connect/intervals 页面需要展示：
未连接
连接中
已连接
同步中
同步成功
同步失败
同步成功后展示：
已同步活动数量
最近同步时间
最早活动日期
最新活动日期
当前 data_level

5. Data Level 与 Cold Start
5.1 功能目标
系统必须根据历史训练数据充足度判断 data_level，避免在数据不足时给出过度自信、过度精确或过度激进的建议。
5.2 data_level 计算
根据有效训练历史天数判断：
5.3 有效训练历史天数定义
history_days 不是账号创建天数，而是：
latest_activity_date - earliest_activity_date + 1
如果用户有很多天无训练，也仍计入历史窗口，但 activity_count 会影响 confidence。
5.4 Cold Start 限制
当 data_level = D 时，MUST：
不生成 VO2Max 训练。
不生成 Threshold 训练。
不生成 Long Hard Session。
不展示 goal_probability。
不展示 performance prediction。
不输出“建议可信度较高”。
只允许生成 Rest、Recovery、Easy、Moderate Light。
当 data_level = C 时，MUST：
可以生成基础今日建议。
ACWR / Monotony 置信度不得为 high。
目标预测不得输出精确概率。
建议整体偏保守。
当 data_level = B 或 A 时，系统可以正常启用 Training Capacity 和 Training Risk，但仍必须遵守 Hard Safety Rules。
5.5 冷启动用户文案
data_level = D：
我们正在建立你的训练基线。当前建议会偏保守，随着训练数据积累，系统会更了解你的能力和恢复规律。
data_level = C：
当前已有部分训练数据，系统可以提供基础训练建议。由于长期趋势数据仍不足，建议会保持适度保守。
data_level = B：
已具备较稳定的训练判断能力，但部分长期趋势仍会继续优化。
data_level = A：
数据较充分，今日建议可信度较高。

6. Data Quality 与 Confidence
6.1 通用要求
所有核心指标必须带：
{
  "data_quality": "high | medium | low | insufficient",
  "confidence": 0.0
}
适用指标包括：
Training Capacity
Training Risk
ACWR
Monotony
Form
Sleep Score
HRV Score
Weekly Review
Daily Recommendation
6.2 confidence 范围
0 <= confidence <= 1
禁止输出：
NaN
Infinity
null confidence
大于 1
小于 0
6.3 用户侧 confidence 文案

7. Daily Athlete State Builder
7.1 功能目标
Daily Athlete State 是每天所有决策的基础。系统每天必须为每个用户生成一条 daily_athlete_states 记录。
7.2 输入数据
输入来源：
activities
connected_accounts
user_feedback
athlete_profiles
goals
wearable recovery data，如有
subjective fatigue，如有
7.3 输出字段
必须生成：
{
  "user_id": "uuid",
  "date": "date",
  "data_level": "A | B | C | D",
  "data_quality": {
    "overall": "high | medium | low | insufficient",
    "history_days": 56,
    "activity_count": 42,
    "missing_sleep_days_14d": 3,
    "missing_hrv_days_14d": 5
  },
  "fitness": 62,
  "fatigue": 71,
  "form": -9,
  "sleep_score": 83,
  "hrv_score": 78,
  "acwr": 1.12,
  "monotony": 1.7,
  "strain": 730,
  "adherence": 0.89,
  "subjective_fatigue": 3,
  "training_capacity": 76,
  "capacity_status": "Train Normally",
  "training_risk_score": 0.21,
  "training_risk_level": "low",
  "confidence": 0.82,
  "state_json": {}
}
7.4 缺失数据处理
MUST：
缺少 sleep_score 时，不得阻断整个状态生成。
缺少 hrv_score 时，不得阻断整个状态生成。
缺少 TSS 时，应尝试使用 duration、sport、intensity estimate 做保守估算。
若无法估算，相关指标标记为 insufficient。
所有缺失字段必须反映到 data_quality 和 confidence 中。

8. Training Capacity Engine
8.1 功能目标
Training Capacity 是今日训练建议的核心输入，表示用户今天能够承受训练刺激的综合能力。
8.2 输出范围
0 - 100
输出字段：
{
  "training_capacity": 76,
  "capacity_status": "Train Normally",
  "confidence": 0.82,
  "data_quality": "medium",
  "subscores": {
    "sleep": 83,
    "hrv": 78,
    "form": 72,
    "acwr": 80,
    "monotony": 65,
    "adherence": 89,
    "subjective_fatigue": 75,
    "recovery_trend": 78
  },
  "summary": "今天状态稳定，适合正常训练。"
}
8.3 状态映射
8.4 计算输入权重
默认权重：
8.5 缺失指标权重处理
当某个输入指标为 insufficient 时：
不得简单当作 0。
应从总权重中移除该项。
对剩余可用项重新归一化。
同时降低 overall confidence。
在 technical_reason 中说明缺失项。
示例：
HRV 数据缺失，今日 Training Capacity 未使用 HRV 子项，建议可信度略有下降。

9. Training Risk Engine
9.1 功能目标
Training Risk 用于识别近期训练负荷、疲劳、单调性、强度密度带来的训练风险。它不是医学诊断，也不是受伤概率。
9.2 输出字段
{
  "training_risk_score": 0.42,
  "training_risk_level": "moderate",
  "user_label": "训练风险略有上升",
  "confidence": 0.76,
  "data_quality": "medium",
  "main_factors": [
    {
      "factor": "acwr",
      "value": 1.38,
      "message": "近期训练负荷增长偏快"
    }
  ],
  "safe_recommendation": "建议今天避免过高负荷训练。"
}
9.3 分级规则
9.4 用户侧禁止表达
MUST NOT 输出：
受伤概率为 xx%
你会受伤
你已经受伤
这是某种疾病
可以带伤继续高强度
9.5 允许表达
允许输出：
训练风险偏高
近期负荷增长较快
恢复状态不足
建议降低强度
如已有疼痛或不适，请优先休息或咨询专业人士

10. ACWR Engine
10.1 计算方式
acute_load = 最近 7 天总 TSS
chronic_load = 最近 28 天总 TSS / 4
acwr = acute_load / chronic_load
10.2 分级
10.3 边界情况
10.3.1 history_days < 28
MUST：
data_quality = low 或 insufficient。
confidence 降低。
不作为强拦截依据。
可辅助判断近期负荷变化。
用户侧提示“长期基线不足”。
10.3.2 chronic_load = 0
MUST：
{
  "acwr": null,
  "risk_level": "insufficient",
  "data_quality": "insufficient",
  "confidence": 0,
  "message": "历史训练基线不足，暂无法计算 ACWR。"
}
MUST NOT：
除以 0
输出 Infinity
输出 NaN
输出极端风险结论
10.3.3 近期突然恢复训练
如果过去 28 天几乎无训练，但最近 7 天恢复训练，ACWR 可能异常偏高。
系统应输出：
数据基线不足，且近期负荷增长较快，建议保守增加训练量。
禁止输出：
你的受伤概率很高

11. Monotony Engine
11.1 计算方式
窗口：
最近 7 天
公式：
monotony = mean_daily_load / std_daily_load
daily_load 使用每日 TSS。
11.2 分级
11.3 边界情况
11.3.1 最近 7 天训练天数 < 3
MUST：
{
  "monotony": null,
  "risk_level": "insufficient",
  "data_quality": "insufficient",
  "confidence": 0,
  "message": "最近训练数据不足，暂不判断训练单调性。"
}
用户侧默认不展示 Monotony。
11.3.2 std_daily_load = 0
当每日负荷完全一样时：
MUST：
{
  "monotony": 3.0,
  "risk_level": "severe",
  "data_quality": "medium",
  "message": "最近训练负荷高度重复，建议增加轻重变化。"
}
MUST NOT 输出：
Infinity
NaN
11.3.3 大量休息日导致 weekly_tss 很低
如果 weekly_tss 很低，不能简单判断为高风险。
系统应输出：
近期训练量偏低，单调性判断参考价值有限。

12. Hard Safety Rules
12.1 执行优先级
Hard Safety Rules 是系统最高优先级。
执行顺序：
Hard Safety Rules
→ Training Risk Modifier
→ Training Capacity Decision
→ Goal Phase
→ Workout Generator
→ AI Coach Explanation
AI Coach、Goal Phase、Workout Generator 都不能推翻 Hard Safety Rules。
12.2 规则列表
Rule 1：Training Capacity Protection
条件：
training_capacity < 40
强制：
Recovery Day 或 Rest Day
禁止：
Interval
VO2Max
Threshold
Long Hard Session
Rule 2：Extreme Fatigue Protection
条件：
form < -25
禁止：
Interval
VO2Max
Threshold
High Intensity
建议：
Recovery Run
Recovery Ride
Rest Day
Mobility
Rule 3：ACWR Protection
条件：
acwr > 1.5
且 acwr.data_quality != insufficient
禁止：
High Intensity
继续增加周负荷
建议：
Easy Day
Recovery Day
降低未来 3-5 天负荷
Rule 4：Training Risk Protection
条件：
training_risk_score > 0.75
强制：
Recovery Protocol
Rule 5：Intensity Density Protection
条件：
连续 3 天高强度训练
强制：
Easy Day
Rule 6：Rest Day Protection
条件：
连续 7 天训练
强制：
Rest Day
Rule 7：Sleep Protection
条件：
连续 3 天 sleep_score < 60
禁止：
High Intensity
Rule 8：HRV Protection
条件：
连续 3 天 HRV 较个人基线下降超过 15%
强制：
Recovery Mode
12.3 Hard Safety 输出要求
如果触发任何 Hard Safety Rule，decision_json 必须记录：
{
  "hard_safety_triggered": true,
  "triggered_rules": [
    {
      "rule": "ACWR Protection",
      "condition": "acwr > 1.5",
      "value": 1.62,
      "action": "No High Intensity"
    }
  ]
}

13. Daily Training Decision Engine
13.1 功能目标
根据 Daily Athlete State、Hard Safety Rules、Training Risk、Training Capacity、Goal Phase、用户可用时间与偏好，生成今日训练建议。
13.2 输入字段
{
  "training_capacity": 76,
  "capacity_status": "Train Normally",
  "training_risk_score": 0.21,
  "training_risk_level": "low",
  "goal_phase": "build",
  "data_level": "B",
  "available_time_minutes": 60,
  "preferred_sport": "running",
  "recent_sessions": [],
  "hard_safety_flags": [],
  "user_feedback_today": null
}
13.3 Day Type 映射
13.4 Training Risk Modifier
13.5 Workout Type 生成范围
MVP 允许生成以下 workout_type：
Running：
rest_day
recovery_run
easy_run
steady_run
tempo_run
interval_run
long_easy_run
mobility
Cycling：
recovery_ride
easy_ride
endurance_ride
tempo_ride
sweet_spot_ride
interval_ride
indoor_easy_ride
Strength / Mobility：
mobility
core_strength
light_strength
13.6 禁止生成情况
当触发安全规则时，禁止生成不符合规则的 workout_type。
例如：
training_capacity < 40 时，不得生成 tempo_run、interval_run、long_easy_run。
training_risk_level = elevated 时，不得生成 interval_run。
form < -25 时，不得生成 threshold 或 VO2Max。
data_level = D 时，不得生成 VO2Max、Threshold、Long Hard Session。
13.7 输出字段
{
  "date": "2026-06-14",
  "day_type": "moderate",
  "recommendation": {
    "sport": "running",
    "type": "tempo_run",
    "title": "节奏跑",
    "duration_minutes": 50,
    "expected_tss": 65,
    "intensity": "moderate",
    "structure": {
      "warmup": "10min easy",
      "main_set": "20min threshold effort",
      "cooldown": "10min easy"
    }
  },
  "capacity": {
    "score": 76,
    "status": "Train Normally"
  },
  "training_risk": {
    "level": "low",
    "label": "训练风险较低"
  },
  "decision": {
    "confidence": 0.89,
    "hard_safety_triggered": false,
    "triggered_rules": [],
    "evidence": [
      "training_capacity=76",
      "form=-8",
      "acwr=1.10",
      "sleep_score=84"
    ],
    "user_friendly_reason": "今天整体状态稳定，近期负荷变化正常，适合安排一次中等强度训练。",
    "technical_reason": "Training Capacity 76, Form -8, ACWR 1.10, Sleep 84. No hard safety rule triggered."
  },
  "alternatives": [
    {
      "label": "太累了",
      "action": "reduce_intensity"
    },
    {
      "label": "只有30分钟",
      "action": "shorten_workout"
    },
    {
      "label": "换成骑行",
      "action": "change_sport_to_cycling"
    }
  ]
}

14. Dynamic Adjustment Engine
14.1 功能目标
今日建议不能是静态计划。用户反馈状态变化后，系统必须重新生成符合安全规则的调整建议。
14.2 用户反馈入口
Today 页面必须展示：
今天情况有变化？
[太累了] [只有30分钟] [腿部不适] [换成骑行] [今天休息] [已完成]
14.3 feedback_type 枚举
too_tired
not_enough_time
pain_or_discomfort
prefer_easy
change_sport
indoor_only
skip_today
completed_as_planned
completed_modified
completed_more
completed_less
illness
travel
stress_high
14.4 调整规则
14.5 强约束
用户反馈后仍必须重新检查 Hard Safety Rules。
例如：
用户选择“换成骑行”，但 training_capacity < 40，系统只能建议 recovery_ride 或 rest_day，不得生成 interval_ride。
14.6 调整输出
{
  "adjusted": true,
  "original_recommendation_id": "rec_123",
  "new_recommendation": {
    "sport": "running",
    "type": "easy_run",
    "title": "轻松跑",
    "duration_minutes": 40,
    "expected_tss": 35,
    "intensity": "easy"
  },
  "reason": "你反馈今天疲劳较高，因此将原本节奏跑调整为轻松跑。",
  "decision": {
    "hard_safety_triggered": false,
    "adjustment_reason": "too_tired",
    "confidence": 0.78
  }
}

15. Today 页面特性
15.1 页面定位
Today 是产品首页，不是复杂 Dashboard。
目标：
用户打开后立即知道今天该怎么练。
15.2 页面路由
/today
默认登录后跳转到 /today。
15.3 页面结构
第一屏必须包含：
日期
Training Capacity
Capacity Status
今日训练建议
时长
Expected TSS
一句话解释
反馈入口
15.4 Capacity Hero Card
字段：
Training Capacity
score
capacity_status
confidence_label
data_quality
trend_vs_yesterday
示例：
今日训练承受力
76
状态稳定，适合正常训练
比昨天 +4
建议可信度较高
15.5 Workout Recommendation Card
字段：
title
sport
type
duration_minutes
expected_tss
intensity
structure
示例：
今日建议
节奏跑
50 分钟
预计 TSS 65

训练结构：
热身 10 分钟轻松跑
主体 20 分钟节奏跑
放松 10 分钟轻松跑
15.6 Simple Explanation Card
必须不超过 3 条原因。
示例：
为什么今天这样练？
1. 昨晚睡眠恢复不错
2. 近期训练负荷稳定
3. 当前疲劳没有明显超标
15.7 Feedback Action Bar
按钮：
太累了
只有 30 分钟
腿部不适
换成骑行
今天休息
已完成
点击后调用：
POST /api/today/feedback
15.8 Technical Detail Drawer
默认折叠。
展开后展示：
CTL
ATL
Form
ACWR
Monotony
Strain
Sleep
HRV
Training Risk
Decision Confidence
Data Quality
Triggered Rules
15.9 空状态
如果用户未连接 Intervals.icu：
连接 Intervals.icu 后，AthleteOS 才能根据你的训练数据生成今日建议。
[连接 Intervals.icu]
如果同步成功但数据不足：
我们正在建立你的训练基线。当前建议会偏保守。
如果今日状态生成失败：
今日建议暂时无法生成，请稍后重试或重新同步数据。

16. Explanation Engine
16.1 功能目标
每条训练建议必须可解释。
必须生成两层解释：
用户友好版
专业详情版
16.2 用户友好版要求
MUST：
不超过 3 条关键原因。
不堆砌专业指标。
用行动导向语言。
不输出医学诊断。
不输出受伤概率。
示例：
今天建议轻松跑，因为近期负荷增长偏快，恢复状态一般。降低强度可以帮助你保持训练连续性。
16.3 专业详情版要求
MUST 包含：
Training Capacity
Form
ACWR
Monotony
Sleep Score
HRV Score
Training Risk
Confidence
Data Quality
Triggered Rules
16.4 explanation_json
{
  "simple": "今天状态稳定，适合安排一次中等强度训练。",
  "reasons": [
    "睡眠恢复较好",
    "近期训练负荷稳定",
    "当前疲劳处于可接受范围"
  ],
  "technical": {
    "training_capacity": 76,
    "form": -8,
    "acwr": 1.1,
    "monotony": 1.7,
    "sleep_score": 84,
    "hrv_score": 78,
    "training_risk_level": "low",
    "confidence": 0.89,
    "triggered_rules": []
  }
}

17. AI Coach 特性边界
17.1 AI Coach 允许做什么
AI Coach 只能基于系统已生成的 state、decision、evidence 做解释。
允许：
Explain：解释为什么这样练。
Educate：解释 ACWR、Form、TSS 等概念。
Summarize：总结本周训练。
Motivate：鼓励用户。
Q&A：回答与当前建议相关的问题。
17.2 AI Coach 禁止做什么
MUST NOT：
自行生成训练负荷。
自行生成高强度训练。
推翻 Hard Safety Rules。
推翻 Training Risk 判断。
推翻 Goal Phase 限制。
说用户可以带伤完成间歇训练。
输出医学诊断。
输出受伤概率。
忽略系统建议。
绕过 decision_json 重新决策。
17.3 AI Coach 输入
{
  "athlete_state": {},
  "daily_recommendation": {},
  "decision": {},
  "evidence": {},
  "hard_safety_flags": [],
  "user_question": "为什么今天不能跑间歇？"
}
17.4 AI Coach 输出示例
允许：
今天不建议跑间歇，是因为系统检测到近期负荷增长较快，同时恢复状态一般。降低强度可以帮助你保持训练连续性，避免影响后续关键训练。
禁止：
虽然系统建议恢复，但你可以试着完成 6 组高强度间歇。

18. Weekly Review
18.1 功能目标
每周生成一次训练总结，帮助用户理解本周训练完成情况、负荷变化、恢复趋势与下周建议。
18.2 输入
planned_sessions
completed_sessions
weekly_tss
running_load
cycling_load
strength_sessions
sleep_trend
hrv_trend
form_trend
acwr
monotony
user_feedback
skipped_sessions
18.3 输出
{
  "week_start": "2026-06-08",
  "week_end": "2026-06-14",
  "summary": "本周训练完成度较好，负荷增长稳定。",
  "adherence": 0.86,
  "weekly_tss": 430,
  "load_change_vs_last_week": 0.06,
  "training_risk_level": "moderate",
  "highlights": [
    "完成 6 次训练中的 5 次",
    "周负荷较上周增长 6%",
    "睡眠趋势稳定"
  ],
  "warnings": [
    "周末连续两天强度偏高，下周初建议恢复"
  ],
  "next_week_recommendation": "下周可以维持当前训练量，但建议控制高强度次数。"
}
18.4 页面路由
/weekly-review
18.5 展示内容
必须展示：
本周总结
完成率
Weekly TSS
负荷变化
Training Risk Level
Highlights
Warnings
下周建议

19. Goal Planning 基础版
19.1 MVP 范围
Goal Planning 在 MVP 中不是首页核心，但可以作为 /goals 页面存在。
MVP 只实现基础目标录入与展示。
用户可录入：
primary_goal
goal_date
goal_time
primary_sport
weekly_available_days
preferred_sports
19.2 data_level 限制
当 data_level < B 时：
MUST NOT 展示精确 goal_probability。
展示文案：
当前历史数据还不足以可靠评估目标达成概率。系统会继续积累训练数据，并在数据更充分后给出目标可行性分析。
19.3 Goal Feasibility 输出
仅当 data_level >= B 时允许输出：
{
  "goal_grade": "B",
  "goal_probability": 0.71,
  "required_improvement_seconds": 420,
  "expected_improvement_seconds": 300,
  "confidence": 0.72,
  "data_quality": "medium",
  "goal_options": {
    "goal_a": "01:40:00",
    "goal_b": "01:43:00",
    "goal_c": "01:46:00"
  }
}

20. API 设计
20.1 获取 Today 页面
GET /api/today
Response：
{
  "date": "2026-06-14",
  "training_capacity": {
    "score": 76,
    "status": "Train Normally",
    "confidence": 0.82,
    "data_quality": "medium",
    "confidence_label": "建议可信度较高"
  },
  "training_risk": {
    "level": "low",
    "label": "训练风险较低"
  },
  "recommendation": {
    "id": "rec_123",
    "sport": "running",
    "type": "tempo_run",
    "title": "节奏跑",
    "duration_minutes": 50,
    "expected_tss": 65,
    "intensity": "moderate",
    "structure": {
      "warmup": "10min easy",
      "main_set": "20min threshold effort",
      "cooldown": "10min easy"
    }
  },
  "explanation": {
    "simple": "今天状态稳定，适合安排一次中等强度训练。",
    "reasons": [
      "睡眠恢复较好",
      "近期训练负荷稳定",
      "当前疲劳处于可接受范围"
    ],
    "technical": {
      "form": -8,
      "acwr": 1.1,
      "monotony": 1.7,
      "sleep_score": 84,
      "hrv_score": 78,
      "confidence": 0.89,
      "triggered_rules": []
    }
  },
  "feedback_options": [
    "too_tired",
    "not_enough_time",
    "pain_or_discomfort",
    "change_sport",
    "skip_today",
    "completed_as_planned"
  ],
  "disclaimer": "AthleteOS 提供训练建议和数据分析，不构成医疗建议。"
}
20.2 提交用户反馈
POST /api/today/feedback
Request：
{
  "recommendation_id": "rec_123",
  "feedback_type": "too_tired",
  "subjective_fatigue": 8,
  "pain": false,
  "available_time_minutes": 40,
  "preferred_sport": "running",
  "note": "昨晚睡得不好"
}
Response：
{
  "adjusted": true,
  "new_recommendation": {
    "id": "rec_456",
    "sport": "running",
    "type": "easy_run",
    "title": "轻松跑",
    "duration_minutes": 40,
    "expected_tss": 35,
    "intensity": "easy"
  },
  "reason": "你反馈今天疲劳较高，因此将原本节奏跑调整为轻松跑。",
  "decision": {
    "confidence": 0.78,
    "hard_safety_triggered": false,
    "adjustment_reason": "too_tired"
  }
}
20.3 获取每日状态详情
GET /api/state/daily?date=2026-06-14
20.4 获取最新周报
GET /api/weekly-review/latest
20.5 同步 Intervals.icu
POST /api/sync/intervals
Response：
{
  "success": true,
  "synced_activities": 42,
  "new_activities": 3,
  "updated_activities": 0,
  "last_sync_at": "2026-06-14T08:00:00Z"
}

21. 数据库与审计要求
21.1 daily_recommendations 必须保存 decision_json
每条建议必须可追溯。
decision_json 至少包含：
{
  "input_state_id": "state_123",
  "training_capacity": 76,
  "training_risk_score": 0.21,
  "training_risk_level": "low",
  "data_level": "B",
  "hard_safety_triggered": false,
  "triggered_rules": [],
  "day_type_before_modifier": "moderate",
  "day_type_after_modifier": "moderate",
  "selected_workout_type": "tempo_run",
  "confidence": 0.89,
  "evidence": [
    "training_capacity=76",
    "form=-8",
    "acwr=1.10",
    "sleep_score=84"
  ]
}
21.2 用户反馈必须保存
user_feedback 必须保存：
recommendation_id
feedback_type
subjective_fatigue
pain
pain_area
available_time_minutes
preferred_sport
note
created_at
21.3 调整建议必须保留原始建议关联
如果用户反馈后生成新建议：
原建议 status 改为 adjusted。
新建议 status 为 active。
新建议 decision_json 里记录 original_recommendation_id。
不得覆盖原建议内容。

22. 前端页面列表
第一阶段页面：
/today
/connect/intervals
/history
/weekly-review
/goals
/settings
/debug/state
22.1 /debug/state 限制
/debug/state 仅开发环境可访问。
展示：
raw athlete_state
capacity subscores
risk factors
triggered rules
decision_json
raw API data sample
生产环境默认隐藏。

23. UI 风格要求
23.1 整体风格
MVP UI 应采用：
现代简约
清爽
低饱和
淡绿色主色调
卡片式布局
移动端优先
23.2 Today 页面重点
Today 页面不是数据炫技页。
优先级：
行动建议 > 解释 > 专业指标
专业指标必须折叠，不得抢占第一屏。
23.3 中文优先
由于目标用户主要为中国用户，页面主文案应使用中文。
指标名可保留英文缩写：
TSS
CTL
ATL
Form
ACWR
HRV
FTP
但必须提供中文解释或上下文。

24. 安全与免责声明
24.1 全局免责声明
产品必须展示基础免责声明：
AthleteOS 提供训练建议和数据分析，不构成医疗建议。如果你有明显疼痛、伤病、胸闷、头晕或其他异常症状，请停止训练并咨询专业人士。
24.2 pain_or_discomfort 特殊处理
当用户反馈 pain_or_discomfort 时：
MUST：
降低训练建议。
禁止跑步高强度。
优先建议 Rest、Recovery、Mobility 或低冲击运动。
输出安全提示。
不得输出治疗方案。
允许文案：
你反馈有不适，今天建议优先恢复，避免跑步高强度。如果不适持续或加重，请咨询专业人士。

25. 验收场景
25.1 场景 1：正常训练日
输入：
{
  "training_capacity": 76,
  "form": -8,
  "acwr": 1.10,
  "training_risk_level": "low",
  "sleep_score": 84,
  "data_level": "B"
}
期望：
day_type = moderate
可生成 tempo_run 或 steady_run
不得触发 Hard Safety
Today 展示 Training Capacity 76
解释不超过 3 条
25.2 场景 2：Training Capacity 低
输入：
{
  "training_capacity": 35,
  "data_level": "B"
}
期望：
强制 Recovery Day 或 Rest Day
不得生成 interval_run / tempo_run / threshold
decision_json 记录 Training Capacity Protection
25.3 场景 3：Form 极低
输入：
{
  "training_capacity": 65,
  "form": -30
}
期望：
禁止高强度
推荐 Recovery Run / Recovery Ride / Rest Day
decision_json 记录 Extreme Fatigue Protection
25.4 场景 4：ACWR chronic_load = 0
输入：
{
  "acute_load_7d": 200,
  "chronic_load_28d_weekly_avg": 0
}
期望：
acwr = null
data_quality = insufficient
不输出 Infinity / NaN
不作为强拦截依据
输出“历史训练基线不足”
25.5 场景 5：Monotony std = 0
输入：
{
  "daily_loads_7d": [50, 50, 50, 50, 50, 50, 50]
}
期望：
monotony = 3.0
risk_level = severe
不输出 Infinity / NaN
提示训练负荷高度重复
25.6 场景 6：用户反馈太累
原建议：
{
  "type": "tempo_run",
  "duration_minutes": 50,
  "expected_tss": 65
}
反馈：
{
  "feedback_type": "too_tired",
  "subjective_fatigue": 8
}
期望：
调整为 easy_run 或 recovery_run
duration 和 expected_tss 下降
保存 user_feedback
生成新 recommendation
原 recommendation 不被覆盖
25.7 场景 7：用户反馈腿部不适
反馈：
{
  "feedback_type": "pain_or_discomfort",
  "pain": true,
  "pain_area": "left knee"
}
期望：
禁止跑步高强度
建议休息、恢复、mobility 或低冲击骑行
输出非医疗免责声明
不得输出伤病诊断
25.8 场景 8：data_level = D
输入：
{
  "history_days": 7,
  "activity_count": 3
}
期望：
data_level = D
只生成保守建议
不生成 VO2Max / Threshold / Long Hard
不展示 goal_probability
confidence 较低
显示冷启动文案
25.9 场景 9：AI Coach 被问“我能不能硬跑间歇？”
当前状态：
{
  "training_risk_level": "elevated",
  "triggered_rules": ["ACWR Protection"]
}
期望 AI 输出：
不建议。近期训练负荷增长较快，系统建议避免高强度。今天更适合轻松训练或恢复。
禁止 AI 输出：
可以硬跑
忽略系统建议
带伤完成训练

26. Agent 开发任务顺序
开发 agent 应按以下顺序实现，不得先做复杂 UI 或高级 AI：
Step 1：数据模型与基础 API
users
athlete_profiles
connected_accounts
activities
daily_athlete_states
daily_recommendations
user_feedback
weekly_reviews
Step 2：Intervals.icu Sync
连接配置
activities 同步
去重
last_sync_at
mock data 支持
Step 3：Daily State Builder
data_level
data_quality
fitness / fatigue / form
ACWR
Monotony
Training Risk
Training Capacity
Step 4：Decision Engine
Hard Safety Rules
Day Type
Risk Modifier
Workout Generator
Explanation
decision_json 保存
Step 5：Today 页面
Capacity Card
Recommendation Card
Explanation Card
Feedback Buttons
Technical Drawer
Empty State
Step 6：Dynamic Adjustment
user_feedback 保存
adjustment_engine
new recommendation
original recommendation status 更新
调整原因展示
Step 7：Weekly Review
weekly aggregation
highlights
warnings
next_week_recommendation
Step 8：AI Coach
只读 state / decision / evidence
解释与总结
安全输出限制
禁止覆盖规则

27. Agent 禁止自行发挥清单
开发过程中，agent 不得自行加入：
Dashboard 首页
Readiness 主指标
Injury Risk 用户展示
受伤概率百分比
医学诊断
自由聊天式 AI 教练
AI 自动生成高强度训练
绕过 Hard Safety Rules 的建议
社交功能
排行榜
复杂年度规划
高级预测图表
未定义的训练类型
未定义的反馈类型
覆盖原始 recommendation 的调整方式
NaN / Infinity 指标输出
没有 confidence 的训练建议
没有 decision_json 的训练建议

28. MVP 完成标准
当以下条件全部满足时，MVP 才算完成：
用户可以连接 Intervals.icu。
系统可以同步训练活动。
系统可以生成每日 Daily Athlete State。
系统可以计算 Training Capacity。
系统可以计算 Training Risk。
ACWR 和 Monotony 已处理边界情况。
Hard Safety Rules 可以正确拦截高风险训练。
Today 页面可以展示今日训练建议。
Today 页面可以展示简洁解释。
用户可以提交反馈。
系统可以根据反馈调整今日建议。
所有建议都有 confidence。
所有建议都有 decision_json。
AI Coach 只能解释，不能重新决策。
用户侧不出现受伤概率或医学诊断。
数据不足时系统会保守建议。
Weekly Review 可以生成基础周报。
首页命名为 Today，不是 Dashboard。
Training Capacity 是唯一用户主指标。
Readiness 不在首页作为主指标展示。

29. 给开发 agent 的最终执行指令
请严格按照本文实现 AthleteOS MVP v1.1。
优先完成核心闭环，不要先做复杂图表、复杂 AI 或高级预测。
所有训练建议必须来自规则引擎、运动科学指标、用户状态和安全规则。AI Coach 只能解释系统已经生成的决策，不能直接决定训练负荷。
Today 是产品首页。Training Capacity 是用户唯一主指标。Readiness 只能作为内部子维度。用户侧统一使用 Training Risk，不展示 Injury Risk 或受伤概率。
所有核心指标必须包含 data_quality 和 confidence。ACWR、Monotony 等指标必须处理历史不足、除零、标准差为零等边界情况，禁止输出 NaN 或 Infinity。
每条训练建议必须保存 decision_json，用于审计、调试和回溯。用户反馈后不得覆盖原建议，必须生成新的 adjusted recommendation，并保留原建议关联。
MVP 的成功标准不是“数据展示得多”，而是用户每天打开 Today 后，可以清楚知道：
今天该练什么
为什么这样练
如果今天状态变化，如何调整
这次训练是否安全
本周训练是否在正确方向上
data_level | 条件 | 系统行为
D | history_days < 14 | 只做保守建议，不做强预测
C | 14 <= history_days <= 41 | 基础建议，置信度偏低或中等
B | 42 <= history_days <= 89 | 可生成较可靠建议
A | history_days >= 90 | 完整启用主要分析能力
confidence | 用户文案
> 0.8 | 建议可信度较高
0.6 - 0.8 | 建议可信度中等
0.4 - 0.6 | 建议仅供参考
< 0.4 | 数据不足，建议保守处理
分数 | capacity_status | 用户说明 | 训练方向
81-100 | Ready To Push | 状态很好，可以安排高质量训练 | Hard / Quality
61-80 | Train Normally | 状态稳定，适合正常训练 | Moderate
41-60 | Reduce Intensity | 状态一般，建议降低强度 | Easy
0-40 | Recovery Required | 恢复优先，建议休息或恢复训练 | Recovery / Rest
维度 | 权重
Sleep Score | 20%
HRV Score | 10%
Form Score | 15%
ACWR Score | 10%
Monotony Score | 10%
Adherence Score | 15%
Subjective Fatigue Score | 10%
Recovery Trend Score | 10%
score | level | 用户文案
< 0.25 | low | 训练风险较低
0.25 - 0.50 | moderate | 训练风险略有上升
0.50 - 0.75 | elevated | 训练风险偏高，建议避免高强度
> 0.75 | high_caution | 训练风险较高，建议恢复优先
ACWR | level
< 0.8 | underload
0.8 - 1.3 | optimal
1.3 - 1.5 | elevated
> 1.5 | high
Monotony | level
< 1.5 | healthy
1.5 - 2.0 | warning
2.0 - 2.5 | high
> 2.5 | severe
Training Capacity | day_type
> 80 | hard
61 - 80 | moderate
41 - 60 | easy
<= 40 | recovery
training_risk_level | 调整
low | 不调整
moderate | 降低负荷上限，避免过高 TSS
elevated | 禁止 high intensity
high_caution | recovery day
用户反馈 | 系统动作
too_tired | 降低强度一级，减少 expected_tss
not_enough_time | 缩短时长，尽量保留训练目的
pain_or_discomfort | 禁止跑步高强度，建议休息、恢复或非冲击运动
change_sport | 在安全范围内转换为等效骑行或其他项目
indoor_only | 转换为室内骑行、跑步机轻松跑或 mobility
skip_today | 记录跳过原因，今日不再推强训练
completed_as_planned | 更新 adherence
completed_modified | 记录实际完成情况，后续模型调整
completed_more | 更新负荷并检查未来风险
completed_less | 更新执行率，后续适度调整
illness | 建议休息，不生成强度训练
travel | 生成短时、低复杂度训练
stress_high | 降低强度，优先恢复
