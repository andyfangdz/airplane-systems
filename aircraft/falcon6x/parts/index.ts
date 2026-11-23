import { Catalogue } from "@/lib/catalogue";
import { addAirframe } from "./airframe";
import { addExterior } from "./exterior";
import { addEngines } from "./engines";
import { addInterior } from "./interior";

export const CAT = new Catalogue("falcon6x");
addAirframe(CAT);
addExterior(CAT);
addEngines(CAT);
addInterior(CAT);
