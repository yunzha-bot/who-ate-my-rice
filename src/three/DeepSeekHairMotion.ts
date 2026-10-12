import * as THREE from 'three';

interface HairJoint {
  bone: THREE.Bone;
  base: THREE.Quaternion;
  pitchAxis: THREE.Vector3;
  rollAxis: THREE.Vector3;
  tip: boolean;
  back: boolean;
  phase: number;
  pitch: number;
  roll: number;
  pitchVelocity: number;
  rollVelocity: number;
}

// Angles are radians. These values control the visible v6 secondary motion.
export const DEEPSEEK_HAIR_V6 = {
  midMax: THREE.MathUtils.degToRad(16),
  sideTipMax: THREE.MathUtils.degToRad(32),
  backMidMax: THREE.MathUtils.degToRad(12),
  backTipMax: THREE.MathUtils.degToRad(27),
  tipSway: .12,
  backwardDrag: .075,
  stopRebound: .012,
  turnInertia: .09,
} as const;

/** Six small damped springs, applied after the body mixer and visual heading. */
export class DeepSeekHairMotion {
  private readonly joints: HairJoint[] = [];
  private readonly lastPosition = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly previousVelocity = new THREE.Vector3();
  private readonly acceleration = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly inverse = new THREE.Quaternion();
  private readonly offset = new THREE.Quaternion();
  private readonly rollOffset = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();
  private initialized = false;
  private lastHeading = 0;
  private time = 0;
  private gaitPhase = 0;
  private readonly model: THREE.Group;
  private readonly actor: THREE.Object3D;
  private readonly v6: boolean;

  constructor(model: THREE.Group, actor: THREE.Object3D) {
    this.model = model;
    this.actor = actor;
    this.v6 = (model.getObjectByName('DeepSeek_Armature')?.userData.deepseekHairVersion ?? 0) >= 2;
    // Older fallback assets keep their original presentation.
    if (!model.getObjectByName('HairBackTip')) return;
    model.updateWorldMatrix(true, true);
    model.getWorldQuaternion(this.orientation).invert();
    const names = ['HairUpper.L', 'HairLower.L', 'HairUpper.R', 'HairLower.R', 'HairBack', 'HairBackTip'];
    names.forEach((name, index) => {
      const bone = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? model.getObjectByName(name);
      if (!(bone instanceof THREE.Bone)) return;
      const relative = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(this.orientation).invert();
      this.joints.push({
        bone, base: bone.quaternion.clone(),
        pitchAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(relative),
        rollAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(relative),
        tip: name.includes('Lower') || name.endsWith('Tip'), phase: index * .83,
        back: name.startsWith('HairBack'),
        pitch: 0, roll: 0, pitchVelocity: 0, rollVelocity: 0,
      });
    });
  }

  /** Remove last frame's offsets before the mixer evaluates any tracks. */
  restore(): void {
    for (const joint of this.joints) joint.bone.quaternion.copy(joint.base);
  }

  reset(): void {
    this.restore();
    this.initialized = false;
    this.time = 0;
    this.gaitPhase = 0;
    this.previousVelocity.set(0, 0, 0);
    for (const joint of this.joints) {
      joint.pitch = joint.roll = joint.pitchVelocity = joint.rollVelocity = 0;
    }
  }

  update(seconds: number, concealed = false): void {
    if (!this.joints.length || seconds <= 0) return;
    const dt = Math.min(seconds, .1);
    this.model.getWorldQuaternion(this.orientation);
    this.inverse.copy(this.orientation).invert();
    this.forward.set(0, 0, 1).applyQuaternion(this.orientation);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    if (!this.initialized || this.actor.position.distanceToSquared(this.lastPosition) > 4) {
      this.lastPosition.copy(this.actor.position);
      this.lastHeading = heading;
      this.previousVelocity.set(0, 0, 0);
      this.initialized = true;
    }
    this.velocity.copy(this.actor.position).sub(this.lastPosition).divideScalar(dt);
    this.acceleration.copy(this.velocity).sub(this.previousVelocity).divideScalar(dt);
    this.previousVelocity.copy(this.velocity);
    this.lastPosition.copy(this.actor.position);
    this.velocity.applyQuaternion(this.inverse);
    this.acceleration.applyQuaternion(this.inverse).clampScalar(-12, 12);
    const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(heading - this.lastHeading),
      Math.cos(heading - this.lastHeading)) / dt, -8, 8);
    this.lastHeading = heading;
    this.time += dt;
    const speed = Math.min(8, Math.hypot(this.velocity.x, this.velocity.z));
    this.gaitPhase += dt * (5 + speed * 1.4);
    const steps = Math.ceil(dt * 120), h = dt / steps;
    for (const joint of this.joints) {
      joint.base.copy(joint.bone.quaternion);
      const tip = joint.tip;
      const limit = this.v6
        ? (joint.back ? (tip ? DEEPSEEK_HAIR_V6.backTipMax : DEEPSEEK_HAIR_V6.backMidMax)
          : (tip ? DEEPSEEK_HAIR_V6.sideTipMax : DEEPSEEK_HAIR_V6.midMax))
        : (tip ? .24 : .065);
      const idle = Math.sin(this.time * 1.7 + joint.phase);
      const bounce = Math.sin(this.gaitPhase + joint.phase);
      const scale = concealed ? .25 : 1;
      const targetPitch = THREE.MathUtils.clamp(scale * (this.v6
        ? (this.velocity.z * DEEPSEEK_HAIR_V6.backwardDrag * (tip ? 1 : .42) +
          this.acceleration.z * DEEPSEEK_HAIR_V6.stopRebound * (tip ? 1 : .38) +
          bounce * Math.min(1, speed / 3) * DEEPSEEK_HAIR_V6.tipSway * (tip ? 1 : .38))
        : (this.velocity.z * (tip ? .023 : .006) +
          this.acceleration.z * (tip ? .004 : .001) +
          bounce * Math.min(1, speed / 3) * (tip ? .035 : .008))), -limit, limit);
      const targetRoll = THREE.MathUtils.clamp(scale * (this.v6
        ? (idle * DEEPSEEK_HAIR_V6.tipSway * (tip ? 1 : .35) -
          turn * DEEPSEEK_HAIR_V6.turnInertia * (tip ? 1 : .4) -
          this.velocity.x * .045 * (tip ? 1 : .4) -
          this.acceleration.x * .008 * (tip ? 1 : .4))
        : (idle * (tip ? .035 : .008) - turn * (tip ? .026 : .006) -
          this.velocity.x * (tip ? .015 : .004) -
          this.acceleration.x * (tip ? .003 : .0008))), -limit, limit);
      const stiffness = this.v6 ? (tip ? 53 : 100) : (tip ? 64 : 144);
      const damping = this.v6 ? (tip ? 7 : 11) : (tip ? 5.8 : 12);
      for (let i = 0; i < steps; i++) {
        joint.pitchVelocity += (stiffness * (targetPitch - joint.pitch) - damping * joint.pitchVelocity) * h;
        joint.rollVelocity += (stiffness * (targetRoll - joint.roll) - damping * joint.rollVelocity) * h;
        joint.pitch = THREE.MathUtils.clamp(joint.pitch + joint.pitchVelocity * h, -limit, limit);
        joint.roll = THREE.MathUtils.clamp(joint.roll + joint.rollVelocity * h, -limit, limit);
      }
      this.offset.setFromAxisAngle(joint.pitchAxis, joint.pitch);
      this.rollOffset.setFromAxisAngle(joint.rollAxis, joint.roll);
      joint.bone.quaternion.copy(joint.base).multiply(this.offset).multiply(this.rollOffset).normalize();
    }
  }
}
