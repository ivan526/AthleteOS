# AthleteOS 公网服务器运维

这份文档放在服务器仓库内：

```bash
/home/ubuntu/workspace/athlete-os/deployment/SERVER_OPERATIONS.md
```

当前服务器：

- 公网入口：`http://182.254.225.235`
- 备案域名：已备案；执行“域名备案完成后”章节时，把 `<domain>` 替换为正式域名
- 系统：Ubuntu 22.04
- 代码目录：`/home/ubuntu/workspace/athlete-os`
- 前端目录：`/var/www/athleteos`
- 后端服务：`athleteos-backend.service`
- 后端监听：`127.0.0.1:3007`
- 反向代理：Nginx
- 数据库：`backend/prisma/dev.db`
- 备份目录：`/home/ubuntu/backups`

当前仍使用公网 IP + HTTP。启用正式域名和 HTTPS 后，生产服务中的
`COOKIE_SECURE=false` 必须恢复为 `true`。

## 登录服务器

```bash
ssh ubuntu@182.254.225.235
cd /home/ubuntu/workspace/athlete-os
```

优先使用 SSH key 登录。密码登录只作为临时备用方式，服务器密码不要写入 Git
仓库、脚本或聊天记录中。

## 速查命令

```bash
# 发布最新代码
cd /home/ubuntu/workspace/athlete-os
bash deployment/update-server.sh

# 重启后端
sudo systemctl restart athleteos-backend

# 查看后端状态
sudo systemctl status athleteos-backend --no-pager

# 实时后端日志
sudo journalctl -u athleteos-backend -f

# 检查 Nginx 配置并重载
sudo nginx -t
sudo systemctl reload nginx

# 健康检查
curl http://127.0.0.1/healthz
curl http://182.254.225.235/healthz
```

## 日常检查

```bash
cd /home/ubuntu/workspace/athlete-os
git status --short
git rev-parse --short HEAD
sudo systemctl status athleteos-backend --no-pager
sudo systemctl status nginx --no-pager
curl -I http://127.0.0.1/
curl http://127.0.0.1/healthz
```

后端日志：

```bash
sudo journalctl -u athleteos-backend -n 200 --no-pager
sudo journalctl -u athleteos-backend -f
```

Nginx 日志：

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 发布更新

本地代码修改后，先在本机提交并同步 GitHub、Gitee：

```bash
cd /Users/ivan/projects/work/AthleteOS
npm --prefix backend test -- --runInBand
npm --prefix backend run build
npm --prefix frontend run build
git status
git add .
git commit -m "<change summary>"
git push origin master
git push gitee master
```

服务器当前从 Gitee 拉取生产代码，所以必须确保 `git push gitee master` 成功。

然后在服务器执行：

```bash
cd /home/ubuntu/workspace/athlete-os
bash deployment/update-server.sh
```

更新脚本要求 Node.js 20 或更高版本。如果非交互 SSH 环境中的系统 Node 版本
较旧，脚本会自动选择 `$HOME/.nvm/versions/node` 中版本最高的可用 Node。

脚本会依次：

1. 检查服务器工作区是否干净。
2. 备份数据库、环境变量和当前提交号。
3. 从 Gitee 的 `master` 分支拉取更新。
4. 安装依赖并执行 Prisma migration。
5. 构建后端和前端。
6. 发布前端并重启后端、重载 Nginx。
7. 执行本机健康检查。

发布完成后确认：

```bash
git rev-parse --short HEAD
sudo systemctl is-active athleteos-backend
curl http://127.0.0.1/healthz
curl http://182.254.225.235/healthz
```

## 服务操作

```bash
sudo systemctl restart athleteos-backend
sudo systemctl stop athleteos-backend
sudo systemctl start athleteos-backend
sudo nginx -t
sudo systemctl reload nginx
```

修改 systemd 配置后：

```bash
sudo systemctl daemon-reload
sudo systemctl restart athleteos-backend
```

## 配置文件

后端环境变量：

```bash
/home/ubuntu/workspace/athlete-os/backend/.env
```

systemd 服务：

```bash
/etc/systemd/system/athleteos-backend.service
```

Nginx 站点配置通常在：

```bash
/etc/nginx/sites-available/athleteos
/etc/nginx/sites-enabled/athleteos
```

修改 `.env` 后重启后端；修改 Nginx 后先 `sudo nginx -t`，再 reload。

## 数据备份

手工备份：

```bash
cd /home/ubuntu/workspace/athlete-os
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "/home/ubuntu/backups/athleteos-$stamp"
cp backend/prisma/dev.db "/home/ubuntu/backups/athleteos-$stamp/dev.db"
cp backend/.env "/home/ubuntu/backups/athleteos-$stamp/backend.env"
chmod 600 "/home/ubuntu/backups/athleteos-$stamp/backend.env"
git rev-parse HEAD > "/home/ubuntu/backups/athleteos-$stamp/commit.txt"
```

`backend/.env` 包含 JWT 和凭证加密密钥，必须与数据库一起备份，但不能提交到
Git 仓库。丢失 `CREDENTIAL_ENCRYPTION_KEY` 后，已保存的数据源和 LLM 凭证
无法解密。

`deployment/update-server.sh` 会在拉取和重启前校验密钥格式。出现格式错误时，
应从与当前数据库配套的备份中恢复原密钥，不能直接生成新密钥，否则已有凭证
仍然无法解密。推荐使用以下命令生成新环境的 64 位十六进制密钥：

```bash
openssl rand -hex 32
```

## 数据恢复

恢复前先停止后端，并保留当前数据的二次备份：

```bash
sudo systemctl stop athleteos-backend
cd /home/ubuntu/workspace/athlete-os
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "/home/ubuntu/backups/before-restore-$stamp"
cp backend/prisma/dev.db "/home/ubuntu/backups/before-restore-$stamp/dev.db"
cp backend/.env "/home/ubuntu/backups/before-restore-$stamp/backend.env"

cp /home/ubuntu/backups/athleteos-<时间>/dev.db backend/prisma/dev.db
cp /home/ubuntu/backups/athleteos-<时间>/backend.env backend/.env
chmod 600 backend/.env

sudo systemctl start athleteos-backend
curl http://127.0.0.1/healthz
```

## 回滚

先查看更新脚本产生的备份：

```bash
ls -lt /home/ubuntu/backups
cat /home/ubuntu/backups/athleteos-<时间>/previous-commit.txt
```

回滚代码和数据库：

```bash
cd /home/ubuntu/workspace/athlete-os
git checkout <previous-commit>
cp /home/ubuntu/backups/athleteos-<时间>/dev.db backend/prisma/dev.db
cd backend && npm ci && npx prisma generate && npm run build
cd ../frontend && npm ci && npm run build
sudo rsync -a --delete dist/ /var/www/athleteos/
sudo systemctl restart athleteos-backend
```

确认恢复后再把仓库切回 `master`。不要在未确认数据库兼容性的情况下只回滚代码。

## 域名备案完成后

以下命令中用正式域名替换 `<domain>`。

1. 确认域名 A 记录指向 `182.254.225.235`。
2. 确认外网能访问 HTTP：

```bash
curl -I http://<domain>/
```

3. 将 Nginx `server_name` 改为正式域名。
4. 使用 Certbot 启用 HTTPS。
5. 将 systemd 中 `CORS_ORIGINS` 改为正式 HTTPS 地址。
6. 将 `COOKIE_SECURE` 改为 `true`。
7. 重启后端并验证 HTTP 自动跳转 HTTPS。

当前系统 Certbot 必须使用 Ubuntu 自带的 Python 3.10：

```bash
sudo /usr/bin/python3.10 /usr/bin/certbot --nginx -d <域名>
```

同时应修正 `/lib/systemd/system/certbot.service`，保证自动续期也使用 Python
3.10，或者改用官方 Snap 版 Certbot。

启用 HTTPS 后验证：

```bash
curl -I https://<domain>/
curl https://<domain>/healthz
sudo systemctl status certbot.timer --no-pager
```

## 常见故障

### 后端无法启动

```bash
sudo systemctl status athleteos-backend --no-pager
sudo journalctl -u athleteos-backend -n 200 --no-pager
```

重点看：

- `CREDENTIAL_ENCRYPTION_KEY must be...`：`.env` 里的密钥格式错误，必须恢复与
  当前数据库配套的旧密钥。
- `address already in use`：端口被占用，检查 `sudo lsof -i :3007`。
- Prisma migration 报错：先停止发布，不要手工改数据库，优先用备份恢复。

### 前端 502 或接口不通

```bash
curl http://127.0.0.1:3007/
curl http://127.0.0.1/healthz
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
```

如果 `127.0.0.1:3007` 不通，先处理后端；如果后端通但 Nginx 不通，检查 Nginx
站点配置和 reload。

### 发布脚本中断

```bash
cd /home/ubuntu/workspace/athlete-os
git status --short
ls -lt /home/ubuntu/backups | head
sudo systemctl is-active athleteos-backend
curl http://127.0.0.1/healthz
```

如果服务仍正常，先不要回滚，修复脚本报错后重新执行
`bash deployment/update-server.sh`。如果服务已不可用，按“回滚”或“数据恢复”处理。
