import * as THREE from 'three';
import { GameConfig } from '../types';

export interface StickFigureParts {
    head: THREE.Mesh;
    torso: THREE.Mesh;
    leftUpperArm: THREE.Mesh;
    leftLowerArm: THREE.Mesh;
    rightUpperArm: THREE.Mesh;
    rightLowerArm: THREE.Mesh;
    leftUpperLeg: THREE.Mesh;
    leftLowerLeg: THREE.Mesh;
    rightUpperLeg: THREE.Mesh;
    rightLowerLeg: THREE.Mesh;
    // Pivot groups for animation
    leftArmPivot: THREE.Group;
    rightArmPivot: THREE.Group;
    leftLegPivot: THREE.Group;
    rightLegPivot: THREE.Group;
    leftElbowPivot: THREE.Group;
    rightElbowPivot: THREE.Group;
    leftKneePivot: THREE.Group;
    rightKneePivot: THREE.Group;
    // Weapon attachment
    weaponMount: THREE.Group;
    weapon: THREE.Group | null;
}

export type StickFigureGroup = THREE.Group & {
    parts: StickFigureParts;
    animationState: string;
    animationTime: number;
};

export function createStickFigure(cfg: GameConfig): StickFigureGroup {
    const group = new THREE.Group() as StickFigureGroup;

    // Materials
    const skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants });

    // === HEAD ===
    const headGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 11;
    head.castShadow = true;
    group.add(head);

    // Hair (on top of head)
    const hairMat = new THREE.MeshLambertMaterial({ color: cfg.hair });
    const hairGeo = new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 11.5;
    hair.castShadow = true;
    group.add(hair);

    // Eyes
    const eyeMat = new THREE.MeshLambertMaterial({ color: cfg.eyes });
    const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.5, 11.2, 1.3);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.5, 11.2, 1.3);
    group.add(rightEye);

    // === TORSO ===
    const torsoGeo = new THREE.CylinderGeometry(0.8, 0.6, 5, 8);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 7;
    torso.castShadow = true;
    group.add(torso);

    // === LEFT ARM ===
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-1.2, 9, 0);
    group.add(leftArmPivot);

    const leftUpperArmGeo = new THREE.CylinderGeometry(0.3, 0.25, 2.5, 8);
    const leftUpperArm = new THREE.Mesh(leftUpperArmGeo, shirtMat);
    leftUpperArm.position.y = -1.25;
    leftUpperArm.castShadow = true;
    leftArmPivot.add(leftUpperArm);

    const leftElbowPivot = new THREE.Group();
    leftElbowPivot.position.set(0, -2.5, 0);
    leftArmPivot.add(leftElbowPivot);

    const leftLowerArmGeo = new THREE.CylinderGeometry(0.25, 0.2, 2.5, 8);
    const leftLowerArm = new THREE.Mesh(leftLowerArmGeo, skinMat);
    leftLowerArm.position.y = -1.25;
    leftLowerArm.castShadow = true;
    leftElbowPivot.add(leftLowerArm);

    // Hand
    const handGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.y = -2.5;
    leftElbowPivot.add(leftHand);

    // === RIGHT ARM ===
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(1.2, 9, 0);
    group.add(rightArmPivot);

    const rightUpperArmGeo = new THREE.CylinderGeometry(0.3, 0.25, 2.5, 8);
    const rightUpperArm = new THREE.Mesh(rightUpperArmGeo, shirtMat);
    rightUpperArm.position.y = -1.25;
    rightUpperArm.castShadow = true;
    rightArmPivot.add(rightUpperArm);

    const rightElbowPivot = new THREE.Group();
    rightElbowPivot.position.set(0, -2.5, 0);
    rightArmPivot.add(rightElbowPivot);

    const rightLowerArmGeo = new THREE.CylinderGeometry(0.25, 0.2, 2.5, 8);
    const rightLowerArm = new THREE.Mesh(rightLowerArmGeo, skinMat);
    rightLowerArm.position.y = -1.25;
    rightLowerArm.castShadow = true;
    rightElbowPivot.add(rightLowerArm);

    // Hand
    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.y = -2.5;
    rightElbowPivot.add(rightHand);

    // Weapon mount on right hand
    const weaponMount = new THREE.Group();
    weaponMount.position.y = -2.7;
    rightElbowPivot.add(weaponMount);

    // === LEFT LEG ===
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.5, 4.5, 0);
    group.add(leftLegPivot);

    const leftUpperLegGeo = new THREE.CylinderGeometry(0.35, 0.3, 2.5, 8);
    const leftUpperLeg = new THREE.Mesh(leftUpperLegGeo, pantsMat);
    leftUpperLeg.position.y = -1.25;
    leftUpperLeg.castShadow = true;
    leftLegPivot.add(leftUpperLeg);

    const leftKneePivot = new THREE.Group();
    leftKneePivot.position.set(0, -2.5, 0);
    leftLegPivot.add(leftKneePivot);

    const leftLowerLegGeo = new THREE.CylinderGeometry(0.3, 0.25, 2.5, 8);
    const leftLowerLeg = new THREE.Mesh(leftLowerLegGeo, pantsMat);
    leftLowerLeg.position.y = -1.25;
    leftLowerLeg.castShadow = true;
    leftKneePivot.add(leftLowerLeg);

    // Foot
    const footGeo = new THREE.BoxGeometry(0.5, 0.3, 0.8);
    const footMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const leftFoot = new THREE.Mesh(footGeo, footMat);
    leftFoot.position.set(0, -2.65, 0.15);
    leftKneePivot.add(leftFoot);

    // === RIGHT LEG ===
    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.5, 4.5, 0);
    group.add(rightLegPivot);

    const rightUpperLegGeo = new THREE.CylinderGeometry(0.35, 0.3, 2.5, 8);
    const rightUpperLeg = new THREE.Mesh(rightUpperLegGeo, pantsMat);
    rightUpperLeg.position.y = -1.25;
    rightUpperLeg.castShadow = true;
    rightLegPivot.add(rightUpperLeg);

    const rightKneePivot = new THREE.Group();
    rightKneePivot.position.set(0, -2.5, 0);
    rightLegPivot.add(rightKneePivot);

    const rightLowerLegGeo = new THREE.CylinderGeometry(0.3, 0.25, 2.5, 8);
    const rightLowerLeg = new THREE.Mesh(rightLowerLegGeo, pantsMat);
    rightLowerLeg.position.y = -1.25;
    rightLowerLeg.castShadow = true;
    rightKneePivot.add(rightLowerLeg);

    // Foot
    const rightFoot = new THREE.Mesh(footGeo, footMat);
    rightFoot.position.set(0, -2.65, 0.15);
    rightKneePivot.add(rightFoot);

    // Store parts for animation
    group.parts = {
        head,
        torso,
        leftUpperArm,
        leftLowerArm,
        rightUpperArm,
        rightLowerArm,
        leftUpperLeg,
        leftLowerLeg,
        rightUpperLeg,
        rightLowerLeg,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        leftElbowPivot,
        rightElbowPivot,
        leftKneePivot,
        rightKneePivot,
        weaponMount,
        weapon: null
    };

    group.animationState = 'idle';
    group.animationTime = 0;

    // Enable shadows on all meshes
    group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });

    return group;
}

export function createWeaponMesh(type: string): THREE.Group {
    const group = new THREE.Group();

    if (type === 'bat') {
        // Baseball bat
        const handleGeo = new THREE.CylinderGeometry(0.15, 0.15, 2, 8);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.z = 1;
        group.add(handle);

        const headGeo = new THREE.CylinderGeometry(0.25, 0.15, 1.5, 8);
        const head = new THREE.Mesh(headGeo, handleMat);
        head.rotation.x = Math.PI / 2;
        head.position.z = 2.5;
        group.add(head);
    } else if (type === 'sword') {
        // Sword
        const handleGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x4a3021 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.z = 0.5;
        group.add(handle);

        // Guard
        const guardGeo = new THREE.BoxGeometry(0.8, 0.1, 0.15);
        const guardMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.z = 1;
        group.add(guard);

        // Blade
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0);
        bladeShape.lineTo(0.15, 0);
        bladeShape.lineTo(0.1, 2.5);
        bladeShape.lineTo(0, 2.8);
        bladeShape.lineTo(-0.1, 2.5);
        bladeShape.lineTo(-0.15, 0);
        bladeShape.closePath();

        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.05, bevelEnabled: false });
        const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.x = Math.PI / 2;
        blade.position.set(0, 0.025, 1.1);
        group.add(blade);
    } else if (type === 'axe') {
        // Axe
        const handleGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.z = 1.25;
        group.add(handle);

        // Axe head
        const headShape = new THREE.Shape();
        headShape.moveTo(0, 0);
        headShape.lineTo(0.8, 0.3);
        headShape.lineTo(0.8, -0.3);
        headShape.closePath();

        const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.15, bevelEnabled: false });
        const headMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, -0.075, 2.5);
        group.add(head);
    }

    group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
        }
    });

    return group;
}

export function attachWeapon(figure: StickFigureGroup, weaponType: string | null) {
    // Remove existing weapon
    if (figure.parts.weapon) {
        figure.parts.weaponMount.remove(figure.parts.weapon);
        figure.parts.weapon = null;
    }

    // Add new weapon
    if (weaponType && weaponType !== 'none') {
        const weapon = createWeaponMesh(weaponType);
        figure.parts.weaponMount.add(weapon);
        figure.parts.weapon = weapon;
    }
}

export function updateStickFigureColors(figure: StickFigureGroup, cfg: GameConfig) {
    const skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
    const shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants });
    const hairMat = new THREE.MeshLambertMaterial({ color: cfg.hair });

    figure.parts.head.material = skinMat;
    figure.parts.torso.material = shirtMat;
    figure.parts.leftUpperArm.material = shirtMat;
    figure.parts.rightUpperArm.material = shirtMat;
    figure.parts.leftLowerArm.material = skinMat;
    figure.parts.rightLowerArm.material = skinMat;
    figure.parts.leftUpperLeg.material = pantsMat;
    figure.parts.rightUpperLeg.material = pantsMat;
    figure.parts.leftLowerLeg.material = pantsMat;
    figure.parts.rightLowerLeg.material = pantsMat;

    // Update hair - find it by checking second child (after head)
    figure.children.forEach(child => {
        if (child instanceof THREE.Mesh && child !== figure.parts.head &&
            child.geometry instanceof THREE.SphereGeometry) {
            // Check if it's the hair (larger than head slightly)
            const geo = child.geometry as THREE.SphereGeometry;
            if (geo.parameters.radius > 1.5) {
                child.material = hairMat;
            }
        }
    });
}
