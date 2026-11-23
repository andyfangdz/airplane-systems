import { Catalogue } from "@/lib/catalogue";
import { addAirframe } from "./airframe";
import { addExterior } from "./exterior";
import { addFalconEye } from "./falconeye";
import { addEngines } from "./engines";
import { addFlightDeck } from "./flightdeck";
import { addInterior } from "./interior";

export const CAT = new Catalogue("falcon6x");
addAirframe(CAT);
addExterior(CAT);
addFalconEye(CAT);
addEngines(CAT);
addInterior(CAT);
addFlightDeck(CAT);
