import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createExportModaoToolHandler,
  createUpdateModaoImagesToolHandler,
  exportToolInputSchema,
  updateToolInputSchema
} from './mcp-tool.js';
import { createExportModaoDownloadToolHandler, downloadToolInputSchema } from './remote-download.js';

export interface ModaoMcpServerOptions {
  downloadExportRoot?: string;
  downloadBaseUrl?: string;
}

export function createModaoMcpServer(options: ModaoMcpServerOptions = {}) {
  const server = new McpServer({
    name: 'modao-prototype-mcp',
    version: '0.1.0'
  });

  server.tool(
    'export_modao_prototype',
    '读取墨刀 read-only 原型链接，导出页面目录和 PNG 截图。',
    exportToolInputSchema.shape,
    createExportModaoToolHandler()
  );

  server.tool(
    'export_modao_prototype_download',
    '远程友好的墨刀导出：服务端保存导出结果并返回 zip、catalog、manifest 下载链接。',
    downloadToolInputSchema.shape,
    createExportModaoDownloadToolHandler({
      exportRoot: options.downloadExportRoot,
      baseUrl: options.downloadBaseUrl
    })
  );

  server.tool(
    'update_modao_export_images',
    '读取已有墨刀导出目录的 manifest.json，原地更新已拉取过的 PNG 图片。',
    updateToolInputSchema.shape,
    createUpdateModaoImagesToolHandler()
  );

  return server;
}
