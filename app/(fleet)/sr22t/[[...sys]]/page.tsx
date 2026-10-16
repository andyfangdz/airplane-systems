import { SR22T } from "@/aircraft/sr22t";
import { SR22T_META } from "@/aircraft/sr22t/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";
import { Prepare } from "./prepare";

// /sr22t and /sr22t/<system>, one static page each; the page ships the SR22T alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(SR22T_META);
export const metadata = airplaneMetadata(SR22T_META);

export default async function Page(props: AirplaneProps) {
  return (
    <>
      <Prepare />
      <App def={SR22T} sys={await routeSys(SR22T_META, props)} />
    </>
  );
}
