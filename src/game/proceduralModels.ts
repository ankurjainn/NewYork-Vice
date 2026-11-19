import * as THREE from 'three';
import {
  BODY_BUILD_METRICS,
  getWeatherClothingState,
  type CharacterAppearanceSpec,
  type HairStyleId,
} from './characterModels';
import {
  ELEPHANTA_ISLAND,
  ROAD_COORDS,
  ROAD_WIDTH,
  type AreaHoardingDef,
  type FlyoverDef,
  type PierZoneDef,
  type RecreationZoneDef,
  type StreetGantryDef,
} from './cityLayout';
import { getTrafficSignalState } from './simulation';
import type { BuildingShopDef, StallKind, VehicleType, WeatherKind } from './types';
import type { WeatherVisualParams } from './weatherSystem';
import {
  addCentralParkLamp,
  addLayeredParkTree,
  addParkFlowerbedAndShrubs,
  createDetailedBronxStadium,
  createRealisticBirdRig,
  getParkPathTexture,
  getParkTurfTexture,
  type BirdSpecies,
} from './nycEnvironment';

export const ASPHALT_TEX_URL = '/src/assets/images/tex_mumbai_asphalt_1795069891231.jpg';
export const SANDSTONE_TEX_URL = '/src/assets/images/tex_sandstone_masonry_1795069891352.jpg';

export interface VehicleRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  driverGroup: THREE.Group;
  setDriverAppearance: (shirtHex: number, skinHex?: number, isPolice?: boolean) => void;
  wheels: THREE.Object3D[];
  bodyMeshes: THREE.Mesh[];
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
  brakeLights: THREE.Mesh[];
}

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  torso: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  telegraphRing?: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  umbrellaGroup?: THREE.Group;
  raincoatGroup?: THREE.Group;
  sunglassesGroup?: THREE.Group;
  isCarryingUmbrella: boolean;
  applyWeatherGear: (weather: WeatherKind, rainIntensity: number) => void;
}

export interface SeagullRig {
  root: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  leftWingTip?: THREE.Group;
  rightWingTip?: THREE.Group;
  tail?: THREE.Group;
  species?: BirdSpecies;
}

export interface TrafficSignalRig {
  root: THREE.Group;
  nsRed: THREE.Mesh;
  nsAmber: THREE.Mesh;
  nsGreen: THREE.Mesh;
  ewRed: THREE.Mesh;
  ewAmber: THREE.Mesh;
  ewGreen: THREE.Mesh;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, 'rgba(10, 7, 5, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 7, 5, 0.36)');
  grad.addColorStop(1, 'rgba(10, 7, 5, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createNoiseBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = 90 + (seed % 110);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createRoadMarkingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  // Subtle shoulder curb lines
  ctx.fillStyle = 'rgba(244, 232, 200, 0.55)';
  ctx.fillRect(10, 0, 5, 512);
  ctx.fillRect(241, 0, 5, 512);

  // Double amber Mumbai median divider
  ctx.fillStyle = 'rgba(245, 179, 52, 0.85)';
  ctx.fillRect(122, 0, 4, 512);
  ctx.fillRect(130, 0, 4, 512);

  // Dashed lane lines
  ctx.fillStyle = 'rgba(255, 248, 230, 0.65)';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(66, y, 4, 34);
    ctx.fillRect(186, y, 4, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createFacadeTexture(
  baseHex: number,
  style: 'heritage' | 'artdeco' | 'bazaar' | 'tower' | 'mill' | 'slum',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const c = new THREE.Color(baseHex);
  ctx.fillStyle = `#${c.getHexString()}`;
  ctx.fillRect(0, 0, 256, 512);

  if (style === 'slum') {
    // Weathered plaster + corrugated iron patches + small shuttered windows + street doorway
    ctx.fillStyle = 'rgba(28, 22, 16, 0.16)';
    for (let y = 0; y < 512; y += 22) {
      ctx.fillRect(0, y, 256, 3);
    }
    // Upper corrugated tin sheet band
    ctx.fillStyle = 'rgba(72, 82, 92, 0.42)';
    ctx.fillRect(0, 0, 256, 130);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let x = 0; x < 256; x += 12) {
      ctx.fillRect(x, 0, 3, 130);
    }
    // Irregular cozy windows
    let seed = baseHex + 41;
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        seed = (seed * 48271) % 2147483647;
        if (seed % 5 === 0) continue;
        const wx = 24 + col * 78 + (seed % 10);
        const wy = 148 + r * 92;
        ctx.fillStyle = '#2c221b';
        ctx.fillRect(wx - 4, wy - 4, 42, 46);
        ctx.fillStyle = seed % 3 === 0 ? '#ffd27a' : '#3a4a58';
        ctx.fillRect(wx, wy, 34, 38);
      }
    }
    // Ground-floor workshop shutter door
    ctx.fillStyle = '#253340';
    ctx.fillRect(28, 412, 82, 100);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(142, 434, 74, 52);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // Subtle horizontal cornice bands
  ctx.fillStyle = 'rgba(42, 28, 18, 0.16)';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(0, y, 256, 6);
  }

  // Windows grid tailored to architectural style
  const cols = style === 'tower' ? 6 : 4;
  const rows = style === 'tower' ? 10 : 7;
  const padX = 16;
  const padY = 18;
  const cellW = (256 - padX * 2) / cols;
  const cellH = (440 - padY * 2) / rows;

  let seed = baseHex + style.length * 91;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      seed = (seed * 48271) % 2147483647;
      const lit = (seed % 10) > 5;
      const wx = padX + col * cellW + 5;
      const wy = padY + r * cellH + 6;
      const ww = cellW - 10;
      const wh = cellH - 12;

      if (style === 'tower') {
        ctx.fillStyle = lit ? '#ffda94' : '#355068';
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = 'rgba(220, 232, 240, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, ww, wh);
      } else {
        // Shutter/arch recessed frame
        ctx.fillStyle = 'rgba(35, 22, 14, 0.35)';
        ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        ctx.fillStyle = lit ? '#ffd382' : '#2c3742';
        ctx.fillRect(wx, wy, ww, wh);
        // Heritage arched top or mullions
        ctx.fillStyle = 'rgba(255, 242, 214, 0.35)';
        ctx.fillRect(wx + ww * 0.48, wy, 2, wh);
        ctx.fillRect(wx, wy + wh * 0.5, ww, 2);
      }
    }
  }

  // Ground-floor storefront arcade base
  ctx.fillStyle = 'rgba(30, 20, 14, 0.52)';
  ctx.fillRect(0, 444, 256, 68);
  ctx.fillStyle = '#ffcf7d';
  ctx.fillRect(22, 460, 74, 42);
  ctx.fillRect(156, 460, 74, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createShopSignTexture(text: string, accentHex: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const col = new THREE.Color(accentHex);

  ctx.fillStyle = `#${col.getHexString()}`;
  ctx.fillRect(0, 0, 512, 96);

  ctx.strokeStyle = '#ffdf8c';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 84);

  ctx.fillStyle = '#fff9ec';
  ctx.font = '700 34px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface DynamicSkyRig {
  mesh: THREE.Mesh;
  updateWeather: (v: WeatherVisualParams) => void;
}

export function createSunsetSkyDome(): DynamicSkyRig {
  const geo = new THREE.SphereGeometry(620, 28, 18);
  const uniforms = {
    topColor: { value: new THREE.Color(0x234e80) },
    midColor: { value: new THREE.Color(0xd98359) },
    horizonColor: { value: new THREE.Color(0xf7cfa0) },
    cloudTint: { value: new THREE.Color(0xffd9ad) },
    cloudOpacity: { value: 0.32 },
    sunGlowStrength: { value: 1.0 },
    lightningFlash: { value: 0.0 },
    sunDir: { value: new THREE.Vector3(-0.62, 0.24, -0.74).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 cloudTint;
      uniform float cloudOpacity;
      uniform float sunGlowStrength;
      uniform float lightningFlash;
      uniform vec3 sunDir;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
        col = mix(col, topColor, smoothstep(0.16, 0.62, h));
        // Dynamic sunset / monsoon cloud canopy
        float cloudBand = smoothstep(0.04, 0.24, h) * (1.0 - smoothstep(0.45, 0.85, h) * (1.0 - cloudOpacity * 0.65));
        float wave = sin(dir.x * 9.0 + dir.z * 5.0) * cos(dir.z * 7.0 - dir.x * 4.0);
        float clouds = smoothstep(0.12, 0.72, wave * 0.5 + 0.5) * cloudBand;
        col = mix(col, cloudTint, clouds * cloudOpacity);
        // Low golden Arabian Sea sun glow (dims naturally under monsoon clouds)
        float sunAmt = max(dot(dir, sunDir), 0.0);
        col += vec3(1.0, 0.76, 0.42) * pow(sunAmt, 10.0) * 0.62 * sunGlowStrength;
        col += vec3(1.0, 0.96, 0.84) * smoothstep(0.996, 0.999, sunAmt) * 1.45 * sunGlowStrength;
        // Brief monsoon lightning sheet illumination in upper cloud bank
        col += vec3(0.76, 0.86, 1.0) * lightningFlash * (0.28 + 0.42 * smoothstep(0.15, 0.75, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const updateWeather = (v: WeatherVisualParams) => {
    uniforms.topColor.value.setRGB(v.skyTop.r, v.skyTop.g, v.skyTop.b);
    uniforms.midColor.value.setRGB(v.skyMid.r, v.skyMid.g, v.skyMid.b);
    uniforms.horizonColor.value.setRGB(v.skyHorizon.r, v.skyHorizon.g, v.skyHorizon.b);
    uniforms.cloudTint.value.setRGB(v.cloudTint.r, v.cloudTint.g, v.cloudTint.b);
    uniforms.cloudOpacity.value = v.cloudOpacity;
    uniforms.sunGlowStrength.value = v.sunGlowStrength;
    uniforms.lightningFlash.value = v.lightningFlash;
  };
  return { mesh, updateWeather };
}

const _extrudeGeoCache = new Map<string, THREE.BufferGeometry>();

function getCachedExtrudedProfile(
  key: string,
  buildShape: (s: THREE.Shape) => void,
  width: number,
  bevelSize = 0.08,
): THREE.BufferGeometry {
  const cached = _extrudeGeoCache.get(key);
  if (cached) return cached;
  const shape = new THREE.Shape();
  buildShape(shape);
  const depth = Math.max(0.06, width - bevelSize * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 10,
  });
  // Center along Z then rotate -90 deg around Y so 2D +X maps to 3D +Z (vehicle forward)
  geo.translate(0, 0, -depth * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  _extrudeGeoCache.set(key, geo);
  return geo;
}

const _sharedWheelTireMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.86, metalness: 0.1 });
const _sharedWheelRimMat = new THREE.MeshStandardMaterial({ color: 0xd5dce3, roughness: 0.24, metalness: 0.85 });
const _wheelGeoCache = new Map<string, { tire: THREE.CylinderGeometry; hub: THREE.CylinderGeometry; spoke: THREE.BoxGeometry }>();

function createWheelMesh(radius: number, width: number): THREE.Group {
  const key = `${radius.toFixed(2)}_${width.toFixed(2)}`;
  let geos = _wheelGeoCache.get(key);
  if (!geos) {
    const tire = new THREE.CylinderGeometry(radius, radius, width, 16);
    tire.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.025, 12);
    hub.rotateZ(Math.PI / 2);
    const spoke = new THREE.BoxGeometry(width + 0.036, radius * 1.04, radius * 0.16);
    geos = { tire, hub, spoke };
    _wheelGeoCache.set(key, geos);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geos.tire, _sharedWheelTireMat));
  g.add(new THREE.Mesh(geos.hub, _sharedWheelRimMat));
  const spokeA = new THREE.Mesh(geos.spoke, _sharedWheelRimMat);
  const spokeB = new THREE.Mesh(geos.spoke, _sharedWheelRimMat);
  spokeB.rotation.x = Math.PI / 2;
  g.add(spokeA, spokeB);
  return g;
}

interface SeatedDriverRig {
  group: THREE.Group;
  setColors: (shirtHex: number, skinHex?: number, isPolice?: boolean) => void;
}

function createSeatedDriverRig(opts: {
  x: number;
  y: number;
  z: number;
  shirtHex: number;
  skinHex: number;
  isPolice?: boolean;
  isHandlebar?: boolean;
}): SeatedDriverRig {
  const group = new THREE.Group();
  group.position.set(opts.x, opts.y, opts.z);

  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skinHex, roughness: 0.72 });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: opts.isPolice ? 0xc29e6c : opts.shirtHex,
    roughness: 0.72,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x181412, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.55, metalness: 0.3 });

  // Sculpted seated torso & shoulders
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.24, 5, 10), shirtMat);
  torso.scale.set(1.12, 1.0, 0.76);
  torso.position.set(0, 0.24, 0);
  torso.rotation.x = -0.1;
  group.add(torso);

  // Curved head + neck + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.142, 12, 10), skinMat);
  head.scale.set(0.92, 1.06, 0.96);
  head.position.set(0, 0.59, 0.02);
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.146, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
  hair.scale.set(0.95, 1.04, 1.0);
  hair.position.set(0, 0.615, 0.0);
  group.add(hair);

  // Peaked Mumbai Police officer cap (toggled via setColors)
  const policeCapGroup = new THREE.Group();
  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.132, 0.085, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52 }),
  );
  capCrown.position.set(0, 0.71, 0.01);
  policeCapGroup.add(capCrown);
  const capBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    darkMat,
  );
  capBrim.position.set(0, 0.675, 0.085);
  policeCapGroup.add(capBrim);
  const badge = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 }),
  );
  badge.position.set(0, 0.705, 0.148);
  policeCapGroup.add(badge);
  policeCapGroup.visible = Boolean(opts.isPolice);
  group.add(policeCapGroup);

  // Arms reaching forward to grip steering wheel / handlebar
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.28, 4, 8), shirtMat);
    arm.position.set(sx * 0.175, 0.32, 0.18);
    arm.rotation.x = Math.PI * 0.44;
    arm.rotation.z = sx * 0.18;
    group.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), skinMat);
    hand.position.set(sx * 0.125, 0.34, 0.33);
    group.add(hand);
  }

  // Steering wheel (or auto-rickshaw handlebar)
  if (opts.isHandlebar) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), darkMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.34, 0.34);
    group.add(bar);
  } else {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.022, 6, 14), darkMat);
    wheel.position.set(0, 0.34, 0.35);
    wheel.rotation.x = -0.35;
    group.add(wheel);
  }

  return {
    group,
    setColors: (shirtHex: number, skinHex?: number, isPolice?: boolean) => {
      shirtMat.color.setHex(isPolice ? 0xc29e6c : shirtHex);
      if (skinHex !== undefined) skinMat.color.setHex(skinHex);
      policeCapGroup.visible = Boolean(isPolice);
    },
  };
}

export function createVehicleRig(
  type: VehicleType,
  shadowTex: THREE.Texture,
  driverOpts?: { shirtHex?: number; skinHex?: number; isPolice?: boolean; visible?: boolean },
): VehicleRig {
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);
  const wheels: THREE.Object3D[] = [];
  const bodyMeshes: THREE.Mesh[] = [];
  const brakeLights: THREE.Mesh[] = [];

  // Semi-transparent cabin glass so seated drivers & interiors are clearly visible!
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x243b53,
    roughness: 0.1,
    metalness: 0.55,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    clearcoat: 0.85,
  });
  const interiorMat = new THREE.MeshStandardMaterial({ color: 0x1c1b1d, roughness: 0.88, metalness: 0.08 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3b2c26, roughness: 0.85 });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.92,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff4cf,
    emissive: 0xffdf91,
    emissiveIntensity: 1.5,
    roughness: 0.18,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xd92626,
    emissive: 0xff2222,
    emissiveIntensity: 0.65,
    roughness: 0.28,
  });
  const archMat = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.78 });

  let lightbarRed: THREE.Mesh | undefined;
  let lightbarBlue: THREE.Mesh | undefined;

  const addShadow = (w: number, l: number) => {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.32, l * 1.18),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.52,
      }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.03;
    root.add(sh);
  };

  const addWheelArch = (wx: number, wy: number, wz: number, r: number) => {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.055, 6, 12, Math.PI),
      archMat,
    );
    arch.rotation.y = Math.PI / 2;
    arch.position.set(wx, wy, wz);
    chassisGroup.add(arch);
  };

  // Default driver placement (overridden per vehicle type)
  let driverSpec = { x: -0.38, y: 0.66, z: 0.06, isHandlebar: false };

  if (type === 'taxi') {
    // Iconic NYC Yellow Cab with glossy medallion yellow body & black checkered waist stripe!
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x16171c, roughness: 0.3, metalness: 0.4 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf2a900, roughness: 0.22, metalness: 0.24 });

    const bodyGeo = getCachedExtrudedProfile(
      'taxi_lower',
      (s) => {
        s.moveTo(-1.92, 0.34);
        s.quadraticCurveTo(-1.98, 0.56, -1.86, 0.84);
        s.lineTo(-1.26, 0.9);
        s.lineTo(1.06, 0.9);
        s.quadraticCurveTo(1.66, 0.86, 1.94, 0.72);
        s.quadraticCurveTo(2.02, 0.54, 1.92, 0.34);
        s.closePath();
      },
      1.78,
      0.09,
    );
    const chassis = new THREE.Mesh(bodyGeo, yellowMat);
    chassis.castShadow = true;
    chassisGroup.add(chassis);
    bodyMeshes.push(chassis);

    // Classic NYC Taxi black accent belt stripe along the curved waist
    const beltGeo = getCachedExtrudedProfile(
      'taxi_belt',
      (s) => {
        s.moveTo(-1.88, 0.78);
        s.lineTo(1.88, 0.72);
        s.lineTo(1.86, 0.84);
        s.lineTo(-1.86, 0.89);
        s.closePath();
      },
      1.83,
      0.03,
    );
    const belt = new THREE.Mesh(beltGeo, blackMat);
    chassisGroup.add(belt);
    bodyMeshes.push(belt);

    // Translucent sloped curved greenhouse + yellow arched roof
    const cabinGeo = getCachedExtrudedProfile(
      'taxi_cabin',
      (s) => {
        s.moveTo(-1.24, 0.88);
        s.quadraticCurveTo(-1.02, 1.32, -0.78, 1.4);
        s.lineTo(0.56, 1.4);
        s.quadraticCurveTo(0.84, 1.24, 1.04, 0.88);
        s.closePath();
      },
      1.54,
      0.06,
    );
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    chassisGroup.add(cabin);

    const roofGeo = getCachedExtrudedProfile(
      'taxi_roof',
      (s) => {
        s.moveTo(-0.88, 1.38);
        s.quadraticCurveTo(-0.1, 1.54, 0.64, 1.38);
        s.lineTo(0.62, 1.46);
        s.quadraticCurveTo(-0.1, 1.62, -0.86, 1.46);
        s.closePath();
      },
      1.54,
      0.06,
    );
    const roof = new THREE.Mesh(roofGeo, yellowMat);
    roof.castShadow = true;
    chassisGroup.add(roof);
    bodyMeshes.push(roof);

    // Interior dashboard & seats
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.28, 0.42), interiorMat);
    dash.position.set(0, 0.88, 0.68);
    chassisGroup.add(dash);
    const rearSeat = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.36, 0.42), seatMat);
    rearSeat.position.set(0, 0.92, -0.68);
    chassisGroup.add(rearSeat);

    // Glowing TAXI roof sign (curved dome)
    const topper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.11, 0.34, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff0b3, emissive: 0xf59e0b, emissiveIntensity: 1.0, roughness: 0.25 }),
    );
    topper.rotation.z = Math.PI / 2;
    topper.position.set(0, 1.6, 0.02);
    chassisGroup.add(topper);

    // Curved chrome wraparound bumpers
    const frontBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 1.68, 4, 8), chromeMat);
    frontBumper.rotation.z = Math.PI / 2;
    frontBumper.position.set(0, 0.37, 2.02);
    chassisGroup.add(frontBumper);
    const rearBumper = frontBumper.clone();
    rearBumper.position.z = -2.0;
    chassisGroup.add(rearBumper);

    const grille = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.88, 4, 8), chromeMat);
    grille.rotation.z = Math.PI / 2;
    grille.position.set(0, 0.62, 1.98);
    chassisGroup.add(grille);

    for (const sx of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headlightMat);
      hl.scale.set(1, 1, 0.55);
      hl.position.set(sx, 0.66, 1.97);
      chassisGroup.add(hl);

      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.14, 4, 6), taillightMat.clone());
      tl.rotation.z = Math.PI / 2;
      tl.position.set(sx, 0.67, -1.97);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    const wheelOffsets: [number, number][] = [
      [-0.86, 1.24],
      [0.86, 1.24],
      [-0.86, -1.24],
      [0.86, -1.24],
    ];
    for (const [wx, wz] of wheelOffsets) {
      const w = createWheelMesh(0.32, 0.22);
      w.position.set(wx, 0.32, wz);
      root.add(w);
      wheels.push(w);
      addWheelArch(wx > 0 ? wx + 0.03 : wx - 0.03, 0.35, wz, 0.38);
    }
    driverSpec = { x: -0.36, y: 0.72, z: 0.05, isHandlebar: false };
    addShadow(1.9, 4.1);
  } else if (type === 'auto') {
    // Curved Mumbai Bajaj RE Auto-Rickshaw with sculpted nose cowl, arched yellow canopy & handlebar driver
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.36, metalness: 0.32 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf7b91c, roughness: 0.32, metalness: 0.2 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf5be2a, roughness: 0.72, metalness: 0.04 });

    const tubGeo = getCachedExtrudedProfile(
      'auto_tub',
      (s) => {
        s.moveTo(-1.24, 0.28);
        s.quadraticCurveTo(-1.32, 0.64, -1.12, 0.94); // curved rear engine bay
        s.lineTo(-0.32, 0.92);
        s.lineTo(-0.22, 0.42);
        s.lineTo(0.68, 0.42);
        s.quadraticCurveTo(0.95, 0.88, 1.18, 0.96); // curved front cowl
        s.quadraticCurveTo(1.42, 0.76, 1.32, 0.36);
        s.lineTo(0.88, 0.26);
        s.closePath();
      },
      1.36,
      0.08,
    );
    const lowerTub = new THREE.Mesh(tubGeo, blackMat);
    lowerTub.castShadow = true;
    chassisGroup.add(lowerTub);
    bodyMeshes.push(lowerTub);

    // Lower yellow curved skirt band
    const yellowBandGeo = getCachedExtrudedProfile(
      'auto_skirt',
      (s) => {
        s.moveTo(-1.24, 0.26);
        s.lineTo(1.26, 0.28);
        s.lineTo(1.24, 0.48);
        s.lineTo(-1.24, 0.5);
        s.closePath();
      },
      1.4,
      0.04,
    );
    const yellowBand = new THREE.Mesh(yellowBandGeo, yellowMat);
    chassisGroup.add(yellowBand);
    bodyMeshes.push(yellowBand);

    // Curved front fender over single front wheel
    const fender = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 12, Math.PI), yellowMat);
    fender.rotation.y = Math.PI / 2;
    fender.position.set(0, 0.28, 1.12);
    chassisGroup.add(fender);

    // Sloped transparent windshield
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.58, 0.06), glassMat);
    shield.position.set(0, 1.28, 0.98);
    shield.rotation.x = -0.22;
    chassisGroup.add(shield);

    // Tubular canopy pillars
    for (const [px, pz] of [
      [-0.6, 0.88],
      [0.6, 0.88],
      [-0.6, -1.04],
      [0.6, -1.04],
    ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.94, 6), chromeMat);
      p.position.set(px, 1.24, pz);
      chassisGroup.add(p);
    }

    // Arched curved canvas canopy roof
    const canopyGeo = getCachedExtrudedProfile(
      'auto_canopy',
      (s) => {
        s.moveTo(-1.18, 1.56);
        s.quadraticCurveTo(-1.14, 1.82, -0.78, 1.84);
        s.quadraticCurveTo(0.0, 1.92, 0.86, 1.8);
        s.quadraticCurveTo(1.06, 1.72, 1.02, 1.56);
        s.lineTo(0.86, 1.62);
        s.quadraticCurveTo(0.0, 1.72, -0.96, 1.62);
        s.closePath();
      },
      1.38,
      0.06,
    );
    const roof = new THREE.Mesh(canopyGeo, canopyMat);
    roof.castShadow = true;
    chassisGroup.add(roof);
    bodyMeshes.push(roof);

    // Passenger rear cushion bench
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.26, 0.45), seatMat);
    bench.position.set(0, 0.72, -0.68);
    chassisGroup.add(bench);

    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), headlightMat);
    hl.scale.set(1, 1, 0.6);
    hl.position.set(0, 0.74, 1.38);
    chassisGroup.add(hl);

    for (const sx of [-0.48, 0.48]) {
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 6), taillightMat.clone());
      tl.rotation.z = Math.PI / 2;
      tl.position.set(sx, 0.64, -1.27);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    const frontW = createWheelMesh(0.24, 0.18);
    frontW.position.set(0, 0.24, 1.12);
    root.add(frontW);
    wheels.push(frontW);

    for (const sx of [-0.66, 0.66]) {
      const rw = createWheelMesh(0.25, 0.19);
      rw.position.set(sx, 0.25, -0.82);
      root.add(rw);
      wheels.push(rw);
    }
    driverSpec = { x: 0, y: 0.66, z: 0.28, isHandlebar: true };
    addShadow(1.5, 2.85);
  } else if (type === 'bus') {
    // Iconic NYC MTA City Transit Bus (crisp white hull with MTA Royal Blue stripe & front driver)
    const redMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.28, metalness: 0.22 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0052a5, roughness: 0.32, metalness: 0.28 });

    // Lower curved hull up to lower window sill
    const lowerGeo = getCachedExtrudedProfile(
      'bus_lower',
      (s) => {
        s.moveTo(-3.55, 0.48);
        s.lineTo(3.42, 0.48);
        s.quadraticCurveTo(3.66, 0.56, 3.64, 1.24);
        s.lineTo(-3.55, 1.24);
        s.quadraticCurveTo(-3.66, 0.85, -3.55, 0.48);
        s.closePath();
      },
      2.46,
      0.1,
    );
    const lowerDeck = new THREE.Mesh(lowerGeo, redMat);
    lowerDeck.castShadow = true;
    chassisGroup.add(lowerDeck);
    bodyMeshes.push(lowerDeck);

    // Mid cream waist band between lower & upper decks
    const midBandGeo = getCachedExtrudedProfile(
      'bus_midband',
      (s) => {
        s.moveTo(-3.56, 1.92);
        s.lineTo(3.56, 1.92);
        s.quadraticCurveTo(3.64, 2.15, 3.54, 2.42);
        s.lineTo(-3.56, 2.42);
        s.closePath();
      },
      2.48,
      0.08,
    );
    const midBand = new THREE.Mesh(midBandGeo, redMat);
    chassisGroup.add(midBand);
    bodyMeshes.push(midBand);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.2, 7.22), stripeMat);
    stripe.position.y = 2.08;
    chassisGroup.add(stripe);

    // Rounded aerodynamic upper roof dome
    const upperRoofGeo = getCachedExtrudedProfile(
      'bus_roof',
      (s) => {
        s.moveTo(-3.52, 3.16);
        s.lineTo(3.42, 3.16);
        s.quadraticCurveTo(3.54, 3.56, 2.98, 3.64);
        s.lineTo(-3.16, 3.64);
        s.quadraticCurveTo(-3.58, 3.56, -3.52, 3.16);
        s.closePath();
      },
      2.44,
      0.1,
    );
    const upperRoof = new THREE.Mesh(upperRoofGeo, redMat);
    upperRoof.castShadow = true;
    chassisGroup.add(upperRoof);
    bodyMeshes.push(upperRoof);

    // Translucent lower & upper wrap windows + red structural corner pillars
    const lowerWin = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.72, 6.96), glassMat);
    lowerWin.position.y = 1.58;
    chassisGroup.add(lowerWin);
    const upperWin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.76, 6.86), glassMat);
    upperWin.position.y = 2.8;
    chassisGroup.add(upperWin);

    for (const pz of [-3.46, -1.7, 0, 1.7, 3.44]) {
      for (const px of [-1.2, 1.2]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.05, 0.14), redMat);
        pillar.position.set(px, 2.2, pz);
        chassisGroup.add(pillar);
      }
    }

    // Glowing BEST route LED destination board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.3, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf59e0b, emissiveIntensity: 0.95 }),
    );
    board.position.set(0, 2.24, 3.64);
    chassisGroup.add(board);

    // Curved front & rear bumpers
    const busBumper = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 2.26, 4, 8), interiorMat);
    busBumper.rotation.z = Math.PI / 2;
    busBumper.position.set(0, 0.52, 3.66);
    chassisGroup.add(busBumper);

    for (const sx of [-0.85, 0.85]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), headlightMat);
      hl.scale.set(1.2, 0.85, 0.5);
      hl.position.set(sx, 0.84, 3.64);
      chassisGroup.add(hl);
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 6), taillightMat.clone());
      tl.position.set(sx, 0.92, -3.64);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    for (const [wx, wz] of [
      [-1.18, 2.3],
      [1.18, 2.3],
      [-1.18, -1.6],
      [1.18, -1.6],
      [-1.18, -2.55],
      [1.18, -2.55],
    ]) {
      const w = createWheelMesh(0.46, 0.28);
      w.position.set(wx, 0.46, wz);
      root.add(w);
      wheels.push(w);
      addWheelArch(wx > 0 ? wx + 0.04 : wx - 0.04, 0.48, wz, 0.52);
    }
    driverSpec = { x: -0.68, y: 1.18, z: 2.86, isHandlebar: false };
    addShadow(2.6, 7.4);
  } else if (type === 'sports') {
    // Sculpted Curved Aerodynamic Bandra GT Supercar
    const paintMat = new THREE.MeshPhysicalMaterial({
      color: 0xf25c19,
      roughness: 0.18,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    });
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.48, metalness: 0.42 });

    const bodyGeo = getCachedExtrudedProfile(
      'sports_body',
      (s) => {
        s.moveTo(-2.16, 0.28);
        s.quadraticCurveTo(-2.26, 0.6, -2.14, 0.84); // muscular rear diffuser & haunch
        s.quadraticCurveTo(-1.42, 0.94, -0.78, 0.86);
        s.lineTo(0.88, 0.78);
        s.quadraticCurveTo(1.62, 0.74, 2.18, 0.52); // swooping supercar nose
        s.quadraticCurveTo(2.3, 0.36, 2.18, 0.24);
        s.closePath();
      },
      1.98,
      0.11,
    );
    const body = new THREE.Mesh(bodyGeo, paintMat);
    body.castShadow = true;
    chassisGroup.add(body);
    bodyMeshes.push(body);

    // Carbon front splitter & side skirts
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.09, 4.46), carbonMat);
    splitter.position.y = 0.23;
    chassisGroup.add(splitter);

    // Teardrop fastback translucent glass canopy
    const canopyGeo = getCachedExtrudedProfile(
      'sports_canopy',
      (s) => {
        s.moveTo(-1.38, 0.82);
        s.quadraticCurveTo(-0.75, 1.24, -0.1, 1.22);
        s.quadraticCurveTo(0.55, 1.18, 1.06, 0.76);
        s.closePath();
      },
      1.48,
      0.06,
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    chassisGroup.add(canopy);

    // Curved roof skin cap
    const roofGeo = getCachedExtrudedProfile(
      'sports_roof',
      (s) => {
        s.moveTo(-0.82, 1.18);
        s.quadraticCurveTo(-0.22, 1.29, 0.36, 1.17);
        s.lineTo(0.32, 1.24);
        s.quadraticCurveTo(-0.22, 1.35, -0.8, 1.24);
        s.closePath();
      },
      1.36,
      0.05,
    );
    const roof = new THREE.Mesh(roofGeo, paintMat);
    chassisGroup.add(roof);
    bodyMeshes.push(roof);

    // Sculpted rear GT spoiler wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.07, 0.34), carbonMat);
    wing.position.set(0, 1.08, -2.02);
    wing.rotation.x = 0.08;
    chassisGroup.add(wing);

    for (const sx of [-0.66, 0.66]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.18), carbonMat);
      strut.position.set(sx, 0.92, -2.0);
      chassisGroup.add(strut);

      const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), headlightMat);
      hl.rotation.z = Math.PI / 2;
      hl.position.set(sx, 0.56, 2.22);
      chassisGroup.add(hl);

      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), taillightMat.clone());
      tl.rotation.z = Math.PI / 2;
      tl.position.set(sx, 0.66, -2.23);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    for (const [wx, wz] of [
      [-0.95, 1.38],
      [0.95, 1.38],
      [-0.95, -1.35],
      [0.95, -1.35],
    ]) {
      const w = createWheelMesh(0.35, 0.28);
      w.position.set(wx, 0.35, wz);
      root.add(w);
      wheels.push(w);
      addWheelArch(wx > 0 ? wx + 0.04 : wx - 0.04, 0.38, wz, 0.41);
    }
    driverSpec = { x: -0.36, y: 0.56, z: -0.1, isHandlebar: false };
    addShadow(2.1, 4.6);
  } else if (type === 'police') {
    // Iconic NYPD Interceptor Patrol SUV (white hull with NYPD royal blue stripe & uniformed officer inside)
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.24, metalness: 0.26 });
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.38 });
    const bullbarMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.45, metalness: 0.72 });

    const hullGeo = getCachedExtrudedProfile(
      'police_hull',
      (s) => {
        s.moveTo(-2.14, 0.38);
        s.quadraticCurveTo(-2.22, 0.72, -2.14, 1.08);
        s.lineTo(1.02, 1.08);
        s.quadraticCurveTo(1.76, 1.06, 2.18, 0.88);
        s.quadraticCurveTo(2.26, 0.62, 2.14, 0.38);
        s.closePath();
      },
      1.96,
      0.1,
    );
    const hull = new THREE.Mesh(hullGeo, whiteMat);
    hull.castShadow = true;
    chassisGroup.add(hull);
    bodyMeshes.push(hull);

    // Signature NYPD royal-blue side patrol stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.26, 4.26), navyMat);
    stripe.position.y = 0.74;
    chassisGroup.add(stripe);

    // Translucent SUV greenhouse cabin + arched white roof
    const cabinGeo = getCachedExtrudedProfile(
      'police_cabin',
      (s) => {
        s.moveTo(-1.98, 1.04);
        s.quadraticCurveTo(-1.9, 1.56, -1.62, 1.68);
        s.lineTo(0.46, 1.68);
        s.quadraticCurveTo(0.76, 1.48, 1.06, 1.04);
        s.closePath();
      },
      1.78,
      0.06,
    );
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    chassisGroup.add(cabin);

    const roofGeo = getCachedExtrudedProfile(
      'police_roof',
      (s) => {
        s.moveTo(-1.72, 1.64);
        s.quadraticCurveTo(-0.6, 1.78, 0.54, 1.64);
        s.lineTo(0.5, 1.74);
        s.quadraticCurveTo(-0.6, 1.88, -1.68, 1.74);
        s.closePath();
      },
      1.78,
      0.06,
    );
    const roof = new THREE.Mesh(roofGeo, whiteMat);
    chassisGroup.add(roof);
    bodyMeshes.push(roof);

    // Tubular steel front bullbar
    const bullbarTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 1.48, 4, 8), bullbarMat);
    bullbarTop.rotation.z = Math.PI / 2;
    bullbarTop.position.set(0, 0.78, 2.28);
    chassisGroup.add(bullbarTop);
    const bullbarBot = bullbarTop.clone();
    bullbarBot.position.y = 0.5;
    chassisGroup.add(bullbarBot);

    // Aerodynamic red/blue roof strobe lightbar
    lightbarRed = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.44, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff1122, emissiveIntensity: 1.8, roughness: 0.2 }),
    );
    lightbarRed.rotation.z = Math.PI / 2;
    lightbarRed.position.set(-0.34, 1.9, 0.04);
    chassisGroup.add(lightbarRed);

    lightbarBlue = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.44, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2277ff, emissive: 0x1166ff, emissiveIntensity: 1.8, roughness: 0.2 }),
    );
    lightbarBlue.rotation.z = Math.PI / 2;
    lightbarBlue.position.set(0.34, 1.9, 0.04);
    chassisGroup.add(lightbarBlue);

    for (const sx of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), headlightMat);
      hl.rotation.z = Math.PI / 2;
      hl.position.set(sx, 0.84, 2.22);
      chassisGroup.add(hl);
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), taillightMat.clone());
      tl.position.set(sx, 0.88, -2.21);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    for (const [wx, wz] of [
      [-0.96, 1.42],
      [0.96, 1.42],
      [-0.96, -1.42],
      [0.96, -1.42],
    ]) {
      const w = createWheelMesh(0.39, 0.26);
      w.position.set(wx, 0.39, wz);
      root.add(w);
      wheels.push(w);
      addWheelArch(wx > 0 ? wx + 0.04 : wx - 0.04, 0.42, wz, 0.45);
    }
    driverSpec = { x: -0.42, y: 0.96, z: 0.08, isHandlebar: false };
    addShadow(2.1, 4.6);
  } else if (type === 'syndicate_van') {
    // Sculpted Armored Syndicate Van with sloped nose & translucent armored windshield
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.52, metalness: 0.56 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.38, metalness: 0.45 });

    const vanGeo = getCachedExtrudedProfile(
      'syndicate_van',
      (s) => {
        s.moveTo(-2.4, 0.42);
        s.lineTo(2.38, 0.42);
        s.quadraticCurveTo(2.5, 0.72, 2.42, 1.15);
        s.lineTo(1.76, 1.94); // sloped armored front glass angle
        s.quadraticCurveTo(1.56, 2.08, 1.24, 2.08);
        s.lineTo(-2.18, 2.08);
        s.quadraticCurveTo(-2.46, 2.02, -2.44, 1.65);
        s.closePath();
      },
      2.08,
      0.1,
    );
    const box = new THREE.Mesh(vanGeo, armorMat);
    box.castShadow = true;
    chassisGroup.add(box);
    bodyMeshes.push(box);

    const band = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.22, 4.78), trimMat);
    band.position.y = 1.08;
    chassisGroup.add(band);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.62, 0.14), glassMat);
    visor.position.set(0, 1.54, 2.12);
    visor.rotation.x = -0.58;
    chassisGroup.add(visor);

    for (const sx of [-0.74, 0.74]) {
      const hl = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), headlightMat);
      hl.rotation.z = Math.PI / 2;
      hl.position.set(sx, 0.78, 2.48);
      chassisGroup.add(hl);
      const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), taillightMat.clone());
      tl.position.set(sx, 0.86, -2.48);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }

    for (const [wx, wz] of [
      [-1.02, 1.58],
      [1.02, 1.58],
      [-1.02, -1.58],
      [1.02, -1.58],
    ]) {
      const w = createWheelMesh(0.42, 0.28);
      w.position.set(wx, 0.42, wz);
      root.add(w);
      wheels.push(w);
      addWheelArch(wx > 0 ? wx + 0.04 : wx - 0.04, 0.44, wz, 0.48);
    }
    driverSpec = { x: -0.44, y: 1.15, z: 1.38, isHandlebar: false };
    addShadow(2.2, 5.1);
  } else if (type === 'ferry') {
    // Iconic Staten Island Orange Ferry
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.36, metalness: 0.18 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34, metalness: 0.14 });
    const keelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.62 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a542d, roughness: 0.78 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });

    const hullGeo = getCachedExtrudedProfile(
      'ferry_hull',
      (s) => {
        s.moveTo(-5.8, 0.28);
        s.lineTo(5.6, 0.28);
        s.quadraticCurveTo(7.4, 0.82, 8.6, 2.05); // flared maritime bow
        s.lineTo(5.4, 1.9);
        s.lineTo(-5.8, 1.82);
        s.quadraticCurveTo(-6.1, 1.0, -5.8, 0.28);
        s.closePath();
      },
      4.15,
      0.16,
    );
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    chassisGroup.add(hull);
    bodyMeshes.push(hull);

    const keel = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.42, 11.4), keelMat);
    keel.position.y = 0.2;
    chassisGroup.add(keel);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.28, 0.32, 11.6), stripeMat);
    stripe.position.y = 1.42;
    chassisGroup.add(stripe);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.2, 10.6), woodMat);
    deck.position.y = 1.88;
    chassisGroup.add(deck);

    // Bridge wheelhouse with translucent glass & visible ferry captain
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 2.8), hullMat);
    cabin.position.set(0, 2.34, 2.5);
    chassisGroup.add(cabin);
    const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.84, 2.55), glassMat);
    bridgeWin.position.set(0, 3.16, 2.58);
    chassisGroup.add(bridgeWin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.2, 7.6), canopyMat);
    roof.position.set(0, 3.82, -1.1);
    chassisGroup.add(roof);
    bodyMeshes.push(roof);

    for (const [px, pz] of [
      [-1.72, 2.1],
      [1.72, 2.1],
      [-1.72, -1.2],
      [1.72, -1.2],
      [-1.72, -4.5],
      [1.72, -4.5],
    ]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), woodMat);
      p.position.set(px, 2.85, pz);
      chassisGroup.add(p);
    }

    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), headlightMat);
    lantern.position.set(0, 4.24, 3.2);
    chassisGroup.add(lantern);

    const sternLight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.12), taillightMat.clone());
    sternLight.position.set(0, 1.55, -5.88);
    chassisGroup.add(sternLight);
    brakeLights.push(sternLight);
    driverSpec = { x: 0, y: 2.75, z: 2.55, isHandlebar: false };
  } else if (type === 'speedboat') {
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.18,
      clearcoat: 0.92,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.28, metalness: 0.36 });
    const teakMat = new THREE.MeshStandardMaterial({ color: 0xa1622f, roughness: 0.72 });

    const boatGeo = getCachedExtrudedProfile(
      'speedboat_hull',
      (s) => {
        s.moveTo(-2.7, 0.24);
        s.lineTo(2.4, 0.24);
        s.quadraticCurveTo(3.95, 0.56, 4.95, 1.16); // sleek curved speedboat bow
        s.quadraticCurveTo(3.0, 1.24, 1.2, 1.18);
        s.lineTo(-2.7, 1.08);
        s.closePath();
      },
      2.42,
      0.12,
    );
    const hull = new THREE.Mesh(boatGeo, hullMat);
    hull.castShadow = true;
    chassisGroup.add(hull);
    bodyMeshes.push(hull);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 5.2), accentMat);
    stripe.position.set(0, 0.9, 0.05);
    chassisGroup.add(stripe);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 4.4), teakMat);
    deck.position.set(0, 1.12, -0.2);
    chassisGroup.add(deck);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.56, 0.84), glassMat);
    windshield.position.set(0, 1.44, 0.95);
    windshield.rotation.x = -0.38;
    chassisGroup.add(windshield);

    const motorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });
    for (const sx of [-0.55, 0.55]) {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.52, 4, 8), motorMat);
      m.position.set(sx, 0.72, -2.92);
      chassisGroup.add(m);
    }

    const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), headlightMat);
    navLight.position.set(0, 1.72, 1.25);
    chassisGroup.add(navLight);

    for (const sx of [-0.88, 0.88]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), taillightMat.clone());
      tl.position.set(sx, 0.95, -2.74);
      chassisGroup.add(tl);
      brakeLights.push(tl);
    }
    driverSpec = { x: -0.36, y: 1.02, z: 0.1, isHandlebar: false };
  }

  // Visible sculpted driver seated inside cabin (attached to chassisGroup so driver moves with suspension!)
  const driverRig = createSeatedDriverRig({
    x: driverSpec.x,
    y: driverSpec.y,
    z: driverSpec.z,
    shirtHex: driverOpts?.shirtHex ?? (type === 'taxi' ? 0xf8fafc : type === 'bus' ? 0x94a3b8 : 0x3b82f6),
    skinHex: driverOpts?.skinHex ?? 0x9b6b47,
    isPolice: driverOpts?.isPolice ?? type === 'police',
    isHandlebar: driverSpec.isHandlebar,
  });
  driverRig.group.visible = driverOpts?.visible ?? true;
  chassisGroup.add(driverRig.group);

  return {
    root,
    chassisGroup,
    driverGroup: driverRig.group,
    setDriverAppearance: driverRig.setColors,
    wheels,
    bodyMeshes,
    lightbarRed,
    lightbarBlue,
    brakeLights,
  };
}

const _vicePrintCache = new Map<string, THREE.CanvasTexture>();

function createViceShirtTexture(baseHex: number, accentHex: number): THREE.CanvasTexture {
  const key = `${baseHex}_${accentHex}`;
  const cached = _vicePrintCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const baseCss = `#${baseHex.toString(16).padStart(6, '0')}`;
  const accentCss = `#${accentHex.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = baseCss;
  ctx.fillRect(0, 0, 128, 128);

  // Subtle GTA 6 Vice tropical palm-frond & sunset stripe print
  ctx.fillStyle = accentCss;
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 6; i++) {
    const cx = (i * 37 + 18) % 128;
    const cy = (i * 43 + 20) % 128;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i * 1.1) % Math.PI);
    for (let f = -2; f <= 2; f++) {
      ctx.beginPath();
      ctx.ellipse(f * 5, 0, 14, 3.2, f * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = '#fde047';
  ctx.globalAlpha = 0.25;
  for (let y = 12; y < 128; y += 32) {
    ctx.beginPath();
    ctx.arc((y * 2) % 120, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  _vicePrintCache.set(key, tex);
  return tex;
}

function buildSculptedHair(
  style: HairStyleId,
  hairMat: THREE.MeshStandardMaterial,
  opts: { hasGandhiCap?: boolean; hasGajra?: boolean; hasPoliceCap?: boolean },
): THREE.Group {
  const g = new THREE.Group();

  // Base smooth cranial hair cap hugging the upper-back oval head
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.163, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  cap.scale.set(0.94, 1.07, 1.0);
  cap.position.set(0, 0.215, -0.012);
  cap.rotation.x = -0.22;
  g.add(cap);

  if (style === 'pompadour') {
    // Styled GTA 6 swept-back volume crest + clean tapered sides & nape
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), hairMat);
    crest.scale.set(1.12, 0.44, 1.34);
    crest.position.set(0, 0.342, 0.025);
    crest.rotation.x = -0.14;
    g.add(crest);

    const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.13, 5, 8), hairMat);
    wave.rotation.z = Math.PI / 2;
    wave.position.set(0, 0.348, 0.115);
    g.add(wave);

    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), hairMat);
    nape.scale.set(0.95, 0.72, 0.62);
    nape.position.set(0, 0.225, -0.075);
    g.add(nape);
  } else if (style === 'short_fade') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hairMat);
    crown.scale.set(0.96, 0.45, 1.05);
    crown.position.set(0, 0.34, 0.005);
    g.add(crown);
  } else if (style === 'slick_back') {
    const sweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.14, 6, 10), hairMat);
    sweep.rotation.x = Math.PI / 2 - 0.15;
    sweep.scale.set(1.22, 1.0, 0.65);
    sweep.position.set(0, 0.335, -0.015);
    g.add(sweep);
  } else if (style === 'wavy_bob') {
    // Curved cheek-framing side waves + fuller rounded back hair
    for (const sx of [-1, 1]) {
      const sideWave = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.16, 6, 8), hairMat);
      sideWave.position.set(sx * 0.132, 0.19, -0.01);
      sideWave.rotation.z = sx * -0.14;
      g.add(sideWave);
    }
    const backDrape = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), hairMat);
    backDrape.scale.set(1.05, 1.15, 0.72);
    backDrape.position.set(0, 0.18, -0.085);
    g.add(backDrape);
  } else if (style === 'braided_bun' || style === 'long_bun') {
    const bunY = style === 'long_bun' ? 0.31 : 0.21;
    const bunZ = style === 'long_bun' ? -0.14 : -0.165;
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.086, 10, 10), hairMat);
    bun.position.set(0, bunY, bunZ);
    g.add(bun);

    if (opts.hasGajra) {
      // Traditional Mumbai white jasmine gajra flower garland encircling the bun
      const gajra = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.02, 7, 14),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.55 }),
      );
      gajra.position.set(0, bunY, bunZ + 0.02);
      g.add(gajra);
    }
  } else if (style === 'curly_crop') {
    const puffs: Array<[number, number, number, number]> = [
      [0, 0.37, 0.02, 0.082],
      [-0.085, 0.34, 0.04, 0.072],
      [0.085, 0.34, 0.04, 0.072],
      [-0.11, 0.29, -0.05, 0.072],
      [0.11, 0.29, -0.05, 0.072],
      [0, 0.33, -0.09, 0.08],
      [0, 0.25, -0.125, 0.072],
    ];
    for (const [px, py, pz, pr] of puffs) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 8, 8), hairMat);
      puff.position.set(px, py, pz);
      g.add(puff);
    }
  } else {
    // parted_classic
    const topWave = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), hairMat);
    topWave.scale.set(1.06, 0.5, 1.15);
    topWave.position.set(0.015, 0.345, 0.01);
    g.add(topWave);
  }

  // Traditional Mumbai Dabbawala crisp white folded Gandhi cap
  if (opts.hasGandhiCap) {
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
    const gandhiCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.135, 0.12, 10), capMat);
    gandhiCap.scale.set(0.76, 1.0, 1.38);
    gandhiCap.position.set(0, 0.385, 0.01);
    g.add(gandhiCap);
  }

  // Authentic Mumbai Police peaked officer cap with glossy brim & brass star crest
  if (opts.hasPoliceCap) {
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.48 });
    const brimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.18, metalness: 0.45 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.92 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.138, 0.095, 12), navyMat);
    crown.position.set(0, 0.375, 0.008);
    g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.144, 0.03, 12), goldMat);
    band.position.set(0, 0.335, 0.008);
    g.add(band);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.156, 0.162, 0.02, 12, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      brimMat,
    );
    brim.position.set(0, 0.324, 0.088);
    g.add(brim);
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), goldMat);
    crest.position.set(0, 0.365, 0.158);
    g.add(crest);
  }

  return g;
}

export function createCharacterRig(
  opts: {
    shirtHex: number;
    pantsHex: number;
    skinHex?: number;
    accentHex?: number;
    isHostile?: boolean;
    isPlayer?: boolean;
    appearance?: CharacterAppearanceSpec;
  },
  shadowTex: THREE.Texture,
): CharacterRig {
  const spec: CharacterAppearanceSpec = opts.appearance ?? {
    id: opts.isPlayer ? 'player_default' : opts.isHostile ? 'rival_default' : 'local_default',
    label: 'Mumbai Local',
    build: opts.isPlayer ? 'athletic' : opts.isHostile ? 'broad' : 'average',
    silhouette: opts.isPlayer ? 'vice_open_shirt' : opts.isHostile ? 'biker_jacket' : 'kurta_pajama',
    hairStyle: opts.isPlayer ? 'pompadour' : opts.isHostile ? 'short_fade' : 'parted_classic',
    hairHex: 0x191512,
    skinHex: opts.skinHex ?? 0x9c6b49,
    shirtHex: opts.shirtHex,
    innerShirtHex: 0xf8fafc,
    pantsHex: opts.pantsHex,
    shoeHex: 0x1e1b18,
    accentHex: opts.accentHex ?? 0xf59e0b,
    hasGoldChain: opts.isPlayer,
    hasSunglasses: opts.isPlayer,
    shortSleeves: opts.isPlayer,
  };

  const metrics = BODY_BUILD_METRICS[spec.build];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(metrics.heightScale);
  root.add(bodyGroup);

  const hitMeshes: THREE.Mesh[] = [];
  const fabricMaterials: THREE.MeshStandardMaterial[] = [];

  const skinMat = new THREE.MeshStandardMaterial({
    color: spec.skinHex,
    roughness: 0.72,
    metalness: 0.02,
  });

  const isVicePatterned =
    spec.silhouette === 'vice_open_shirt' && (opts.isPlayer || spec.id === 'juhu_beach_cruiser');
  const shirtMat = new THREE.MeshStandardMaterial({
    color: isVicePatterned ? 0xffffff : spec.shirtHex,
    map: isVicePatterned ? createViceShirtTexture(spec.shirtHex, spec.accentHex) : null,
    roughness: spec.silhouette === 'biker_jacket' ? 0.42 : 0.72,
    metalness: spec.silhouette === 'biker_jacket' ? 0.22 : 0.05,
  });
  fabricMaterials.push(shirtMat);

  const innerMat = new THREE.MeshStandardMaterial({
    color: spec.innerShirtHex ?? 0xf8fafc,
    roughness: 0.76,
    metalness: 0.02,
  });
  fabricMaterials.push(innerMat);

  const pantsMat = new THREE.MeshStandardMaterial({
    color: spec.pantsHex,
    roughness: 0.8,
    metalness: 0.04,
  });
  fabricMaterials.push(pantsMat);

  const shoeMat = new THREE.MeshStandardMaterial({
    color: spec.shoeHex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.78 });
  const hairMat = new THREE.MeshStandardMaterial({ color: spec.hairHex, roughness: 0.68, metalness: 0.08 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: 0.44,
    metalness: 0.22,
  });
  fabricMaterials.push(accentMat);

  // Contact shadow disc grounded at y=0.025
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 16),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.46 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  // === 1. CURVED ANATOMICAL LEGS (Capsule Thighs + Tapered Calves + Rounded Sneakers) ===
  const legSpread = 0.112 * metrics.hipScale;
  const limbR = metrics.limbRadiusScale;
  const makeCurvedLeg = (xOff: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.8, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.072 * limbR, 0.22, 5, 10), pantsMat);
    thigh.position.set(0, -0.19, 0.006);
    thigh.castShadow = true;
    pivot.add(thigh);
    hitMeshes.push(thigh);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.056 * limbR, 0.24, 5, 10), pantsMat);
    calf.position.set(0, -0.49, -0.008);
    calf.castShadow = true;
    pivot.add(calf);

    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.054 * limbR, 0.115, 5, 8), shoeMat);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.0, 1.0, 0.82);
    shoe.position.set(0, -0.735, 0.042);
    pivot.add(shoe);

    const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.056 * limbR, 0.118, 4, 8), soleMat);
    sole.rotation.x = Math.PI / 2;
    sole.scale.set(1.02, 1.02, 0.34);
    sole.position.set(0, -0.768, 0.042);
    pivot.add(sole);

    return pivot;
  };
  const leftLeg = makeCurvedLeg(-legSpread);
  const rightLeg = makeCurvedLeg(legSpread);
  bodyGroup.add(leftLeg, rightLeg);

  // Rounded pelvis/hip capsule blending hips naturally into thighs
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.155 * metrics.hipScale, 12, 10), pantsMat);
  pelvis.scale.set(1.14, 0.72, 0.78);
  pelvis.position.set(0, 0.81, 0);
  bodyGroup.add(pelvis);

  // === 2. SCULPTED ORGANIC TORSO (Curved Belly, Tapered Waist, Rounded Chest & Shoulders) ===
  const torsoPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.148 * metrics.hipScale, 0.04),
    new THREE.Vector2(0.138 * metrics.bellyScale, 0.16), // waist taper
    new THREE.Vector2(0.158 * metrics.bellyScale, 0.27), // natural softly curved belly
    new THREE.Vector2(0.172 * metrics.shoulderScale, 0.43), // ribcage
    new THREE.Vector2(0.192 * metrics.shoulderScale, 0.56), // rounded chest & shoulders
    new THREE.Vector2(0.125 * metrics.shoulderScale, 0.64), // collarbone slope
    new THREE.Vector2(0.068, 0.675), // neck base
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 14);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.scale.set(1.06, 1.0, 0.74);
  torso.position.set(0, 0.8, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);
  hitMeshes.push(torso);

  // Silhouette-specific GTA 6 & Mumbai fashion details
  if (
    spec.silhouette === 'vice_open_shirt' ||
    spec.silhouette === 'street_bomber' ||
    spec.silhouette === 'biker_jacket' ||
    spec.silhouette === 'linen_resort' ||
    spec.silhouette === 'office_blazer'
  ) {
    // Layered inner tee/tank visible through the open shirt or jacket front
    const innerChest = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.34, 5, 10), innerMat);
    innerChest.scale.set(1.02, 1.0, 0.56);
    innerChest.position.set(0, 1.15, 0.095);
    bodyGroup.add(innerChest);

    // Sculpted open Cuban collar / jacket lapels curving down both sides
    for (const sx of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.36, 4, 8), shirtMat);
      lapel.position.set(sx * 0.092 * metrics.shoulderScale, 1.16, 0.115);
      lapel.rotation.z = sx * -0.14;
      bodyGroup.add(lapel);
    }

    if (spec.silhouette === 'office_blazer') {
      // Crisp crimson silk tie
      const tie = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.32, 6), accentMat);
      tie.rotation.x = Math.PI;
      tie.position.set(0, 1.19, 0.142);
      bodyGroup.add(tie);
    } else if (spec.silhouette === 'street_bomber' || spec.silhouette === 'biker_jacket') {
      // Ribbed waist hem & jacket collar ring
      const waistBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.155 * metrics.bellyScale, 0.024, 6, 14),
        accentMat,
      );
      waistBand.rotation.x = Math.PI / 2;
      waistBand.scale.set(1.06, 0.74, 1.0);
      waistBand.position.set(0, 0.85, 0);
      bodyGroup.add(waistBand);
    }
  } else if (spec.silhouette === 'saree_drape') {
    // Flowing pleated Mumbai silk saree lower drape + golden-bordered diagonal pallu sash
    const skirtPts = [
      new THREE.Vector2(0.22 * metrics.hipScale, 0.0),
      new THREE.Vector2(0.19 * metrics.hipScale, 0.34),
      new THREE.Vector2(0.165 * metrics.hipScale, 0.68),
    ];
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 14), shirtMat);
    skirt.scale.set(1.05, 1.0, 0.84);
    skirt.position.set(0, 0.16, 0);
    bodyGroup.add(skirt);

    const borderTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.215 * metrics.hipScale, 0.018, 6, 16),
      accentMat,
    );
    borderTrim.rotation.x = Math.PI / 2;
    borderTrim.scale.set(1.05, 0.84, 1.0);
    borderTrim.position.set(0, 0.18, 0);
    bodyGroup.add(borderTrim);

    const pallu = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.44, 5, 8), accentMat);
    pallu.position.set(-0.02, 1.15, 0.125);
    pallu.rotation.z = 0.52;
    bodyGroup.add(pallu);
  } else if (spec.silhouette === 'kurta_pajama' || spec.silhouette === 'trench_dress') {
    const hem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155 * metrics.hipScale, 0.2 * metrics.hipScale, 0.34, 14, 1, true),
      shirtMat,
    );
    hem.material.side = THREE.DoubleSide;
    hem.scale.set(1.06, 1.0, 0.78);
    hem.position.set(0, 0.7, 0);
    bodyGroup.add(hem);

    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.15 * metrics.bellyScale, 0.02, 6, 14),
      accentMat,
    );
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1.06, 0.76, 1.0);
    belt.position.set(0, 0.94, 0);
    bodyGroup.add(belt);
  } else if (spec.silhouette === 'dabbawala_vest' || spec.silhouette === 'artisan_apron') {
    const sling = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.48, 4, 8), accentMat);
    sling.position.set(0, 1.14, 0.13);
    sling.rotation.z = -0.58;
    bodyGroup.add(sling);
  } else if (spec.silhouette === 'hoodie_joggers' || spec.silhouette === 'monsoon_parka') {
    // Cozy curved hood collar resting behind neck
    const hoodRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.044, 8, 14), shirtMat);
    hoodRing.rotation.x = Math.PI / 2 + 0.25;
    hoodRing.position.set(0, 1.44, -0.045);
    bodyGroup.add(hoodRing);
  } else if (spec.silhouette === 'police_uniform') {
    // Authentic Mumbai Police Sam Browne leather belt, diagonal cross-strap, brass buckle & epaulets
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.48, metalness: 0.18 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.92 });
    const navyEpaulet = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    const waistBelt = new THREE.Mesh(
      new THREE.TorusGeometry(0.156 * metrics.bellyScale, 0.025, 6, 14),
      leatherMat,
    );
    waistBelt.rotation.x = Math.PI / 2;
    waistBelt.scale.set(1.06, 0.76, 1.0);
    waistBelt.position.set(0, 0.93, 0);
    bodyGroup.add(waistBelt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), brassMat);
    buckle.position.set(0, 0.93, 0.145);
    bodyGroup.add(buckle);

    const crossStrap = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.52, 4, 8), leatherMat);
    crossStrap.position.set(0, 1.18, 0.125);
    crossStrap.rotation.z = -0.54;
    bodyGroup.add(crossStrap);

    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.015, 8), brassMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.078, 1.27, 0.142);
    bodyGroup.add(badge);

    for (const sx of [-1, 1]) {
      const epaulet = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.06), navyEpaulet);
      epaulet.position.set(sx * 0.155 * metrics.shoulderScale, 1.42, 0);
      bodyGroup.add(epaulet);
    }
  }

  // Gleaming GTA 6 protagonist gold chain necklace
  if (spec.hasGoldChain) {
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.012, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.92 }),
    );
    chain.rotation.x = Math.PI / 2 + 0.42;
    chain.position.set(0, 1.41, 0.068);
    bodyGroup.add(chain);
  }

  // === 3. ROUND ORGANIC HEAD, NECK, FACE & SCULPTED HAIR ===
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.46, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.068, 0.14, 10), skinMat);
  neck.position.set(0, 0.05, 0);
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  head.scale.set(0.92, 1.08, 0.98);
  head.position.set(0, 0.215, 0.005);
  head.castShadow = true;
  headGroup.add(head);
  hitMeshes.push(head);

  // Subtle curved ears & nose bridge
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skinMat);
    ear.scale.set(0.45, 1.05, 0.72);
    ear.position.set(sx * 0.14, 0.21, -0.008);
    headGroup.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), skinMat);
  nose.scale.set(0.82, 1.35, 1.15);
  nose.position.set(0, 0.205, 0.152);
  headGroup.add(nose);

  // Expressive eyes & eyebrows
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x16110e, roughness: 0.2, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat);
    eye.position.set(sx * 0.052, 0.235, 0.136);
    headGroup.add(eye);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.032, 4, 6), hairMat);
    brow.rotation.z = Math.PI / 2 - sx * 0.12;
    brow.position.set(sx * 0.052, 0.264, 0.138);
    headGroup.add(brow);
  }

  if (spec.hasFacialHair) {
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.058, 4, 6), hairMat);
    stache.rotation.z = Math.PI / 2;
    stache.position.set(0, 0.172, 0.146);
    headGroup.add(stache);
  }

  // Sculpted volumetric hair & optional headwear (Gandhi cap / Gajra / Mumbai Police peaked cap)
  headGroup.add(
    buildSculptedHair(spec.hairStyle, hairMat, {
      hasGandhiCap: spec.hasGandhiCap,
      hasGajra: spec.hasGajra,
      hasPoliceCap: spec.hasPoliceCap,
    }),
  );

  // Curved GTA 6 aviator sunglasses (automatically tucked away in Heavy Monsoon)
  let sunglassesGroup: THREE.Group | undefined;
  if (spec.hasSunglasses) {
    sunglassesGroup = new THREE.Group();
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.1,
      metalness: 0.92,
    });
    const rimGoldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.9 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), lensMat);
      lens.scale.set(1.12, 0.78, 0.34);
      lens.position.set(sx * 0.056, 0.232, 0.148);
      sunglassesGroup.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.04, 4, 6), rimGoldMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.242, 0.154);
    sunglassesGroup.add(bridge);
    headGroup.add(sunglassesGroup);
  }

  // === 4. CURVED ARTICULATED ARMS (Shoulder Deltoids + Upper Arm + Forearm + Hands) ===
  const armOffset = 0.188 * metrics.shoulderScale + 0.016;
  const makeCurvedArm = (xOff: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 1.355, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.062 * limbR, 10, 8), shirtMat);
    shoulder.scale.set(0.96, 1.05, 0.92);
    pivot.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052 * limbR, 0.17, 5, 10), shirtMat);
    upperArm.position.y = -0.135;
    upperArm.castShadow = true;
    pivot.add(upperArm);
    hitMeshes.push(upperArm);

    const forearmMat = spec.shortSleeves ? skinMat : shirtMat;
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.043 * limbR, 0.18, 5, 10), forearmMat);
    forearm.position.set(0, -0.355, 0.015);
    forearm.rotation.x = -0.08;
    pivot.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046 * limbR, 8, 8), skinMat);
    hand.scale.set(0.85, 1.15, 0.72);
    hand.position.set(0, -0.5, 0.025);
    pivot.add(hand);

    return pivot;
  };
  const leftArm = makeCurvedArm(-armOffset);
  const rightArm = makeCurvedArm(armOffset);
  bodyGroup.add(leftArm, rightArm);

  // Mumbai Police patrol baton / lathi held in officer's right hand
  if (spec.hasBaton) {
    const baton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.023, 0.56, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.55, metalness: 0.15 }),
    );
    baton.rotation.x = Math.PI * 0.42;
    baton.position.set(0, -0.52, 0.24);
    rightArm.add(baton);
  }

  // === 5. MUMBAI WEATHER CLOTHING: MONSOON UMBRELLA & WATERPROOF RAINCOAT PONCHO ===
  let umbrellaGroup: THREE.Group | undefined;
  if (spec.umbrellaHex) {
    umbrellaGroup = new THREE.Group();
    // Anchored at left hand so raising leftArm holds umbrella smoothly overhead
    umbrellaGroup.position.set(0, -0.49, 0.05);
    umbrellaGroup.rotation.x = 0.92;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6), poleMat);
    shaft.position.y = 0.52;
    umbrellaGroup.add(shaft);

    const canopyMat = new THREE.MeshStandardMaterial({
      color: spec.umbrellaHex,
      roughness: 0.3,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.44),
      canopyMat,
    );
    canopy.position.y = 0.5;
    umbrellaGroup.add(canopy);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.09, 6), poleMat);
    tip.position.y = 1.15;
    umbrellaGroup.add(tip);

    umbrellaGroup.visible = false;
    leftArm.add(umbrellaGroup);
  }

  let raincoatGroup: THREE.Group | undefined;
  if (spec.raincoatHex) {
    raincoatGroup = new THREE.Group();
    const ponchoMat = new THREE.MeshStandardMaterial({
      color: spec.raincoatHex,
      roughness: 0.24,
      metalness: 0.18,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ponchoPts = [
      new THREE.Vector2(0.32 * metrics.shoulderScale, 0.0),
      new THREE.Vector2(0.28 * metrics.shoulderScale, 0.34),
      new THREE.Vector2(0.25 * metrics.shoulderScale, 0.62),
      new THREE.Vector2(0.11, 0.72),
    ];
    const poncho = new THREE.Mesh(new THREE.LatheGeometry(ponchoPts, 14), ponchoMat);
    poncho.scale.set(1.06, 1.0, 0.86);
    poncho.position.set(0, 0.74, 0);
    raincoatGroup.add(poncho);

    const rainHood = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      ponchoMat,
    );
    rainHood.position.set(0, 1.66, -0.02);
    rainHood.rotation.x = -0.35;
    raincoatGroup.add(rainHood);

    raincoatGroup.visible = false;
    bodyGroup.add(raincoatGroup);
  }

  let telegraphRing: THREE.Mesh | undefined;
  if (opts.isHostile) {
    telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 24),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.y = 0.06;
    telegraphRing.visible = false;
    root.add(telegraphRing);
  }

  const rig: CharacterRig = {
    root,
    bodyGroup,
    headGroup,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    telegraphRing,
    hitMeshes,
    umbrellaGroup,
    raincoatGroup,
    sunglassesGroup,
    isCarryingUmbrella: false,
    applyWeatherGear: (weather: WeatherKind, rainIntensity: number) => {
      const state = getWeatherClothingState(weather, rainIntensity, spec);
      rig.isCarryingUmbrella = state.showUmbrella;
      if (umbrellaGroup) umbrellaGroup.visible = state.showUmbrella;
      if (raincoatGroup) raincoatGroup.visible = state.showRaincoat;
      if (sunglassesGroup) sunglassesGroup.visible = state.showSunglasses;
      for (let i = 0; i < fabricMaterials.length; i++) {
        fabricMaterials[i].roughness = state.fabricRoughness;
        fabricMaterials[i].metalness = state.fabricMetalness;
      }
    },
  };

  return rig;
}

export function createGatewayArch(
  sandstoneMat: THREE.MeshStandardMaterial,
  trimMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const g = new THREE.Group();

  // Stepped stone plinth flanks
  for (const sx of [-7.5, 7.5]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.6, 6.4), trimMat);
    base.position.set(sx, 0.8, 0);
    base.receiveShadow = true;
    g.add(base);

    // Main sandstone piers
    const pier = new THREE.Mesh(new THREE.BoxGeometry(5.6, 15.0, 5.6), sandstoneMat);
    pier.position.set(sx, 9.1, 0);
    pier.castShadow = true;
    pier.receiveShadow = true;
    g.add(pier);

    // Flanking Indo-Saracenic corner turret towers
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 19.5, 8), sandstoneMat);
    turret.position.set(sx + Math.sign(sx) * 2.8, 9.75, 0);
    turret.castShadow = true;
    g.add(turret);

    // Chhatri onion cupola domes atop turrets
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 12), trimMat);
    dome.position.set(sx + Math.sign(sx) * 2.8, 20.1, 0);
    dome.scale.set(1, 1.25, 1);
    g.add(dome);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.8, 8), trimMat);
    spire.position.set(sx + Math.sign(sx) * 2.8, 22.1, 0);
    g.add(spire);
  }

  // Grand spanning arch entablature above central drive-through vault (clear height 11.5m!)
  const archSpan = new THREE.Mesh(new THREE.BoxGeometry(21.4, 5.4, 5.8), sandstoneMat);
  archSpan.position.set(0, 14.2, 0);
  archSpan.castShadow = true;
  g.add(archSpan);

  // Decorative cornice & carved parapet
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.9, 6.5), trimMat);
  cornice.position.set(0, 17.2, 0);
  g.add(cornice);

  // Central royal pavilion dome
  const centerDrum = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 2.2, 12), sandstoneMat);
  centerDrum.position.set(0, 18.6, 0);
  g.add(centerDrum);

  const mainDome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 14), trimMat);
  mainDome.position.set(0, 20.4, 0);
  mainDome.scale.set(1, 1.15, 1);
  g.add(mainDome);

  const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 8), trimMat);
  mainSpire.position.set(0, 24.4, 0);
  g.add(mainSpire);

  // Warm golden monument uplight glow lanterns
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffefc2,
    emissive: 0xffa826,
    emissiveIntensity: 1.5,
  });
  for (const sx of [-4.4, 4.4]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), lanternMat);
    l.position.set(sx, 4.8, 2.95);
    g.add(l);
  }

  return g;
}

interface SharedSignalBucketMats {
  nsRed: THREE.MeshStandardMaterial;
  nsAmber: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewAmber: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

const _signalBuckets: SharedSignalBucketMats[] = [0, 1, 2, 3].map(() => ({
  nsRed: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff2424, emissiveIntensity: 0.1, roughness: 0.2 }),
  nsAmber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xffaa00, emissiveIntensity: 0.1, roughness: 0.2 }),
  nsGreen: new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16f565, emissiveIntensity: 0.1, roughness: 0.2 }),
  ewRed: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff2424, emissiveIntensity: 0.1, roughness: 0.2 }),
  ewAmber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xffaa00, emissiveIntensity: 0.1, roughness: 0.2 }),
  ewGreen: new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16f565, emissiveIntensity: 0.1, roughness: 0.2 }),
}));

export function updateSharedTrafficSignalMaterials(simTime: number): void {
  for (let b = 0; b < _signalBuckets.length; b++) {
    const mat = _signalBuckets[b];
    const state = getTrafficSignalState(simTime, b * 3.5);
    mat.nsRed.emissiveIntensity = state.ns === 'red' ? 2.6 : 0.06;
    mat.nsAmber.emissiveIntensity = state.ns === 'amber' ? 2.5 : 0.06;
    mat.nsGreen.emissiveIntensity = state.ns === 'green' ? 2.6 : 0.06;
    mat.ewRed.emissiveIntensity = state.ew === 'red' ? 2.6 : 0.06;
    mat.ewAmber.emissiveIntensity = state.ew === 'amber' ? 2.5 : 0.06;
    mat.ewGreen.emissiveIntensity = state.ew === 'green' ? 2.6 : 0.06;
  }
}

const _sigPoleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.72 });
const _sigStripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
const _sigBoxMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.48, metalness: 0.42 });
const _sigPoleGeo = new THREE.CylinderGeometry(0.14, 0.19, 6.4, 8);
const _sigStripeGeo = new THREE.CylinderGeometry(0.185, 0.195, 0.85, 8);
const _sigArmNSGeo = new THREE.BoxGeometry(0.16, 0.16, 4.4);
const _sigArmEWGeo = new THREE.BoxGeometry(4.4, 0.16, 0.16);
const _sigHousingGeo = new THREE.BoxGeometry(0.52, 1.42, 0.42);
const _sigLampGeo = new THREE.SphereGeometry(0.145, 10, 8);
const _sigVisorGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.22, 10, 1, true, 0, Math.PI);
_sigVisorGeo.rotateZ(Math.PI / 2);
_sigVisorGeo.rotateY(Math.PI / 2);

export function createTrafficSignalRig(phaseBucket = 0): TrafficSignalRig {
  const bucket = _signalBuckets[((phaseBucket % 4) + 4) % 4];
  const root = new THREE.Group();

  // Tall Mumbai black-and-yellow striped signal pole
  const pole = new THREE.Mesh(_sigPoleGeo, _sigPoleMat);
  pole.position.y = 3.2;
  root.add(pole);

  const stripe = new THREE.Mesh(_sigStripeGeo, _sigStripeMat);
  stripe.position.y = 1.4;
  root.add(stripe);

  // Cantilever mast arms projecting out over BOTH lanes so drivers see signals clearly ahead!
  const armNS = new THREE.Mesh(_sigArmNSGeo, _sigPoleMat);
  armNS.position.set(0, 6.0, 2.15);
  root.add(armNS);

  const armEW = new THREE.Mesh(_sigArmEWGeo, _sigPoleMat);
  armEW.position.set(-2.15, 6.0, 0);
  root.add(armEW);

  // Dual-facing signal head (lamps on BOTH +Z and -Z faces of housing so approaching traffic from either side sees it!)
  const makeDualLampHead = (
    x: number,
    z: number,
    rotY: number,
    redMat: THREE.MeshStandardMaterial,
    amberMat: THREE.MeshStandardMaterial,
    greenMat: THREE.MeshStandardMaterial,
  ) => {
    const head = new THREE.Group();
    head.position.set(x, 5.42, z);
    head.rotation.y = rotY;
    head.add(new THREE.Mesh(_sigHousingGeo, _sigBoxMat));

    const addSide = (zSign: 1 | -1) => {
      const r = new THREE.Mesh(_sigLampGeo, redMat);
      r.position.set(0, 0.42, zSign * 0.2);
      const a = new THREE.Mesh(_sigLampGeo, amberMat);
      a.position.set(0, 0, zSign * 0.2);
      const g = new THREE.Mesh(_sigLampGeo, greenMat);
      g.position.set(0, -0.42, zSign * 0.2);
      head.add(r, a, g);
      for (const vy of [0.42, 0, -0.42]) {
        const visor = new THREE.Mesh(_sigVisorGeo, _sigBoxMat);
        visor.position.set(0, vy + 0.04, zSign * 0.27);
        head.add(visor);
      }
      return { r, a, g };
    };
    const front = addSide(1);
    addSide(-1);
    root.add(head);
    return front;
  };

  // NS signal hangs over EW arm (visible along Z), EW signal hangs over NS arm (visible along X)
  const ns = makeDualLampHead(-3.6, 0, 0, bucket.nsRed, bucket.nsAmber, bucket.nsGreen);
  const ew = makeDualLampHead(0, 3.6, Math.PI / 2, bucket.ewRed, bucket.ewAmber, bucket.ewGreen);

  return {
    root,
    nsRed: ns.r,
    nsAmber: ns.a,
    nsGreen: ns.g,
    ewRed: ew.r,
    ewAmber: ew.a,
    ewGreen: ew.g,
  };
}

let _crosswalkMat: THREE.MeshStandardMaterial | null = null;
let _crosswalkGeo: THREE.PlaneGeometry | null = null;

export function createIntersectionCrosswalkMesh(): THREE.Mesh {
  if (!_crosswalkMat) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#383635';
    ctx.fillRect(0, 0, size, size);

    // Subtle asphalt speckle
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect((i * 73) % size, (i * 137) % size, 3, 3);
    }

    // Crisp white painted Mumbai zebra crosswalk stripes & thick white STOP lines on all 4 sides
    ctx.fillStyle = 'rgba(248, 245, 232, 0.88)';
    const stripeCount = 8;
    const margin = 74;
    const span = size - margin * 2;
    const step = span / stripeCount;

    for (let i = 0; i < stripeCount; i++) {
      const p = margin + i * step + 5;
      // North & South zebra crosswalks
      ctx.fillRect(p, 24, step * 0.56, 42);
      ctx.fillRect(p, size - 66, step * 0.56, 42);
      // West & East zebra crosswalks
      ctx.fillRect(24, p, 42, step * 0.56);
      ctx.fillRect(size - 66, p, 42, step * 0.56);
    }

    // Bold solid white STOP lines ahead of each crosswalk
    ctx.fillStyle = 'rgba(255, 250, 236, 0.94)';
    ctx.fillRect(68, 8, size - 136, 10);
    ctx.fillRect(68, size - 18, size - 136, 10);
    ctx.fillRect(8, 68, 10, size - 136);
    ctx.fillRect(size - 18, 68, 10, size - 136);

    // Yellow Mumbai no-blocking junction box diagonals
    ctx.strokeStyle = 'rgba(245, 185, 34, 0.42)';
    ctx.lineWidth = 4;
    ctx.strokeRect(118, 118, size - 236, size - 236);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    _crosswalkMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0.04 });
    _crosswalkGeo = new THREE.PlaneGeometry(ROAD_WIDTH + 6.4, ROAD_WIDTH + 6.4);
  }
  const mesh = new THREE.Mesh(_crosswalkGeo!, _crosswalkMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export function createChaiStall(accentHex: number, kind: StallKind = 'hotdog'): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.82 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4b2f1a, roughness: 0.88 });
  const awningMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.72 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 0.78 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.24, metalness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.65,
  });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.96, 1.28), woodMat);
  counter.position.y = 0.56;
  counter.castShadow = true;
  g.add(counter);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.08, 1.36), darkWoodMat);
  counterTop.position.y = 1.06;
  g.add(counterTop);

  for (const [px, pz] of [
    [-1.24, -0.56],
    [1.24, -0.56],
    [-1.24, 0.56],
    [1.24, 0.56],
  ]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.55, 6), woodMat);
    p.position.set(px, 1.275, pz);
    g.add(p);
  }

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.14, 1.9), awningMat);
  canopy.position.set(0, 2.58, 0.06);
  canopy.rotation.x = 0.14;
  g.add(canopy);

  const trimBand = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.18, 0.1), stripeMat);
  trimBand.position.set(0, 2.42, 0.98);
  g.add(trimBand);

  if (kind === 'coffee_bagel') {
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.44, 10), brassMat);
    urn.position.set(-0.65, 1.3, 0.08);
    g.add(urn);
    for (let i = 0; i < 4; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.15, 8), glassMat);
      cup.position.set(0.2 + i * 0.17, 1.18, 0.2);
      g.add(cup);
    }
  } else if (kind === 'hotdog' || kind === 'halal') {
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.55, metalness: 0.72 });
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.6), grillMat);
    grill.position.set(-0.55, 1.15, 0.05);
    g.add(grill);
    const bunTray = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.22, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xf4c989, roughness: 0.85 }),
    );
    bunTray.position.set(0.55, 1.21, 0.1);
    g.add(bunTray);
  } else if (kind === 'pretzel' || kind === 'pizza_slice') {
    const caseBox = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 0.65), glassMat);
    caseBox.position.set(-0.25, 1.34, 0.14);
    g.add(caseBox);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 10), brassMat);
    jar.position.set(0.85, 1.28, -0.05);
    g.add(jar);
  } else if (kind === 'flowers') {
    const roseMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.82 });
    const yellowFlowerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.82 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
    for (let i = 0; i < 6; i++) {
      const fx = -1.0 + i * 0.4;
      const bouquet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6),
        i % 3 === 0 ? roseMat : i % 3 === 1 ? yellowFlowerMat : whiteMat,
      );
      bouquet.position.set(fx, 2.04, 0.82);
      g.add(bouquet);
    }
    for (let b = 0; b < 3; b++) {
      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.2, 0.26, 10),
        b === 1 ? roseMat : yellowFlowerMat,
      );
      basket.position.set(-0.7 + b * 0.7, 1.22, 0.12);
      g.add(basket);
    }
  }

  // Warm hanging bulb illuminating the stall at golden hour
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff5d6, emissive: 0xffb32c, emissiveIntensity: 1.6 }),
  );
  bulb.position.set(0, 2.25, 0.2);
  g.add(bulb);

  return g;
}

export function createSeagullRig(species: BirdSpecies = 'seagull'): SeagullRig {
  return createRealisticBirdRig(species);
}

/**
 * Builds a driveable elevated Mumbai concrete flyover viaduct with smooth entry/exit ramps,
 * asphalt driving deck, jersey barriers, lamp poles, and support piers placed clear of cross-lanes.
 */
export function createFlyoverMesh(def: FlyoverDef, asphaltMat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9c968d, roughness: 0.86, metalness: 0.05 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe5b842, roughness: 0.65, metalness: 0.1 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.45, metalness: 0.72 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe49c });

  const width = def.halfWidth * 2;
  const flatStart = def.startCoord + def.rampLen;
  const flatEnd = def.endCoord - def.rampLen;
  const flatLen = flatEnd - flatStart;
  const deckMid = (flatStart + flatEnd) * 0.5;
  const h = def.deckHeight;

  // Build in local X-along frame, then rotate if axis === 'ns'
  const local = new THREE.Group();
  if (def.axis === 'ew') {
    local.position.set(0, 0, def.centerCoord);
  } else {
    local.position.set(def.centerCoord, 0, 0);
    local.rotation.y = -Math.PI / 2;
  }
  group.add(local);

  // 1. Flat elevated viaduct box girder + road surface
  const girder = new THREE.Mesh(new THREE.BoxGeometry(flatLen, 0.9, width + 0.6), concreteMat);
  girder.position.set(deckMid, h - 0.45, 0);
  girder.receiveShadow = true;
  local.add(girder);

  const deckRoad = new THREE.Mesh(new THREE.PlaneGeometry(flatLen, width - 0.6), asphaltMat);
  deckRoad.rotation.x = -Math.PI / 2;
  deckRoad.position.set(deckMid, h + 0.03, 0);
  local.add(deckRoad);

  // Yellow center stripe
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(flatLen, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xf5b942 }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(deckMid, h + 0.05, 0);
  local.add(stripe);

  // Side concrete safety barriers + amber top curb
  for (const sz of [-def.halfWidth, def.halfWidth]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(flatLen, 0.95, 0.45), concreteMat);
    wall.position.set(deckMid, h + 0.45, sz);
    local.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(flatLen, 0.14, 0.5), barrierMat);
    cap.position.set(deckMid, h + 0.96, sz);
    local.add(cap);
  }

  // Overhead flyover lights every 24m
  for (let lx = flatStart + 8; lx <= flatEnd - 8; lx += 24) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 6), poleMat);
    pole.position.set(lx, h + 2.6, def.halfWidth + 0.05);
    local.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), bulbMat);
    bulb.position.set(lx, h + 5.25, def.halfWidth - 0.45);
    local.add(bulb);
  }

  // 2. Smooth Entry & Exit Sloped Ramps
  const addRamp = (fromX: number, toX: number, rise: boolean) => {
    const run = Math.abs(toX - fromX);
    const hyp = Math.hypot(run, h);
    const slopeAngle = Math.atan2(h, run) * (rise ? 1 : -1);
    const midX = (fromX + toX) * 0.5;

    const rampGrp = new THREE.Group();
    rampGrp.position.set(midX, h * 0.5, 0);
    rampGrp.rotation.z = slopeAngle;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(hyp, 0.55, width + 0.4), concreteMat);
    slab.position.y = -0.275;
    rampGrp.add(slab);

    const surface = new THREE.Mesh(new THREE.PlaneGeometry(hyp, width - 0.6), asphaltMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.03;
    rampGrp.add(surface);

    for (const sz of [-def.halfWidth, def.halfWidth]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(hyp, 0.72, 0.4), barrierMat);
      curb.position.set(0, 0.36, sz);
      rampGrp.add(curb);
    }
    local.add(rampGrp);
  };

  addRamp(def.startCoord, flatStart, true);
  addRamp(flatEnd, def.endCoord, false);

  // 3. Support Concrete Piers placed safely between cross-streets (never inside intersections!)
  const pierCoords: number[] = [];
  for (let px = flatStart + 2; px <= flatEnd - 2; px += 28) {
    // Skip coordinates within 12m of any avenue center across all 7 roads
    const nearCross = ROAD_COORDS.some((r) => Math.abs(px - r) < 12);
    if (!nearCross) pierCoords.push(px);
  }
  for (const px of pierCoords) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, h - 0.8, 1.8), concreteMat);
    col.position.set(px, (h - 0.8) * 0.5, 0);
    local.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, width - 0.8), concreteMat);
    cap.position.set(px, h - 0.95, 0);
    local.add(cap);
  }

  return group;
}

/**
 * Picturesque wooden Mumbai Gateway–Elephanta harbor ferry boat for Arabian Sea ambiance.
 */
export function createHarborFerry(): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.48 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x854d27, roughness: 0.8 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.72 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 13.5), hullMat);
  hull.position.y = 0.6;
  g.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.6, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1.25, 1, 0.55);
  bow.position.set(0, 0.6, 8.4);
  g.add(bow);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.45, 13.6), stripeMat);
  stripe.position.y = 1.05;
  g.add(stripe);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 11.5), woodMat);
  deck.position.y = 1.55;
  g.add(deck);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.25, 8.8), canopyMat);
  roof.position.set(0, 3.65, -0.4);
  g.add(roof);

  for (const [px, pz] of [
    [-1.7, 3.6],
    [1.7, 3.6],
    [-1.7, -4.4],
    [1.7, -4.4],
  ]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 6), woodMat);
    p.position.set(px, 2.6, pz);
    g.add(p);
  }

  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffb32c, emissiveIntensity: 1.8 }),
  );
  lantern.position.set(0, 4.15, 3.6);
  g.add(lantern);

  return g;
}

/**
 * Builds a walkable wooden & stone Mumbai harbor jetty / sunset pier extending over the Arabian Sea,
 * with timber pilings, mooring bollards, and golden coastal pier lanterns.
 */
export function createWoodenPierMesh(pier: PierZoneDef): THREE.Group {
  const g = new THREE.Group();
  const w = pier.maxX - pier.minX;
  const d = pier.maxZ - pier.minZ;
  const cx = (pier.minX + pier.maxX) * 0.5;
  const cz = (pier.minZ + pier.maxZ) * 0.5;

  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8f6642, roughness: 0.86, metalness: 0.04 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c4129, roughness: 0.9 });
  const pilingMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2c, roughness: 0.92 });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.5, metalness: 0.65 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe299 });

  const deckY = 0.24;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), plankMat);
  deck.position.set(cx, deckY - 0.25, cz);
  deck.receiveShadow = true;
  g.add(deck);

  const curbTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.22, d + 0.5), trimMat);
  curbTrim.position.set(cx, deckY - 0.52, cz);
  g.add(curbTrim);

  // Support timber pilings descending into the Hudson River
  const stepsX = Math.max(2, Math.round(w / 8));
  const stepsZ = Math.max(2, Math.round(d / 8));
  const pilingGeo = new THREE.CylinderGeometry(0.32, 0.36, 2.8, 8);
  for (let ix = 0; ix <= stepsX; ix++) {
    for (let iz = 0; iz <= stepsZ; iz++) {
      const isEdge = ix === 0 || ix === stepsX || iz === 0 || iz === stepsZ;
      if (!isEdge) continue;
      const px = pier.minX + 0.7 + (ix / stepsX) * (w - 1.4);
      const pz = pier.minZ + 0.7 + (iz / stepsZ) * (d - 1.4);
      const pile = new THREE.Mesh(pilingGeo, pilingMat);
      pile.position.set(px, -1.3, pz);
      g.add(pile);

      // Mooring bollards & occasional warm pier lamps along the perimeter
      if ((ix + iz) % 2 === 0) {
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 8), bollardMat);
        bollard.position.set(px, deckY + 0.3, pz);
        g.add(bollard);
      }
      if ((ix === 0 || ix === stepsX) && iz > 0 && iz < stepsZ && iz % 2 === 1) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6), bollardMat);
        pole.position.set(px, deckY + 2.1, pz);
        g.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), lampMat);
        bulb.position.set(px, deckY + 4.25, pz);
        g.add(bulb);
      }
    }
  }

  return g;
}

/**
 * Offshore Elephanta Lighthouse Island with rocky coast, tropical crown, wooden cargo dock,
 * and a rotating golden lighthouse beam visible across the Arabian Sea.
 */
export function createElephantaIslandMesh(): { root: THREE.Group; beamPivot: THREE.Group } {
  const root = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7c6f60, roughness: 0.92 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4b68c, roughness: 0.88 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f6e38, roughness: 0.85 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f5ee, roughness: 0.52 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc92a2a, roughness: 0.48 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x855834, roughness: 0.84 });

  // Coastal rock shelf & sandy beach rim
  const base = new THREE.Mesh(new THREE.CylinderGeometry(22.5, 26.5, 2.4, 18), rockMat);
  base.position.y = -0.35;
  base.receiveShadow = true;
  root.add(base);

  const beach = new THREE.Mesh(new THREE.CylinderGeometry(21.2, 23.2, 0.7, 18), sandMat);
  beach.position.y = 0.8;
  beach.receiveShadow = true;
  root.add(beach);

  const hill = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 17.5, 3.2, 14), grassMat);
  hill.position.set(-2, 2.4, -2);
  root.add(hill);

  // Wooden landing dock jutting southeast toward Mumbai
  const dock = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 7.2), woodMat);
  dock.position.set(21.5, 0.12, 4.0);
  root.add(dock);

  // Striped Lighthouse Tower
  const towerLower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.6, 9.5, 14), whiteMat);
  towerLower.position.set(-2, 8.2, -2);
  root.add(towerLower);

  const redBand = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.75, 4.2, 14), redMat);
  redBand.position.set(-2, 14.5, -2);
  root.add(redBand);

  const towerUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.35, 4.4, 14), whiteMat);
  towerUpper.position.set(-2, 18.6, -2);
  root.add(towerUpper);

  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.45, 2.6, 12), redMat);
  dome.position.set(-2, 23.4, -2);
  root.add(dome);

  const lanternRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 2.0, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff0ad }),
  );
  lanternRoom.position.set(-2, 21.5, -2);
  root.add(lanternRoom);

  // Rotating golden lighthouse light beams
  const beamPivot = new THREE.Group();
  beamPivot.position.set(-2, 21.5, -2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const dir of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 42, 14, 1, true), beamMat);
    cone.rotation.z = (Math.PI / 2) * dir;
    cone.position.x = -21 * dir;
    beamPivot.add(cone);
  }
  root.add(beamPivot);

  return { root, beamPivot };
}

/**
 * Floating offshore channel buoy marking Arabian Sea shipping lanes & mission drops.
 */
export function createSeaBuoyMesh(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45, metalness: 0.2 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

  const floatBody = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.65, 1.2, 10), baseMat);
  floatBody.position.y = 0.2;
  g.add(floatBody);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.52, 2.8, 8), whiteMat);
  mast.position.y = 2.1;
  g.add(mast);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  );
  beacon.position.y = 3.7;
  g.add(beacon);

  return g;
}

/**
 * Generates seamless procedural ocean wave color and bump textures on offscreen canvases.
 */
function createSeaSurfaceTextures(maxAniso: number): {
  colorTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const twoPi = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * twoPi;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * twoPi;
      // Seamless multi-directional capillary waves + rolling Arabian Sea swells
      const w1 = Math.sin(nx * 2 + ny * 1) * 0.35;
      const w2 = Math.cos(nx * 3 - ny * 4 + 0.8) * 0.25;
      const w3 = Math.sin(nx * 6 + ny * 5 + Math.cos(ny * 2)) * 0.2;
      const w4 = Math.cos(nx * 10 - ny * 8) * 0.12;
      const w5 = Math.sin(nx * 14 + ny * 13) * 0.08;
      const h = Math.max(0, Math.min(1, 0.5 + (w1 + w2 + w3 + w4 + w5) * 0.52));

      const crest = Math.max(0, (h - 0.74) / 0.26);
      const r = Math.round(11 + h * 26 + crest * 115);
      const g = Math.round(54 + h * 68 + crest * 105);
      const b = Math.round(78 + h * 66 + crest * 92);

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.min(255, r);
      cImg.data[idx + 1] = Math.min(255, g);
      cImg.data[idx + 2] = Math.min(255, b);
      cImg.data[idx + 3] = 255;

      const bv = Math.round(h * 255);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(42, 42);
  colorTex.anisotropy = maxAniso;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(48, 48);
  bumpTex.anisotropy = maxAniso;

  return { colorTex, bumpTex };
}

/**
 * Creates a realistic, subdivided animated Arabian Sea surface using PBR MeshStandardMaterial
 * extended via onBeforeCompile: rolling 3D swells, perturbed normals for sunset sun glint,
 * scrolling ripple layers, deep trough/emerald crest shading, and coastal surf foam.
 */
export function createArabianSeaMesh(maxAniso: number): {
  mesh: THREE.Mesh;
  update: (simTime: number, waveScale?: number) => void;
} {
  const { colorTex, bumpTex } = createSeaSurfaceTextures(maxAniso);

  // Subdivided single unified ocean mesh covering west Arabian Sea + north Gateway Bay + Juhu Coast
  const geo = new THREE.PlaneGeometry(1680, 1680, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.42,
    roughness: 0.24,
    metalness: 0.42,
  });

  const uniforms = {
    uTime: { value: 0 },
    uWaveScale: { value: 1.0 },
    uIslandPos: { value: new THREE.Vector2(ELEPHANTA_ISLAND.x, ELEPHANTA_ISLAND.z) },
  };

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWaveScale = uniforms.uWaveScale;
    shader.uniforms.uIslandPos = uniforms.uIslandPos;

    shader.vertexShader =
      `uniform float uTime;\nuniform float uWaveScale;\nvarying vec3 vWorldPos;\nvarying float vWaveH;\n` +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
          float ph1 = wp0.x * 0.042 + wp0.z * 0.026 + uTime * 1.15;
          float ph2 = wp0.x * -0.028 + wp0.z * 0.052 + uTime * 1.48;
          float ph3 = wp0.x * 0.085 - wp0.z * 0.072 + uTime * 2.05;
          float ph4 = wp0.x * 0.14 + wp0.z * 0.11 - uTime * 2.45;
          float dhdx = (cos(ph1) * 0.042 * 0.34 + cos(ph2) * -0.028 * 0.26 + cos(ph3) * 0.085 * 0.12 + cos(ph4) * 0.14 * 0.06) * uWaveScale;
          float dhdz = (cos(ph1) * 0.026 * 0.34 + cos(ph2) * 0.052 * 0.26 + cos(ph3) * -0.072 * 0.12 + cos(ph4) * 0.11 * 0.06) * uWaveScale;
          objectNormal = normalize(vec3(-dhdx * 1.45, 1.0, -dhdz * 1.45));`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float rawWaveH = (sin(ph1) * 0.34 + sin(ph2) * 0.26 + sin(ph3) * 0.12 + sin(ph4) * 0.06) * uWaveScale;
          float waveH = clamp(rawWaveH, -0.96, 0.90);
          transformed.y += waveH;
          vWaveH = waveH;
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );

    shader.fragmentShader =
      `uniform float uTime;\nuniform float uWaveScale;\nuniform vec2 uIslandPos;\nvarying vec3 vWorldPos;\nvarying float vWaveH;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Scrolling dual-layer ocean ripples & golden-hour / monsoon depth tinting
        float ripA = sin(vWorldPos.x * 0.22 + vWorldPos.z * 0.15 + uTime * 1.7) * 0.5 + 0.5;
        float ripB = cos(vWorldPos.x * -0.17 + vWorldPos.z * 0.27 - uTime * 1.35) * 0.5 + 0.5;
        float ripple = ripA * 0.55 + ripB * 0.45;

        float crestFactor = clamp((vWaveH + 0.65) / 1.35, 0.0, 1.0);
        float stormMix = clamp((uWaveScale - 1.0) / 0.65, 0.0, 1.0);
        vec3 deepWater = mix(vec3(0.035, 0.16, 0.26), vec3(0.04, 0.09, 0.14), stormMix);
        vec3 midTurquoise = mix(vec3(0.075, 0.33, 0.44), vec3(0.09, 0.20, 0.27), stormMix);
        vec3 sunCrest = mix(vec3(0.18, 0.49, 0.57), vec3(0.24, 0.35, 0.42), stormMix);
        vec3 waterCol = mix(deepWater, midTurquoise, crestFactor);
        waterCol = mix(waterCol, sunCrest, smoothstep(0.62, 1.0, crestFactor * 0.75 + ripple * 0.35));

        // Coastal breaking surf foam along Marine Drive/Worli/Juhu seawall (x ~ -67), Gateway wall (z ~ -109), and Elephanta shore
        float distWestCoast = abs(vWorldPos.x - (-67.2));
        float nearWestShore = smoothstep(14.0, 0.5, distWestCoast) * step(-114.0, vWorldPos.z) * step(vWorldPos.z, 390.0);
        float distNorthCoast = abs(vWorldPos.z - (-109.5));
        float nearNorthShore = smoothstep(14.0, 0.5, distNorthCoast) * step(-70.0, vWorldPos.x) * step(vWorldPos.x, 395.0);
        float distIsland = length(vWorldPos.xz - uIslandPos) - 24.5;
        float nearIsland = smoothstep(11.0, 0.0, abs(distIsland));

        float shoreBand = max(max(nearWestShore, nearNorthShore), nearIsland);
        float surfPulse = sin(shoreBand * 12.0 - uTime * (3.1 + stormMix * 1.1) + ripple * 4.0) * 0.5 + 0.5;
        float shoreFoam = shoreBand * smoothstep(0.32, 0.85, surfPulse) * (0.72 + stormMix * 0.16);

        // Open-ocean whitecap foam intensifies during monsoon swells
        float whitecap = smoothstep(0.54 - stormMix * 0.14, 0.82, vWaveH + ripple * 0.22) * (0.42 + stormMix * 0.25);
        float totalFoam = clamp(shoreFoam + whitecap, 0.0, 0.90);

        // Warm golden sunset horizon specular shimmer (dims under storm clouds)
        float sunSparkle = pow(clamp(ripple * crestFactor, 0.0, 1.0), 4.0) * 0.28 * (1.0 - stormMix * 0.75);
        vec3 finalWater = mix(waterCol * 0.65 + diffuseColor.rgb * 0.45, vec3(0.92, 0.96, 0.98), totalFoam);
        finalWater += vec3(1.0, 0.72, 0.36) * sunSparkle;
        diffuseColor.rgb = finalWater;`,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(-200, -1.04, 0);
  mesh.receiveShadow = true;

  const update = (simTime: number, waveScale = 1.0) => {
    uniforms.uTime.value = simTime;
    uniforms.uWaveScale.value = waveScale;
    const speedMult = 1 + (waveScale - 1) * 0.6;
    colorTex.offset.set(simTime * 0.012 * speedMult, simTime * 0.008 * speedMult);
    bumpTex.offset.set(-simTime * 0.018 * speedMult, simTime * 0.014 * speedMult);
  };

  return { mesh, update };
}

/**
 * Builds an authentic Indian green reflective overhead highway directional gantry bridge
 * spanning a 14m Mumbai avenue with crisp white lettering and arrows on both faces.
 */
export function createOverheadGantrySign(def: StreetGantryDef, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.axis === 'ns' ? 0 : Math.PI * 0.5;

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.42, metalness: 0.78 });
  const span = 16.4;
  const clearanceY = 7.2;

  for (const sx of [-span * 0.5, span * 0.5]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, clearanceY + 1.4, 8), steelMat);
    leg.position.set(sx, (clearanceY + 1.4) * 0.5, 0);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.95), steelMat);
    foot.position.set(sx, 0.275, 0);
    g.add(foot);
  }

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.26, 0.32), steelMat);
  topBeam.position.set(0, clearanceY + 1.2, 0);
  g.add(topBeam);
  const botBeam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.26, 0.32), steelMat);
  botBeam.position.set(0, clearanceY - 0.8, 0);
  g.add(botBeam);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c5c36';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 1000, 232);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(24, 24, 976, 44);
  ctx.fillStyle = '#140f0b';
  ctx.font = '700 26px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`NEW YORK CITY DOT · ROUTE ${def.routeBadge}`, 512, 47);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px "Chakra Petch", sans-serif';
  ctx.fillText(def.centerDest, 512, 122);

  ctx.fillStyle = '#e2f7ea';
  ctx.font = '700 30px "Chakra Petch", sans-serif';
  ctx.fillText(`${def.leftArrow}    |    ${def.rightArrow}`, 512, 192);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;

  const boardMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.14,
    roughness: 0.88,
    metalness: 0.0,
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(11.8, 2.55, 0.28), steelMat);
  frame.position.set(0, clearanceY + 0.2, 0);
  g.add(frame);

  // Front & back readable faces
  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 2.4), boardMat);
  frontFace.position.set(0, clearanceY + 0.2, 0.16);
  g.add(frontFace);

  const backFace = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 2.4), boardMat);
  backFace.position.set(0, clearanceY + 0.2, -0.16);
  backFace.rotation.y = Math.PI;
  g.add(backFace);

  return g;
}

/**
 * Builds a Mumbai roadside area welcome hoarding & street direction signboard on sidewalks.
 */
export function createAreaHoardingSign(def: AreaHoardingDef, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.rotationY;

  const postMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.45, metalness: 0.72 });
  for (const sx of [-1.45, 1.45]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 8), postMat);
    pole.position.set(sx, 1.8, 0);
    g.add(pole);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const bg = def.bgHex;
  const accent = def.accentHex;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 240);

  ctx.fillStyle = accent;
  ctx.fillRect(18, 18, 476, 40);
  ctx.fillStyle = '#120d0a';
  ctx.font = '700 20px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW YORK CITY · FIVE BOROUGHS', 256, 39);

  ctx.fillStyle = '#fff9ee';
  ctx.font = '700 38px "Chakra Petch", sans-serif';
  ctx.fillText(def.title, 256, 108);

  ctx.fillStyle = '#e5d5bc';
  ctx.font = '600 21px "Inter", sans-serif';
  ctx.fillText(def.subtitle, 256, 154);

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(18, 184, 476, 52);
  ctx.fillStyle = accent;
  ctx.font = '700 20px "Chakra Petch", sans-serif';
  ctx.fillText('NEW YORK VICE · OPEN WORLD', 256, 211);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;

  const faceMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xfff5dc,
    emissiveIntensity: 0.14,
    roughness: 0.88,
    metalness: 0.0,
  });

  const panel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.95, 0.18), postMat);
  panel.position.set(0, 3.25, 0);
  g.add(panel);

  const front = new THREE.Mesh(new THREE.PlaneGeometry(3.68, 1.84), faceMat);
  front.position.set(0, 3.25, 0.1);
  g.add(front);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.68, 1.84), faceMat);
  back.position.set(0, 3.25, -0.1);
  back.rotation.y = Math.PI;
  g.add(back);

  // Twin small golden hood lamps lighting the hoarding
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe49e });
  for (const lx of [-1.1, 1.1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), lampMat);
    lamp.position.set(lx, 4.3, 0.25);
    g.add(lamp);
  }

  return g;
}

/**
 * Ground-floor named Mumbai building storefront with illuminated display window,
 * striped monsoon awning, overhead named shop signboard, outdoor display counter,
 * and category-specific merchandise props (chai/bakery, jewellery, silk, spices, auto, books).
 */
export function createBuildingShopfront(shop: BuildingShopDef, maxAniso: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(shop.x, 0, shop.z);
  g.rotation.y = shop.facing;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x261d17, roughness: 0.72, metalness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({ color: shop.awningHex, roughness: 0.58, metalness: 0.08 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf7ebd9, roughness: 0.76 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffefd0,
    emissive: 0xffc66e,
    emissiveIntensity: 0.52,
    roughness: 0.14,
    metalness: 0.35,
  });

  const backFrame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.4, 0.28), frameMat);
  backFrame.position.set(0, 2.2, 0.05);
  g.add(backFrame);

  const windowPane = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.14), glassMat);
  windowPane.position.set(-1.15, 1.85, 0.18);
  g.add(windowPane);

  const doorOpening = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 2.55, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x382515, emissive: 0x7c4a1d, emissiveIntensity: 0.28, roughness: 0.8 }),
  );
  doorOpening.position.set(1.75, 1.32, 0.16);
  g.add(doorOpening);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.16, 1.95), accentMat);
  awning.position.set(0, 3.45, 0.92);
  awning.rotation.x = 0.24;
  g.add(awning);

  for (let s = -2; s <= 2; s += 2) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 1.96), creamMat);
    stripe.position.set(s * 1.12, 3.46, 0.92);
    stripe.rotation.x = 0.24;
    g.add(stripe);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const accentCss = `#${shop.awningHex.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = shop.signBgHex;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = accentCss;
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 114, 512, 14);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 18, 496, 92);

  ctx.fillStyle = shop.signTextHex;
  ctx.font = '700 30px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shop.shopName, 256, 52);

  ctx.fillStyle = '#fef3c7';
  ctx.font = '600 16px "Inter", sans-serif';
  ctx.fillText(`${shop.subtitle}  ·  $${shop.price}`, 256, 88);

  const signTex = new THREE.CanvasTexture(canvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = maxAniso;

  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissiveMap: signTex,
    emissive: 0xffe4ad,
    emissiveIntensity: 0.26,
    roughness: 0.85,
    metalness: 0.0,
  });

  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.15, 0.18), frameMat);
  signBoard.position.set(0, 4.35, 0.26);
  g.add(signBoard);

  const signFace = new THREE.Mesh(new THREE.PlaneGeometry(6.05, 1.06), signMat);
  signFace.position.set(0, 4.35, 0.36);
  g.add(signFace);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.96, 0.72), frameMat);
  counter.position.set(-1.1, 0.48, 0.78);
  g.add(counter);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.1, 0.82), creamMat);
  counterTop.position.set(-1.1, 0.98, 0.78);
  g.add(counterTop);

  if (shop.category === 'cafe' || shop.category === 'deli' || shop.category === 'pizza' || shop.category === 'bakery') {
    const urn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.56, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.28, metalness: 0.82 }),
    );
    urn.position.set(-1.85, 1.3, 0.76);
    g.add(urn);
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.24, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 }),
    );
    tray.position.set(-0.75, 1.14, 0.78);
    g.add(tray);
  } else if (shop.category === 'watches') {
    const caseBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.38, 0.48),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.78,
      }),
    );
    caseBox.position.set(-1.1, 1.22, 0.78);
    g.add(caseBox);
  } else if (shop.category === 'garage') {
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.11, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 }),
    );
    tire.position.set(-1.85, 1.32, 0.78);
    g.add(tire);
    const nitroTank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.6 }),
    );
    nitroTank.position.set(-0.75, 1.3, 0.78);
    g.add(nitroTank);
  } else {
    const stackColors = [0x2563eb, 0x9333ea, 0x0d9488];
    stackColors.forEach((c, idx) => {
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.32 + idx * 0.08, 0.44),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }),
      );
      stack.position.set(-1.8 + idx * 0.7, 1.18 + idx * 0.04, 0.78);
      g.add(stack);
    });
  }

  // Twin warm porch bulbs under the awning
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe49e });
  for (const bx of [-2.0, 2.0]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), bulbMat);
    bulb.position.set(bx, 3.16, 1.15);
    g.add(bulb);
  }

  return g;
}

export interface RainSystemRig {
  mesh: THREE.InstancedMesh;
  update: (
    dt: number,
    anchorX: number,
    anchorY: number,
    anchorZ: number,
    intensity: number,
    fallSpeed: number,
  ) => void;
}

/**
 * Zero-GC InstancedMesh 3D monsoon rain streak volume centered continuously around the player.
 */
export function createRainSystem(count = 600): RainSystemRig {
  const geo = new THREE.BoxGeometry(0.032, 1.28, 0.032);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const spanX = 56;
  const spanZ = 56;
  const spanY = 30;
  const offsetsX = new Float32Array(count);
  const offsetsY = new Float32Array(count);
  const offsetsZ = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    offsetsX[i] = (Math.random() - 0.5) * spanX;
    offsetsY[i] = Math.random() * spanY;
    offsetsZ[i] = (Math.random() - 0.5) * spanZ;
    speeds[i] = 0.84 + Math.random() * 0.36;
  }

  const dummy = new THREE.Object3D();

  return {
    mesh,
    update: (dt, anchorX, anchorY, anchorZ, intensity, fallSpeed) => {
      if (intensity <= 0.02) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      mat.opacity = 0.22 + intensity * 0.38;
      const activeCount = Math.max(40, Math.floor(count * (0.28 + intensity * 0.72)));
      const windX = 3.2 * intensity;
      const tiltZ = -0.11 * intensity;

      for (let i = 0; i < count; i++) {
        if (i >= activeCount) {
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        offsetsY[i] -= fallSpeed * speeds[i] * dt;
        offsetsX[i] += windX * dt;
        if (offsetsY[i] < 0) {
          offsetsY[i] += spanY;
          offsetsX[i] = (Math.random() - 0.5) * spanX;
          offsetsZ[i] = (Math.random() - 0.5) * spanZ;
        } else if (offsetsX[i] > spanX * 0.5) {
          offsetsX[i] -= spanX;
        }

        dummy.position.set(anchorX + offsetsX[i], anchorY + offsetsY[i], anchorZ + offsetsZ[i]);
        dummy.rotation.set(0, 0, tiltZ);
        dummy.scale.set(1, 0.65 + intensity * 0.65, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ============== PARKS, PLAYGROUNDS, SPORTS COURTS & WANKHEDE CRICKET STADIUM ==============

function createCourtSurfaceTexture(kind: 'basketball' | 'tennis'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'basketball') {
    ctx.fillStyle = '#c25934';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(16, 16, 480, 224);
    // Keys / paint zones
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(16, 78, 92, 100);
    ctx.fillRect(404, 78, 92, 100);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, 480, 224);
    ctx.strokeRect(16, 78, 92, 100);
    ctx.strokeRect(404, 78, 92, 100);
    // Half court & 3-pt arcs
    ctx.beginPath();
    ctx.moveTo(256, 16);
    ctx.lineTo(256, 240);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 128, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(46, 128, 94, -Math.PI * 0.44, Math.PI * 0.44);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(466, 128, 94, Math.PI * 0.56, Math.PI * 1.44);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#1b5e43';
    ctx.fillRect(28, 24, 456, 208);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4.5;
    ctx.strokeRect(28, 24, 456, 208);
    ctx.strokeRect(28, 48, 456, 160);
    ctx.beginPath();
    ctx.moveTo(256, 24);
    ctx.lineTo(256, 232);
    ctx.moveTo(132, 48);
    ctx.lineTo(132, 208);
    ctx.moveTo(380, 48);
    ctx.lineTo(380, 208);
    ctx.moveTo(132, 128);
    ctx.lineTo(380, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createScoreboardTexture(title: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 176);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), 256, 62);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 46px monospace';
  ctx.fillText('NYC 248/3  OV 19.2', 256, 126);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('LIVE BRONX ARENA MATCH · FLOODLIGHTS ON', 256, 164);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addParkTree(parent: THREE.Group, x: number, z: number, scale = 1): void {
  addLayeredParkTree(parent, x, z, scale);
}

function addParkBench(parent: THREE.Group, x: number, z: number, rotY: number): void {
  const bench = new THREE.Group();
  bench.position.set(x, 0.16, z);
  bench.rotation.y = rotY;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.58), wood);
  seat.position.y = 0.5;
  bench.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.44, 0.08), wood);
  back.position.set(0, 0.78, -0.24);
  back.rotation.x = -0.18;
  bench.add(back);
  for (const sx of [-0.84, 0.84]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), iron);
    leg.position.set(sx, 0.25, 0);
    bench.add(leg);
  }
  parent.add(bench);
}

export function createRecreationZoneMesh(zone: RecreationZoneDef): THREE.Group {
  if (zone.kind === 'stadium') {
    const stadium = createDetailedBronxStadium(zone, createScoreboardTexture(zone.name));
    stadium.position.set(zone.cx, 0, zone.cz);
    return stadium;
  }

  const g = new THREE.Group();
  g.position.set(zone.cx, 0, zone.cz);

  const grassMat = new THREE.MeshStandardMaterial({
    map: getParkTurfTexture(),
    color: 0xffffff,
    roughness: 0.92,
  });
  const pathMat = new THREE.MeshStandardMaterial({
    map: getParkPathTexture(),
    color: 0xd8cbb8,
    roughness: 0.85,
  });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9c8f7d, roughness: 0.84 });
  const ironFenceMat = new THREE.MeshStandardMaterial({ color: 0x1e2923, roughness: 0.48, metalness: 0.68 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.75 });

  const baseLawn = new THREE.Mesh(new THREE.BoxGeometry(zone.width, 0.16, zone.depth), grassMat);
  baseLawn.position.y = 0.08;
  baseLawn.receiveShadow = true;
  g.add(baseLawn);

  const hw = zone.width * 0.5;
  const hd = zone.depth * 0.5;
  // Raised granite park perimeter curbs + low decorative wrought-iron railing segments (leaving wide entryways!)
  for (const sz of [-hd + 0.35, hd - 0.35]) {
    for (const sx of [-hw * 0.6, hw * 0.6]) {
      const len = zone.width * 0.34;
      const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.36, 0.48), curbMat);
      curb.position.set(sx, 0.22, sz);
      g.add(curb);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len - 0.2, 0.08, 0.08), ironFenceMat);
      rail.position.set(sx, 0.82, sz);
      g.add(rail);
      for (let p = -2; p <= 2; p++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.54, 6), ironFenceMat);
        post.position.set(sx + p * (len * 0.22), 0.58, sz);
        g.add(post);
      }
    }
  }

  if (zone.kind === 'park') {
    // Flagstone perimeter promenade paths with granite edging (keeping central cricket lawn ±12m wide open!)
    for (const edge of [-hd + 2.5, hd - 2.5]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(zone.width - 2.2, 0.18, 2.5), pathMat);
      p.position.set(0, 0.095, edge);
      p.receiveShadow = true;
      g.add(p);
    }
    for (const edge of [-hw + 2.5, hw - 2.5]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, zone.depth - 2.2), pathMat);
      p.position.set(edge, 0.095, 0);
      p.receiveShadow = true;
      g.add(p);
    }

    // Lush multi-layered perimeter shade trees (8 trees framing the Great Lawn)
    const treeCoords: Array<[number, number, number]> = [
      [-hw + 4.8, -hd + 4.8, 1.12],
      [hw - 4.8, -hd + 4.8, 1.06],
      [-hw + 4.8, hd - 4.8, 1.08],
      [hw - 4.8, hd - 4.8, 1.15],
      [-hw + 5.2, -5.8, 0.98],
      [hw - 5.2, -5.8, 1.02],
      [-hw + 5.2, 5.8, 1.04],
      [hw - 5.2, 5.8, 0.96],
    ];
    for (const [tx, tz, sc] of treeCoords) {
      addParkTree(g, tx, tz, sc);
    }

    // Ornamental stone flowerbeds with layered evergreen shrubs & blossoms at park corners
    addParkFlowerbedAndShrubs(g, -hw + 9.2, -hd + 4.4, 0);
    addParkFlowerbedAndShrubs(g, hw - 9.2, -hd + 4.4, 0);
    addParkFlowerbedAndShrubs(g, -hw + 9.2, hd - 4.4, Math.PI);
    addParkFlowerbedAndShrubs(g, hw - 9.2, hd - 4.4, Math.PI);

    // Classic Central Park cast-iron glowing globe lampposts
    for (const [lx, lz] of [
      [-hw + 3.4, -hd + 3.4],
      [hw - 3.4, -hd + 3.4],
      [-hw + 3.4, hd - 3.4],
      [hw - 3.4, hd - 3.4],
      [-hw + 3.5, 0],
      [hw - 3.5, 0],
    ]) {
      addCentralParkLamp(g, lx, lz);
    }

    addParkBench(g, -hw + 3.3, -9.8, Math.PI * 0.5);
    addParkBench(g, hw - 3.3, -9.8, -Math.PI * 0.5);
    addParkBench(g, -hw + 3.3, 9.8, Math.PI * 0.5);
    addParkBench(g, hw - 3.3, 9.8, -Math.PI * 0.5);
  } else if (zone.kind === 'playground') {
    // Colorful safety-rubber play zone turf
    const rubberPad = new THREE.Mesh(
      new THREE.BoxGeometry(zone.width - 7, 0.2, zone.depth - 7),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.88 }),
    );
    rubberPad.position.y = 0.11;
    g.add(rubberPad);

    // 1. Bright Red & Yellow Children's Slide Tower
    const redSlideMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 2.4), blueMat);
    deck.position.set(-7.5, 2.5, -5.5);
    g.add(deck);
    for (const [px, pz] of [
      [-8.5, -6.5],
      [-6.5, -6.5],
      [-8.5, -4.5],
      [-6.5, -4.5],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6), metalMat);
      post.position.set(px, 2.1, pz);
      g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.35, 4), yellowMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-7.5, 4.8, -5.5);
    g.add(roof);
    const chute = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 4.4), redSlideMat);
    chute.position.set(-7.5, 1.45, -2.5);
    chute.rotation.x = 0.56;
    g.add(chute);

    // 2. Dual A-Frame Swing Set
    const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6.2, 8), blueMat);
    crossBar.rotation.z = Math.PI / 2;
    crossBar.position.set(6.5, 3.6, -5.0);
    g.add(crossBar);
    for (const sx of [3.5, 9.5]) {
      for (const rz of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.9, 6), metalMat);
        leg.position.set(sx, 1.85, -5.0 + rz * 2.5);
        leg.rotation.x = rz;
        g.add(leg);
      }
    }
    for (const seatX of [5.2, 7.8]) {
      for (const chainOff of [-0.35, 0.35]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 4), metalMat);
        chain.position.set(seatX + chainOff, 2.25, -5.0);
        g.add(chain);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.36), yellowMat);
      seat.position.set(seatX, 0.95, -5.0);
      g.add(seat);
    }

    // 3. Colorful Geodesic Climbing Dome & Seesaw
    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.4, 1),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, wireframe: true }),
    );
    dome.position.set(0, 1.2, 4.5);
    g.add(dome);

    const seesawFulcrum = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.85, 4), metalMat);
    seesawFulcrum.position.set(7.5, 0.5, 5.2);
    g.add(seesawFulcrum);
    const seesawPlank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.45), redSlideMat);
    seesawPlank.position.set(7.5, 0.96, 5.2);
    seesawPlank.rotation.z = 0.14;
    g.add(seesawPlank);

    addParkTree(g, -hw + 3.2, hd - 3.2, 0.9);
    addParkTree(g, hw - 3.2, hd - 3.2, 0.9);
    addParkBench(g, -9.5, 8.2, 0);
    addParkBench(g, 9.5, 8.2, 0);
  } else if (zone.kind === 'courts') {
    // Side-by-side Basketball Court & Tennis Court + Spectator Bleachers
    const bballTex = createCourtSurfaceTexture('basketball');
    const bballCourt = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 13.5),
      new THREE.MeshStandardMaterial({ map: bballTex, roughness: 0.72 }),
    );
    bballCourt.rotation.x = -Math.PI / 2;
    bballCourt.position.set(0, 0.2, -8.5);
    g.add(bballCourt);

    // Basketball hoops at both ends
    const backboardMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.65 });
    for (const sx of [-11.5, 11.5]) {
      const sign = sx < 0 ? 1 : -1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 8), metalMat);
      pole.position.set(sx, 1.85, -8.5);
      g.add(pole);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 1.9), backboardMat);
      board.position.set(sx + sign * 0.55, 3.45, -8.5);
      g.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 12), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(sx + sign * 0.9, 3.12, -8.5);
      g.add(rim);
    }

    // Tennis Court + white net
    const tennisTex = createCourtSurfaceTexture('tennis');
    const tennisCourt = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 13.5),
      new THREE.MeshStandardMaterial({ map: tennisTex, roughness: 0.78 }),
    );
    tennisCourt.rotation.x = -Math.PI / 2;
    tennisCourt.position.set(0, 0.2, 8.5);
    g.add(tennisCourt);

    const netMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.05, 12.2),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.75 }),
    );
    netMesh.position.set(0, 0.72, 8.5);
    g.add(netMesh);
    for (const nz of [2.4, 14.6]) {
      const np = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), metalMat);
      np.position.set(0, 0.72, nz);
      g.add(np);
    }

    // Court floodlight poles & bleachers
    for (const [lx, lz] of [
      [-14.5, -14.5],
      [14.5, -14.5],
      [-14.5, 14.5],
      [14.5, 14.5],
    ]) {
      const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8.2, 8), metalMat);
      lp.position.set(lx, 4.1, lz);
      g.add(lp);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.42, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xffe4a0, emissiveIntensity: 1.5 }),
      );
      lamp.position.set(lx, 8.2, lz);
      g.add(lamp);
    }
    // Tiered spectator bleachers along east sideline
    for (let step = 0; step < 3; step++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 16), curbMat);
      row.position.set(15.6 + step * 0.72, 0.36 + step * 0.42, 0);
      g.add(row);
    }
    addParkFlowerbedAndShrubs(g, -hw + 3.4, hd - 2.4, 0);
    addParkFlowerbedAndShrubs(g, hw - 3.4, hd - 2.4, 0);
  }

  return g;
}





