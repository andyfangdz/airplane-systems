/** Shared scene framing policy. Fit narrower viewports along the existing line of sight. */
export const CAMERA_FOV = 38;
export const CAMERA_FIT_ASPECT = 0.9;
export const cameraFitDistance = (aspect: number) => Math.max(1, CAMERA_FIT_ASPECT / aspect);
