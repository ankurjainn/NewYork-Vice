/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { MissionPhoneModal } from './components/MissionPhoneModal';
import { StatusModal } from './components/StatusModal';
import { SubwayModal } from './components/SubwayModal';
import { TitleScreen } from './components/TitleScreen';
import { PLAYER_OUTFITS } from './game/characterModels';
import { MISSIONS } from './game/missions';
import { MumbaiWorldEngine } from './game/MumbaiWorldEngine';
import type { HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'title',
  hp: 100,
  maxHp: 100,
  hpRegenerating: false,
  damageFlash: 0,
  stamina: 100,
  boost: 100,
  cash: 1200,
  wantedStars: 0,
  wantedCooldownRatio: 0,
  district: 'Washington Square',
  inVehicle: false,
  vehicleLabel: '',
  vehicleType: null,
  vehicleHp: 0,
  vehicleMaxHp: 0,
  speedKmh: 0,
  isDrifting: false,
  isBoosting: false,
  cameraMode: 'chase',
  weatherMode: 'clear_sunset',
  weatherLabel: 'Golden Hudson Sunset',
  weatherRainIntensity: 0,
  playerOutfitId: PLAYER_OUTFITS[0].id,
  playerOutfitLabel: PLAYER_OUTFITS[0].label,
  muted: false,
  activeMission: null,
  completedMissionIds: [],
  prompt: null,
  toast: null,
  activeNpcCount: 416,
  activeParkSport: null,
  activeStreetEvent: null,
  nearbySubwayStationId: null,
  subwayRidingLabel: null,
  subwayStations: [],
  lowHpPulse: false,
  playerX: 0,
  playerZ: 0,
  endRun: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MumbaiWorldEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [subwayStationId, setSubwayStationId] = useState<string | null>(null);
  const missionsOpenRef = useRef(false);
  const subwayOpenRef = useRef(false);
  missionsOpenRef.current = missionsOpen;
  subwayOpenRef.current = subwayStationId !== null;

  // Mount Three.js engine once inside isolated sibling container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    document.body.dataset.state = 'title';
    const engine = new MumbaiWorldEngine(
      mount,
      (snap) => {
        setHud(snap);
      },
      () => missionsOpenRef.current || subwayOpenRef.current,
      (stationId) => {
        setMissionsOpen(false);
        setSubwayStationId(stationId);
      },
    );
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.start();
    }

    const onKeyM = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && engine.getSnapshot().gameState === 'playing') {
        setSubwayStationId(null);
        setMissionsOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        if (subwayOpenRef.current) {
          setSubwayStationId(null);
        } else if (missionsOpenRef.current) {
          setMissionsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyM);

    return () => {
      window.removeEventListener('keydown', onKeyM);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Wire minimap canvas ref whenever HUD mounts/unmounts
  useEffect(() => {
    engineRef.current?.setMinimapCanvas(hud.gameState === 'playing' ? minimapRef.current : null);
  }, [hud.gameState]);

  const handleStart = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.start();
  }, []);

  const handleQuickMission = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.start();
    engineRef.current?.acceptMission(MISSIONS[0].id);
  }, []);

  const handlePause = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.resume();
  }, []);

  const handleRestart = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.restart();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.returnToTitle();
  }, []);

  const handleContinueFreeRoam = useCallback(() => {
    setMissionsOpen(false);
    setSubwayStationId(null);
    engineRef.current?.continueFreeRoam();
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#16110e]">
      {/* Dedicated isolated WebGL canvas host */}
      <div
        ref={canvasMountRef}
        data-testid="nyc-canvas-mount"
        className="fixed inset-0 w-full h-full"
      />

      {hud.gameState === 'title' && (
        <TitleScreen onStart={handleStart} onQuickMission={handleQuickMission} />
      )}

      {hud.gameState === 'playing' && (
        <GameHud
          hud={hud}
          minimapRef={minimapRef}
          onOpenMissions={() => {
            setSubwayStationId(null);
            setMissionsOpen(true);
          }}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onCycleCamera={() => engineRef.current?.cycleCamera()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onCycleOutfit={() => engineRef.current?.cyclePlayerOutfit()}
          onPause={handlePause}
          onInteract={() => engineRef.current?.interact()}
          onJoinParkSport={() => engineRef.current?.joinNearbyParkSport()}
          onSpectateParkSport={() => engineRef.current?.spectateNearbyParkSport()}
          onSwingParkSport={() => engineRef.current?.triggerParkSportSwingOrShoot()}
          onLeaveParkSport={() => engineRef.current?.leaveParkSport(false)}
        />
      )}

      {hud.gameState === 'playing' && missionsOpen && (
        <MissionPhoneModal
          activeMissionId={hud.activeMission?.id ?? null}
          completedMissionIds={hud.completedMissionIds}
          onAcceptMission={(id) => engineRef.current?.acceptMission(id)}
          onAbandonMission={() => engineRef.current?.abandonMission()}
          onClose={() => setMissionsOpen(false)}
        />
      )}

      {hud.gameState === 'playing' && subwayStationId && (
        <SubwayModal
          currentStationId={subwayStationId}
          stations={hud.subwayStations}
          cash={hud.cash}
          wantedStars={hud.wantedStars}
          onSelectDestination={(destId) => {
            if (engineRef.current?.boardSubwayTo(destId)) {
              setSubwayStationId(null);
            }
          }}
          onClose={() => setSubwayStationId(null)}
        />
      )}

      <StatusModal
        gameState={hud.gameState}
        endRun={hud.endRun}
        cash={hud.cash}
        completedCount={hud.completedMissionIds.length}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
        onContinueFreeRoam={handleContinueFreeRoam}
      />
    </main>
  );
}
