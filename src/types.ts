export interface RawScreenCandidate {
  title?: string | null;
  href?: string | null;
  screenId?: string | null;
}

export interface DiscoveredScreen {
  id: string;
  title: string;
  url: string;
}


export interface CanvasDirectory {
  index: number;
  title: string;
}

export interface ArtboardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleArtboard {
  id: string;
  title: string;
  rect: ArtboardRect;
}

export interface ExportedPage {
  id: string;
  title: string;
  url: string;
  image: string;
  directory?: string;
}

export interface ExportResult {
  sourceUrl: string;
  outputDir: string;
  exportedAt: string;
  pageCount: number;
  pages: ExportedPage[];
}

export interface WriteExportArtifactsArgs {
  sourceUrl: string;
  outputDir: string;
  exportedAt?: string;
  pages: ExportedPage[];
}

export interface ExportModaoOptions {
  url: string;
  outputDir: string;
  headless?: boolean;
  timeoutMs?: number;
  startDirectory?: number;
  maxDirectories?: number;
}

export type UpdateMode = 'all' | 'missing';

export interface UpdateModaoImagesOptions {
  outputDir: string;
  mode?: UpdateMode;
  force?: boolean;
  headless?: boolean;
  timeoutMs?: number;
}

export type UpdateItemStatus = 'updated' | 'skipped' | 'failed';

export interface UpdateModaoImagesReportItem {
  id: string;
  title: string;
  image: string;
  url: string;
  status: UpdateItemStatus;
  reason: string;
  width?: number;
  height?: number;
}

export interface UpdateModaoImagesReport {
  outputDir: string;
  manifest: string;
  updatedAt: string;
  mode: UpdateMode;
  force: boolean;
  totalPages: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  items: UpdateModaoImagesReportItem[];
}
