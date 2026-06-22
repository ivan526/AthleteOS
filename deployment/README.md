# AthleteOS 生产部署

该方案适合最初的小规模邀请测试：单台 Linux 服务器、Docker Compose、
Caddy 自动 HTTPS，以及持久化 SQLite。正式开放大规模注册或运行多个后端
实例前，应迁移到 PostgreSQL 和任务队列。

## 前置条件

- Ubuntu 22.04/24.04 或其他支持 Docker 的 Linux
- 一个域名，A 记录指向服务器公网 IP
- 云防火墙开放 TCP 22、80、443
- 建议至少 2 核 CPU、2 GB 内存和 20 GB 磁盘
- Node.js 20+（仅直接运行 `deployment/update-server.sh` 时需要）

## 1. 安装 Docker

按照 Docker 官方文档为服务器安装 Docker Engine 和 Compose Plugin：

```bash
docker --version
docker compose version
```

## 2. 克隆国内镜像

```bash
sudo mkdir -p /opt/athleteos
sudo chown "$USER":"$USER" /opt/athleteos
git clone https://gitee.com/ivan_yuuu/athlete-os.git /opt/athleteos
cd /opt/athleteos
```

## 3. 配置域名与密钥

```bash
cp deployment/.env.production.example deployment/.env.production
openssl rand -hex 32
openssl rand -hex 32
```

编辑 `deployment/.env.production`：

- `DOMAIN` 与 `CORS_ORIGINS` 改成真实 HTTPS 域名。
- `COOKIE_SECURE` 在 HTTPS 部署中保持 `true`。仅临时使用公网 IP + HTTP
  调试时设为 `false`，域名可用后应立即恢复。
- 第一段随机值写入 `JWT_SECRET`。
- 第二段随机值写入 `CREDENTIAL_ENCRYPTION_KEY`。该值必须是完整的 64 位
  十六进制字符串；也兼容解码后恰好 32 字节的 Base64 字符串。
- 不要提交 `.env.production`。
- 邀请测试阶段建议先设置 `ALLOW_REGISTRATION=false`，需要创建新用户时短暂
  开启注册，完成后再关闭。

如需保留当前本地训练数据，在首次启动前复制数据库：

```bash
mkdir -p deployment/data
scp backend/prisma/dev.db user@server:/opt/athleteos/deployment/data/athleteos.db
```

同时设置 `LEGACY_USER_ID` 和 `LEGACY_USER_EMAIL`。使用该邮箱注册时，系统会
将登录账户绑定到原有用户和训练数据，而不是创建空账户。

现有数据库中的数据源凭证已经加密。如果复制本地数据库，生产环境必须使用
本地 `backend/.env` 中相同的 `CREDENTIAL_ENCRYPTION_KEY`，不能重新生成，
否则原有 Intervals、Garmin 和 LLM 凭证将无法解密。新建空数据库时才生成新
密钥。

## 4. 启动

```bash
cd /opt/athleteos
docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  up -d --build
```

Caddy 会自动申请并续期 TLS 证书。

```bash
docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  ps

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  logs -f --tail=200
```

验证公网服务：

```bash
curl -fsS "https://你的域名/"
curl -i "https://你的域名/api/settings"
```

第一条应返回健康信息，第二条在未登录时应返回 `401`。浏览器访问域名后，
使用邮箱完成注册或登录。

## 5. 防火墙与运维

- 云安全组只开放 `22`、`80`、`443`，不要直接暴露 `3007`。
- SSH 建议关闭密码登录，只保留密钥登录。
- 定期备份 `deployment/data/athleteos.db` 和
  `deployment/.env.production`，两者应分开加密保存。
- 不要在日志、工单或截图中泄露 Refresh Token、数据源密码和 API Key。
- `/api/test/*` 在 `NODE_ENV=production` 下返回 `404`。

## 更新

```bash
cd /opt/athleteos
git pull --ff-only
docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  up -d --build
```

后端容器启动前会自动执行 Prisma migration。

## 版本边界

当前方案适用于一台服务器、一个后端实例和小规模邀请测试。准备公开发布时，
下一步应迁移 PostgreSQL、增加邮件验证与找回密码、后台用户停用、登录审计
查询、数据库自动备份和异步同步任务队列。

## 备份

SQLite 初期只能运行一个后端实例。建议在短暂停机窗口备份：

```bash
docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  stop backend

cp deployment/data/athleteos.db \
  "deployment/data/athleteos-$(date +%Y%m%d-%H%M%S).db"

docker compose \
  --env-file deployment/.env.production \
  -f deployment/docker-compose.prod.yml \
  start backend
```
