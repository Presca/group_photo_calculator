/**
 * Group Photo Planner — calculation engine.
 *
 * Everything exported here is pure and framework-free. UI code should
 * only ever call these functions; future AI features (automatic row
 * optimisation, camera framing suggestions, face visibility scoring,
 * attendance import, QR check-in) plug in as additional pure modules
 * that consume and produce the same types.
 */
export * from "./types";
export * from "./rowCalculator";
export * from "./heightGroups";
export * from "./teacherPlacement";
export * from "./stitchPlanner";
export * from "./queuePlanner";
export * from "./commands";
export * from "./layoutEngine";
