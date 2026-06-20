# AthleteOS

AthleteOS 是一个面向耐力运动用户的个人训练决策系统。它聚合 Garmin
中国区与 Intervals.icu 的活动、睡眠和恢复数据，计算训练能力与风险，
生成受安全规则约束的每日训练建议，并通过可选的 AI Coach 提供解释和总结。

> AthleteOS 提供的是训练决策支持，不构成医疗诊断或治疗建议。

## 当前能力

- **多数据源同步**
  - Garmin 中国区：活动、睡眠、HRV、静息心率、训练负荷与训练效果
  - Intervals.icu：活动、TSS、CTL、ATL、Form 及恢复数据补充
  - 同日不同项目分别保留，同一活动按项目、时间、时长和距离跨源去重
  - 每天首次打开应用时自动执行增量同步，也支持设置页手动同步
- **训练模型**
  - Training Capacity、Training Risk、ACWR、Monotony、Strain
  - 睡眠、HRV、主观疲劳和数据完整度参与可信度计算
  - Hard Safety Rules 优先于训练建议和 AI 输出
- **多运动训练建议**
  - 支持跑步、骑行、游泳和力量训练
  - 每个项目拥有独立训练模板、训练结构、强度与预计 TSS
  - 用户可在今日页面切换运动项目，也可持久化主要项目和偏好项目
- **训练反馈**
  - 支持疲劳、时间不足、疼痛或不适、换运动、休息和完成反馈
  - 调整结果持久化，页面刷新后不会丢失
  - 疼痛反馈强制进入恢复或灵活性训练，不允许 LLM 覆盖安全结果
- **训练历史与分析**
  - 展示真实活动，不生成模拟训练记录
  - 跑步展示配速、步频、跑步功率和效率指标
  - 骑行展示速度、踏频、功率、机械功和功率波动等专项指标
  - 单次训练提供高级数据及 AI Coach 训练效果、收益、注意点和恢复评价
- **AI Coach**
  - 支持 OpenAI-compatible Provider、模型、Base URL 和 API Key 配置
  - 用于训练解释、反馈解释、单次训练评价、周报总结和问答
  - 内置 24 小时缓存、安全过滤、规则回退和审计日志
  - LLM 只负责解释与总结，不直接决定训练负荷
- **客户端**
  - React Web 应用
  - 独立 HarmonyOS NEXT 原生客户端：
    [AthleteOS-HarmonyOS](https://github.com/ivan526/AthleteOS-HarmonyOS)
- **用户与数据隔离**
  - 邮箱密码注册、登录、退出和会话刷新
  - 短期 Access Token + 可撤销 Refresh Session
  - 每个用户独立保存活动、恢复、建议、数据源和 LLM 配置
  - 数据源密码与 API Key 使用 AES-256-GCM 加密后入库

## 技术栈

### Backend

- NestJS 11 + TypeScript
- Prisma ORM + SQLite
- Jest
- Python `garminconnect` 非官方开源库

### Frontend

- React 19 + TypeScript
- Vite 8
- Tailwind CSS
- React Router

## 项目结构

```text
AthleteOS/
├── backend/                    # API、同步、训练模型和数据库
│   ├── prisma/                 # Prisma schema、迁移和 SQLite 数据库
│   ├── scripts/                # Garmin 数据同步 worker
│   └── src/modules/
│       ├── athlete/            # 训练能力、风险和安全规则
│       ├── sync/               # Garmin / Intervals.icu 同步与去重
│       └── training/           # 建议生成、反馈和 AI Coach
├── frontend/                   # React Web 客户端
├── scripts/                    # 初始化和 PRD 验收脚本
├── tasks/                      # 已完成任务与后续任务清单
└── doc/                        # 产品与 UI 参考文档
```

## 环境要求

- Node.js 20+
- npm 10+
- Python 3.10+
- SQLite 3

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
python3 -m pip install -r requirements.txt

cd ../frontend
npm install
```

### 2. 配置数据库

在 `backend/.env` 中至少配置：

```dotenv
DATABASE_URL="file:./dev.db"
JWT_SECRET="请替换为至少32位随机字符串"
CREDENTIAL_ENCRYPTION_KEY="请替换为32字节随机密钥"
```

然后生成 Prisma Client 并执行迁移：

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

仓库中的 `backend/.env` 仅用于本地开发。不要提交真实 API Key、密码或
LLM 凭证；数据源和 LLM 凭证建议在应用设置页中保存。

首次把已有单用户数据库升级为多用户时，可临时设置：

```dotenv
LEGACY_USER_ID="原用户ID"
LEGACY_USER_EMAIL="用于注册认领旧数据的邮箱"
```

使用该邮箱完成第一次注册后，旧活动和数据源配置会绑定到这个登录账户。
完成认领后可从生产环境中移除这两个变量。

### 3. 启动后端

```bash
cd backend
npm run start:dev
```

默认地址：

- 本机：`http://127.0.0.1:3007`
- 局域网：`http://<电脑局域网IP>:3007`

可通过环境变量覆盖监听地址：

```bash
HOST=0.0.0.0 PORT=3007 npm run start:dev
```

### 4. 启动前端

打开另一个终端：

```bash
cd frontend
npm run dev
```

访问 `http://127.0.0.1:3000`。Vite 会把 `/api` 代理到
`http://127.0.0.1:3007`，因此前端和后端需要同时运行。

局域网设备可以访问 `http://<电脑局域网IP>:3000`。

## 数据源配置

启动应用后进入「设置」：

1. 配置 Intervals.icu Athlete ID 和 API Key。
2. 配置 Garmin Connect 邮箱、密码和区域。
3. 中国区账号选择 `garmin.cn`。
4. 保存后执行同步。

同步策略：

- Garmin 中国区作为中国区用户的主要活动与恢复数据源。
- Intervals.icu 用于补充 TSS、活动和可用恢复指标。
- 两边同一天存在不同运动时都会保留，例如 Garmin 跑步与
  Intervals.icu 骑行。
- Garmin 登录令牌保存在本地 token store，密码不会写入活动原始数据。

`garminconnect` 是非官方接口封装，可能受到 Garmin 登录策略、验证码或接口
变化影响，不适合作为无监控的高可用商业数据通道。

## AI Coach 配置

在「设置 > AI Coach」中配置：

- Provider
- Model
- Base URL
- API Key
- 是否启用

目前支持 OpenAI-compatible、OpenAI、DeepSeek、火山引擎和本地兼容接口。
未启用、调用失败或输出触发安全过滤时，系统自动使用规则引擎生成的文本。

## 测试与验收

后端单元测试：

```bash
cd backend
npm test -- --runInBand
```

构建：

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

启动后端后执行 PRD 验收场景：

```bash
BASE_URL=http://127.0.0.1:3007 bash scripts/prd-acceptance-test.sh
```

验收脚本使用纯计算场景验证反馈和安全规则，不会写入真实用户反馈。

## 局域网与移动端

开发环境默认允许局域网访问。真机上的 `127.0.0.1` 指向手机自身，
HarmonyOS 客户端调试时应填写电脑的局域网地址，例如：

```text
http://192.168.1.10:3007
```

正式发布移动端时应使用公网 HTTPS 后端。当前 HarmonyOS 客户端仍采用
客户端加 AthleteOS API 的架构，不应依赖用户家中电脑长期在线。

Web 使用 HttpOnly Refresh Cookie；HarmonyOS 客户端使用移动端刷新令牌，
会在 Access Token 过期后自动续期。服务端会校验可撤销会话，而不是只验证
JWT 签名。

## 公网部署

仓库已提供 Docker Compose + Caddy 自动 HTTPS 的单机部署方案，详见
[deployment/README.md](deployment/README.md)。初次邀请测试可继续使用
SQLite 单实例；开放注册或部署多个后端实例前应迁移到 PostgreSQL，并增加
邮件验证、找回密码、后台封禁与审计管理。

## 当前边界

- 尚未保存活动 lap/分段明细，高级数据目前为活动级指标。
- 外部训练计划日历和目标周期仍未完整接入。
- Garmin 同步依赖非官方开源库，需关注接口稳定性。
- SQLite 适合当前单用户与本地部署；多用户生产部署建议迁移到 PostgreSQL。
- 当前已实现账户认证和用户数据隔离，尚未实现邮件验证、找回密码和管理员后台。
- AI Coach 不得覆盖 Hard Safety Rules，不进行医疗诊断，也不得建议忽略疼痛。

## 安全声明

训练建议应结合个人感受、环境和专业教练意见使用。出现持续疼痛、胸闷、
眩晕或其他异常症状时，应立即停止训练并咨询专业医疗人员。
