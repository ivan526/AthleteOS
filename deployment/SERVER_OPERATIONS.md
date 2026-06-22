# AthleteOS 公网服务器运维

当前服务器：

- 公网入口：`http://182.254.225.235`
- 系统：Ubuntu 22.04
- 代码目录：`/home/ubuntu/workspace/athlete-os`
- 前端目录：`/var/www/athleteos`
- 后端服务：`athleteos-backend.service`
- 后端监听：`127.0.0.1:3007`
- 反向代理：Nginx
- 数据库：`backend/prisma/dev.db`
- 备份目录：`/home/ubuntu/backups`

域名尚未完成备案，当前使用公网 IP + HTTP。生产服务设置了
`COOKIE_SECURE=false`。备案完成并启用 HTTPS 后必须恢复为 `true`。

## 日常检查

```bash
sudo systemctl status athleteos-backend
sudo systemctl status nginx
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

代码提交并同步 GitHub、Gitee 后，在服务器执行：

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

## 数据备份

手工备份：

```bash
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "/home/ubuntu/backups/athleteos-$stamp"
cp backend/prisma/dev.db "/home/ubuntu/backups/athleteos-$stamp/dev.db"
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

1. 确认域名 A 记录指向 `182.254.225.235`。
2. 将 Nginx `server_name` 改为正式域名。
3. 使用 Certbot 启用 HTTPS。
4. 将 systemd 中 `CORS_ORIGINS` 改为正式 HTTPS 地址。
5. 将 `COOKIE_SECURE` 改为 `true`。
6. 重启后端并验证 HTTP 自动跳转 HTTPS。

当前系统 Certbot 必须使用 Ubuntu 自带的 Python 3.10：

```bash
sudo /usr/bin/python3.10 /usr/bin/certbot --nginx -d <域名>
```

同时应修正 `/lib/systemd/system/certbot.service`，保证自动续期也使用 Python
3.10，或者改用官方 Snap 版 Certbot。
