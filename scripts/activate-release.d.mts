interface Origin {
  Id: string;
  DomainName: string;
  OriginPath?: string;
  [key: string]: unknown;
}
interface DistributionConfig {
  Origins: { Items: Origin[]; [key: string]: unknown };
  DefaultCacheBehavior: { TargetOriginId: string; [key: string]: unknown };
  CacheBehaviors: {
    Items: { PathPattern: string; TargetOriginId: string; [key: string]: unknown }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export function activation(
  distribution: { ETag: string; DistributionConfig: DistributionConfig },
  release: string,
): { etag: string; config: DistributionConfig };
