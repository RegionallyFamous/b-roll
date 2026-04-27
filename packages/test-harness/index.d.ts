/**
 * Type definitions for @odd/test-harness.
 */

export type PerfTier = 'high' | 'normal' | 'low';

export interface Tod {
	phase: 'dawn' | 'day' | 'dusk' | 'night';
	amount: number;
}

export interface Audio {
	enabled: boolean;
	level: number;
	bass: number;
	mid: number;
	high: number;
}

export interface SceneEnv {
	app: any;
	PIXI: any;
	ctx: { pluginUrl: string; version: string };
	helpers: Record<string, unknown>;
	dt: number;
	parallax: { x: number; y: number };
	reducedMotion: boolean;
	tod: Tod;
	todPhase: Tod['phase'];
	season: string;
	audio: Audio;
	perfTier: PerfTier;
}

export interface SceneModule {
	setup( env: SceneEnv ): unknown;
	tick( state: unknown, env: SceneEnv ): void;
	onResize?( state: unknown, env: SceneEnv ): void;
	cleanup?( state: unknown, env: SceneEnv ): void;
}

export interface WidgetModule {
	id: string;
	label?: string;
	mount( root: HTMLElement ): ( () => void ) | void;
}

export function createPixiStub(): any;
export function makeEnv( opts?: { tier?: PerfTier; width?: number; height?: number } ): SceneEnv;
export function mountScene( opts: { slug: string; source: string; filename?: string } ): Promise<SceneModule>;
export function mountWidget( opts: { id: string; source: string; filename?: string } ): Promise<WidgetModule>;
export function reset(): void;
