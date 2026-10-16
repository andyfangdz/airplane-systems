import { C172S } from "@/aircraft/c172s";
import { C172S_META } from "@/aircraft/c172s/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";

// /c172s and /c172s/<system>, one static page each; the page ships the C172S alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(C172S_META);
export const metadata = airplaneMetadata(C172S_META);

export default async function Page(props: AirplaneProps) {
  return <App def={C172S} sys={await routeSys(C172S_META, props)} />;
}
