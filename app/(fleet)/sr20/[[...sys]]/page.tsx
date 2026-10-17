import { SR20 } from "@/aircraft/sr20";
import { SR20_META } from "@/aircraft/sr20/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";

// /sr20 and /sr20/<system>, one static page each; the page ships the SR20 alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(SR20_META);
export const metadata = airplaneMetadata(SR20_META);

export default async function Page(props: AirplaneProps) {
  return <App def={SR20} sys={await routeSys(SR20_META, props)} />;
}
