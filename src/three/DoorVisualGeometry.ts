import { HOME_COMPOSITION } from './AlphaPresentation.ts';

/** Purely visual door proportions. The authored opening and DoorSystem collider stay unchanged. */
export function doorVisualGeometry(openingWidth: number, gameplayLeafThickness: number) {
  const jambWidth = .12;
  const frameDepth = .36;
  const clearance = .018;
  const leafDepth = gameplayLeafThickness * 1.25;
  const hingeInset = leafDepth;
  const innerHalf = openingWidth / 2 - jambWidth;
  // A box rotating around an inset hinge sweeps farther than its closed width.
  const hingeX = -innerHalf + Math.hypot(hingeInset, leafDepth / 2) + clearance;
  const leafRight = innerHalf - clearance;
  const leafWidth = leafRight - hingeX + hingeInset;
  return {
    jambWidth, frameDepth, jambHeight: 1.87,
    headerHeight: .16, headerY: 1.95,
    leafHeight: HOME_COMPOSITION.doorVisualHeight,
    leafDepth, leafWidth, hingeX,
    leafCenterX: leafWidth / 2 - hingeInset,
    farEdgeX: leafWidth - hingeInset,
  };
}
