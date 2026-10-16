import type { HumanAIController } from '../systems/HumanAIController.ts';
import type { DevBHumanHideSearch } from '../systems/DevBObserver.ts';

/** Read-only DEV projection: no hidden actor position, clock advance or AI command. */
export function observeHumanHideSearch(ai: HumanAIController, nowMs: number,
  authority: Pick<DevBHumanHideSearch, 'authoritativeCode' | 'authoritativeDetail' | 'countsAsFormalCheck'>): DevBHumanHideSearch {
  const latestClue = ai.clueList().slice(-1)[0] ?? null;
  const inference = ai.traceInference;
  const stance = ai.checkHideStance;
  const lastSeen = ai.lastSeenPublic(nowMs);
  const lastSeenPublic = lastSeen as { present?: boolean; valid?: boolean;
    x?: number; z?: number; roomId?: string | null; ageMs?: number };
  const detail = ai.lastCheckDetail;
  return {
    clueCount: ai.clueMemory.count(),
    expiredClueCount: ai.clueMemory.expiredCount,
    latestCluePosition: latestClue ? { ...latestClue.position } : null,
    latestClueAgeMs: latestClue ? nowMs - latestClue.discoveredAt : null,
    inferenceCode: inference.code,
    inferenceConfidence: inference.confidence,
    inferenceHeadingDeg: inference.directionHeadingRad === null ? null
      : inference.directionHeadingRad * 180 / Math.PI,
    inferenceAnchor: inference.anchor ? { ...inference.anchor } : null,
    inferenceBasis: inference.basis.join('；'),
    candidateRanking: ai.candidateRanking,
    suspectedSpotId: ai.suspectedSpotIds[0] ?? null,
    suspectedBasis: ai.candidateBasis.join('；'),
    candidateSkipped: ai.candidateSkipped,
    // 修复轮 一 / 二：待处理线索与 Last Seen 的公开摘要。
    pendingClueCount: ai.pendingClueCount,
    pendingClueRemainingMs: Math.max(0,
      ai.pendingClueValidUntilMs - nowMs),
    pendingClueDeferReason: ai.pendingClueDeferReason,
    pendingClueDeferCount: ai.pendingClueDeferCount,
    pendingClueReevalCount: ai.pendingClueReevalCount,
    lastSeenPresent: lastSeenPublic.present === true,
    lastSeenValid: lastSeenPublic.valid === true,
    lastSeenPosition: lastSeenPublic.present
      ? { x: lastSeenPublic.x ?? 0, z: lastSeenPublic.z ?? 0 } : null,
    lastSeenRoomId: ai.lastSeenRoomId,
    lastSeenAgeMs: lastSeenPublic.ageMs ?? null,
    lastSeenRoomGateCode: ai.lastSeenRoomGateCode,
    lastSeenRoomGateDetail: ai.lastSeenRoomGateDetail,
    // 修复轮 三 / 四 / 六：计数、收尾方式、声音明细与瞄点一致性。
    roundAttempts: ai.checkHideRoundAttempts,
    attemptedSpotId: ai.checkHideAttemptedSpotId,
    investigationEndReason: ai.checkHideInvestigationEndReason,
    interruptSoundType: ai.lastInterruptSoundType,
    interruptSoundStrength: ai.lastInterruptSoundStrength,
    interruptSoundRemainingMs: ai.lastInterruptSoundRemainingMs,
    interruptSoundIsNew: ai.lastInterruptSoundIsNew,
    checkResult: detail.result,
    checkDetailText: detail.detail,
    plannedSurfacePoint: detail.plannedSurfacePoint,
    finalAimPoint: detail.finalAimPoint,
    aimPointDelta: detail.aimPointDelta,
    aimAngleDeltaDeg: detail.angleDeltaDeg,
    aimBlocked: detail.blocked,
    authoritativeCode: authority.authoritativeCode,
    authoritativeDetail: authority.authoritativeDetail,
    phase: ai.checkHidePhase,
    source: ai.checkHideSource,
    spotId: ai.checkHideSpotId,
    stancePoint: stance ? { ...stance.stancePoint } : null,
    surfacePoint: stance ? { ...stance.surfacePoint } : null,
    // 修复轮 二：导航终点 / 正式站位 / REQUEST 实际位置三处一起看，
    // 「为什么判成 STANCE_LOST」不再需要靠猜。
    navGoal: ai.checkHideNavGoal
      ? { ...ai.checkHideNavGoal } : null,
    stanceDistance: ai.checkHideStanceDistance,
    requestPosition: ai.checkHideRequestPosition
      ? { ...ai.checkHideRequestPosition } : null,
    approachSteps: ai.checkHideApproachSteps,
    requestCount: ai.checkHideRequestCount,
    staleCancels: ai.checkHideStaleCancels,
    countsAsFormalCheck: authority.countsAsFormalCheck,
    dwellRemainingMs: ai.checkHideDwellRemainingMs,
    dwellMs: ai.checkHideDwellMs,
    roundChecks: ai.checkHideRoundChecks,
    roundBudget: ai.checkHideRoundBudget,
    investigationChecks: ai.checkHideInvestigationChecks,
    checkedSpotIds: [...ai.checkHideCheckedSpotIds],
    cooldowns: ai.checkHideCooldowns(),
    lastResult: ai.checkHideLastResult,
    lastResultSpotId: ai.checkHideLastResultSpotId,
    giveUpCode: ai.checkHideGiveUpCode,
    giveUpDetail: ai.checkHideGiveUpDetail,
    startCount: ai.checkHideStartCount,
    hitCount: ai.checkHideHitCount,
    missCount: ai.checkHideMissCount,
    interruptCount: ai.checkHideInterruptCount,
  };
}
