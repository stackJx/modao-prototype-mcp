# modao-prototype-mcp

一个用于读取墨刀 read-only 原型链接并导出「目录 + 图片」的 MCP Server。

示例链接格式：

```text
https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id
```

## 安装与构建

```bash
cd /root/book/modao-prototype-mcp
npm install
npm run build
npm test
```

本环境已有 `/usr/bin/google-chrome`，导出器会优先使用系统 Chrome；如果你的机器没有 Chrome，可以安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

## MCP 配置示例

把下面配置加入支持 MCP 的客户端配置中：

```json
{
  "mcpServers": {
    "modao-prototype": {
      "command": "node",
      "args": ["/root/book/modao-prototype-mcp/dist/index.js"]
    }
  }
}
```

## 远程 MCP 服务

除了默认的 stdio 模式，也可以启动远程 HTTP 服务，适合部署到服务器后让支持远程 MCP 的客户端连接。

```bash
cd /root/book/modao-prototype-mcp
npm run build
HOST=0.0.0.0 PORT=3000 MCP_TOKEN="替换成你的密钥" npm run start:http
```

环境变量：

- `HOST`：监听地址，默认 `0.0.0.0`。
- `PORT`：监听端口，默认 `3000`。
- `MCP_TOKEN`：可选。设置后，远程 MCP 请求必须带 `Authorization: Bearer <MCP_TOKEN>`；不设置时适合本机或内网临时测试。

远程端点：

- 健康检查：`GET http://<host>:3000/health`
- 新版 Streamable HTTP MCP：`http://<host>:3000/mcp`
- 旧版 SSE MCP：`GET http://<host>:3000/sse`，消息投递到 `/messages?sessionId=...`

客户端如果支持远程 MCP，一般配置为：

```json
{
  "mcpServers": {
    "modao-prototype-remote": {
      "url": "http://服务器地址:3000/mcp",
      "headers": {
        "Authorization": "Bearer 替换成你的密钥"
      }
    }
  }
}
```

如果放到公网，建议在前面加 Nginx/Caddy/Cloudflare 做 HTTPS 反代，并始终设置 `MCP_TOKEN`。

## MCP 工具

工具名：`export_modao_prototype`

输入：

```json
{
  "url": "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id",
  "outputDir": "/root/book/modao-prototype-mcp/exports/modao-sample",
  "headless": true,
  "timeoutMs": 45000,
  "startDirectory": 1,
  "maxDirectories": 6
}
```

输出目录包含：

- `manifest.json`：页面清单、源链接、导出时间、图片路径。
- `catalog.md`：可阅读的页面目录，包含图片预览链接。
- `result.json`：和 MCP 返回一致的机器可读结果。
- `images/**/*.png`：每个原型页面截图；如果识别到墨刀左侧目录，会按目录分组保存。

## CLI 本地验证

默认导出为高清模式：会遍历左侧目录，进入 `view_mode=device&canvasId=...` 后逐页截图。

```bash
npm run export -- "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id" exports/modao-sample-hq
```

如果一次性导出全部目录在当前环境里运行过久，可以分批导出：

```bash
# 第 1-6 个目录
npm run export -- "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id" exports/modao-hq-01-06 --start-directory 1 --max-directories 6

# 第 7-12 个目录
npm run export -- "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id" exports/modao-hq-07-12 --start-directory 7 --max-directories 6

# 第 13-18 个目录
npm run export -- "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id" exports/modao-hq-13-18 --start-directory 13 --max-directories 6
```

可选参数：

- `--headed`：显示浏览器窗口，便于调试登录、验证码或加载问题。
- `--timeout-ms N`：设置加载超时毫秒数。
- `--start-directory N`：从左侧第 N 个目录开始导出，1 表示第一个目录。
- `--max-directories N`：最多导出 N 个目录，适合高清模式分批执行。

## 行为说明

- 会尝试从页面链接、`data-screen-id`、`data-screen` 等 DOM 线索提取页面列表。
- 如果墨刀总览页暴露 `canvas_title_<canvasId>`，会进入 `view_mode=device&canvasId=...` 逐页截图，输出更清晰的原型图。
- 如果墨刀页面没有暴露目录，至少会导出 URL 当前 `screen=` 指向的页面。
- 截图优先尝试原型画布区域，找不到画布时使用整页截图。

## 更新已导出的图片

如果已经导出过 `manifest.json` 和 `images/**/*.png`，可以使用 MCP 新工具 `update_modao_export_images` 原地更新图片。

工具名：`update_modao_export_images`

输入示例：

```json
{
  "outputDir": "/root/book/modao-prototype-mcp/exports/modao-all-directories-hq-final",
  "mode": "missing",
  "force": false,
  "headless": true,
  "timeoutMs": 45000
}
```

更新模式：

- `mode: "missing"`：默认模式，只更新缺失、空文件或损坏的 PNG。
- `mode: "all"`：全量刷新，覆盖 `manifest.json` 中列出的所有图片。
- `force: true`：无论 `mode` 是什么，都按全量刷新执行。

安全策略：

- 每张图片先截图到临时文件。
- 临时文件通过 PNG 检查后才覆盖原图。
- 单张截图失败时保留旧图，并在 `update-report.json` 中记录失败原因。

CLI 本地验证：

```bash
# 只补缺失/损坏图片
npm run update -- exports/modao-all-directories-hq-final

# 全量刷新所有已拉取图片
npm run update -- exports/modao-all-directories-hq-final --mode all

# force 等同全量刷新
npm run update -- exports/modao-all-directories-hq-final --force
```

更新后输出：

- `update-report.json`：记录总页数、更新/跳过/失败数量，以及每张图片的状态。

## 远程下载模式

远程 MCP 不能直接写入使用者电脑上的路径。为远程使用场景，服务新增工具：

```text
export_modao_prototype_download
```

这个工具不需要传 `outputDir`。服务会把导出结果保存到服务器的远程导出根目录，并返回可下载链接。

启动远程服务时建议设置公网地址：

```bash
cd /root/book/modao-prototype-mcp
npm run build
HOST=0.0.0.0 PORT=3001 \
PUBLIC_BASE_URL="http://203.0.113.10:3001" \
REMOTE_EXPORT_ROOT="/root/book/modao-prototype-mcp/exports/remote" \
MCP_TOKEN="替换成你的密钥" \
npm run start:http
```

远程 MCP 客户端配置：

```json
{
  "mcpServers": {
    "modao-prototype-remote": {
      "url": "http://203.0.113.10:3001/mcp",
      "headers": {
        "Authorization": "Bearer 替换成你的密钥"
      }
    }
  }
}
```

调用 `export_modao_prototype_download`：

```json
{
  "url": "https://modao.cc/proto/xxx/sharing?view_mode=read_only&screen=xxx",
  "name": "招聘系统原型",
  "headless": true,
  "timeoutMs": 45000
}
```

返回结果会包含：

- `zipUrl`：完整导出包下载链接
- `catalogUrl`：页面目录下载/预览链接
- `manifestUrl`：页面清单 JSON 下载链接
- `resultUrl`：导出结果 JSON 下载链接

示例：

```json
{
  "exportId": "zhao-pin-xi-tong-yuan-xing-20260622-102030",
  "zipUrl": "http://203.0.113.10:3001/download/zhao-pin-xi-tong-yuan-xing-20260622-102030.zip",
  "catalogUrl": "http://203.0.113.10:3001/download/zhao-pin-xi-tong-yuan-xing-20260622-102030/catalog.md",
  "manifestUrl": "http://203.0.113.10:3001/download/zhao-pin-xi-tong-yuan-xing-20260622-102030/manifest.json",
  "resultUrl": "http://203.0.113.10:3001/download/zhao-pin-xi-tong-yuan-xing-20260622-102030/result.json"
}
```
