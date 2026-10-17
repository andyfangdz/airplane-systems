export interface TestIdentity {
  project: string;
  file: string;
  titlePath: string[];
}
export interface BrowserTest extends TestIdentity {
  browser: string;
  selector: string;
}
export interface Duration extends TestIdentity {
  seconds: number;
}
export interface DiscoveryReport {
  config: { rootDir: string };
  errors?: unknown[];
  suites: DiscoverySuite[];
}
export interface DiscoverySuite {
  title: string;
  specs?: { title: string; file: string; tests: { projectName: string }[] }[];
  suites?: DiscoverySuite[];
}
export interface ShardPlan {
  testCount: number;
  unknownTestCount: number;
  fallbackSeconds: number;
  shards: {
    shard: number;
    estimatedDurationMs: number;
    testCount: number;
    browsers: string[];
    tests: (BrowserTest & { estimatedDurationMs: number; recordedDuration: boolean })[];
  }[];
}
export function testKey(test: TestIdentity): string;
export function discoverTests(
  report: DiscoveryReport,
  projectBrowsers: Record<string, string>,
  cwd?: string,
): BrowserTest[];
export function planShards(
  tests: BrowserTest[],
  durations: Duration[],
  shardCount: number,
  fallbackSeconds?: number,
): ShardPlan;
