/**
 * Square tiles for the website. A flat work (painting, work on paper) is
 * fitted on white by the site itself; an object photographed on the studio
 * backdrop is rendered here: centred with the gallery's margins, the backdrop
 * continued where the photograph runs out.
 */
export * from "./constants";
export { analysePhotograph, renderObjectSquare } from "./render";
export { flatWorkHint } from "./hint";
