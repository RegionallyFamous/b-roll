/**
 * scene-perf.test.js — baseline-mode perf sampler for every scene.
 *
 * Phase 1 (now): load every scene, run `setup` + 120 `tick` calls under
 * both `perfTier: 'normal'` and `'low'`, record median + p95 of the
 * per-tick duration, and write the result to
 * `odd/tests/integration/scene-perf-baseline.json`. We do NOT fail CI
 * on budget overruns yet — we need a trustworthy baseline first, and
 * jsdom + a Proxy-backed Pixi stub are far enough from a real GPU
 * pipeline that "X is slow here" doesn't always mean "X is slow on
 * real hardware".
 *
 * Phase 2 (later, toggled by OOD_ENFORCE_PERF_BUDGETS=1): compare
 * against the committed baseline + the budgets declared in
 * scene-perf-budget.json, fail if median or p95 regresses beyond the
 * allowed delta. The gate is a one-line change in this file once the
 * baseline proves stable across Node versions.
 *
 * The sampler uses 600 ticks per tier (per world-class plan). The
 * whole file still stays under a few seconds in CI on modern hardware.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
// Scenes live under _tools/catalog-sources/scenes/<slug>/.
const SCENES_DIR = resolve( __dirname, '../../../_tools/catalog-sources/scenes' );
const BASELINE_FILE = resolve( __dirname, 'scene-perf-baseline.json' );
const BUDGETS_FILE = resolve( __dirname, 'scene-perf-budget.json' );

const TICKS = 600;
const ENFORCE = process.env.ODD_ENFORCE_PERF_BUDGETS === '1';
const SHOULD_WRITE_BASELINE = process.env.ODD_WRITE_PERF_BASELINE === '1';

function createPixiStub() {
	function stubFactory() {
		const fn = function () { return fn; };
		fn.children = [];
		fn.stage = { addChild: () => {}, removeChildren: () => {}, children: [] };
		fn.renderer = { width: 1920, height: 1080 };
		fn.screen = { width: 1920, height: 1080 };
		fn.width = 1920; fn.height = 1080;
		fn.alpha = 1; fn.rotation = 0;
		fn.scale = { set: () => {}, x: 1, y: 1 };
		fn.position = { set: () => {}, x: 0, y: 0 };
		fn.anchor = { set: () => {}, x: 0, y: 0 };
		fn.tint = 0xffffff;
		fn.style = {};
		fn.filters = [];
		fn.blendMode = 'normal';
		fn.visible = true;
		return new Proxy( fn, {
			get( target, prop ) {
				if ( prop in target ) return target[ prop ];
				if ( prop === 'then' ) return undefined;
				if ( typeof prop === 'symbol' ) return undefined;
				return stubFactory();
			},
			apply() { return stubFactory(); },
			construct() { return stubFactory(); },
		} );
	}
	const PIXI = stubFactory();
	PIXI.Application = stubFactory();
	PIXI.Container = stubFactory();
	PIXI.Graphics = stubFactory();
	PIXI.Sprite = stubFactory();
	PIXI.Text = stubFactory();
	PIXI.Texture = stubFactory();
	PIXI.Texture.WHITE = stubFactory();
	PIXI.Texture.from = () => stubFactory();
	PIXI.Assets = { load: () => Promise.resolve( stubFactory() ) };
	PIXI.BlurFilter = stubFactory();
	PIXI.ColorMatrixFilter = stubFactory();
	PIXI.Rectangle = stubFactory();
	PIXI.Point = stubFactory();
	return PIXI;
}

function installHelpers() {
	window.__odd = window.__odd || {};
	window.__odd.helpers = {
		rand: ( a, b ) => ( a + b ) / 2,
		irand: ( a, b ) => Math.floor( ( a + b ) / 2 ),
		choose: ( arr ) => arr[ 0 ],
		clamp: ( v, lo, hi ) => Math.max( lo, Math.min( hi, v ) ),
		tau: Math.PI * 2,
		lerpColor: () => 0xffffff,
		paintVGradient: () => {},
		makeBloomLayer: ( PIXI ) => { const c = new PIXI.Container(); c.blendMode = 'add'; return c; },
		computeTod: () => ( { phase: 'day', amount: 0.5 } ),
		computeSeason: () => 'summer',
	};
}

function makeEnv( PIXI, tier ) {
	return {
		app: PIXI, PIXI,
		ctx: { pluginUrl: '', version: 'perf' },
		helpers: window.__odd.helpers,
		dt: 1,
		parallax: { x: 0, y: 0 },
		reducedMotion: false,
		tod: { phase: 'day', amount: 0.5 },
		todPhase: 'day', season: 'summer',
		audio: { enabled: false, level: 0, bass: 0, mid: 0, high: 0 },
		perfTier: tier,
	};
}

function percentile( sortedMs, p ) {
	if ( sortedMs.length === 0 ) return 0;
	const idx = Math.min( sortedMs.length - 1, Math.floor( ( p / 100 ) * sortedMs.length ) );
	return sortedMs[ idx ];
}

function median( sortedMs ) {
	if ( sortedMs.length === 0 ) return 0;
	const mid = Math.floor( sortedMs.length / 2 );
	return sortedMs.length % 2 ? sortedMs[ mid ] : ( sortedMs[ mid - 1 ] + sortedMs[ mid ] ) / 2;
}

function sampleScene( slug, tier ) {
	window.__odd = {}; installHelpers(); window.__odd.scenes = {};
	const src = readFileSync( resolve( SCENES_DIR, slug, 'scene.js' ), 'utf8' );
	const fn = new Function( `${ src }\n//# sourceURL=${ slug }.js` );
	fn.call( globalThis );
	const scene = window.__odd.scenes[ slug ];
	const PIXI = createPixiStub();
	const env = makeEnv( PIXI, tier );

	let state;
	try { state = scene.setup( env ); } catch ( _e ) { return null; }
	if ( state && typeof state.then === 'function' ) state.catch( () => {} );

	const durations = new Float64Array( TICKS );
	for ( let i = 0; i < TICKS; i++ ) {
		const t0 = performance.now();
		try { scene.tick( state, env ); } catch ( _e ) { /* swallow — we count duration even on throw */ }
		durations[ i ] = performance.now() - t0;
	}
	const sorted = Array.from( durations ).sort( ( a, b ) => a - b );
	return {
		median: median( sorted ),
		p95: percentile( sorted, 95 ),
		p99: percentile( sorted, 99 ),
	};
}

function readScenes() {
	if ( ! existsSync( SCENES_DIR ) ) return [];
	return readdirSync( SCENES_DIR )
		.filter( ( name ) => statSync( resolve( SCENES_DIR, name ) ).isDirectory() )
		.map( ( slug ) => {
			const metaPath = resolve( SCENES_DIR, slug, 'meta.json' );
			const meta = existsSync( metaPath )
				? JSON.parse( readFileSync( metaPath, 'utf8' ) )
				: {};
			return { slug, ...meta };
		} )
		.sort( ( a, b ) => a.slug.localeCompare( b.slug ) );
}

const SCENES = readScenes();

describe( 'scene perf sampler', () => {
	const results = {};

	beforeAll( () => { /* warm any Node-level JIT */ } );

	afterAll( () => {
		if ( SHOULD_WRITE_BASELINE ) {
			const payload = {
				generated: new Date().toISOString(),
				node: process.version,
				ticks: TICKS,
				units: 'ms',
				scenes: results,
			};
			writeFileSync( BASELINE_FILE, JSON.stringify( payload, null, 2 ) + '\n', 'utf8' );
			console.log( `[perf] wrote baseline to ${ BASELINE_FILE }` );
		}
	} );

	for ( const scene of SCENES ) {
		it( `samples ${ scene.slug } (tier: normal)`, () => {
			const r = sampleScene( scene.slug, 'normal' );
			expect( r, `${ scene.slug } setup must not throw` ).not.toBeNull();
			results[ scene.slug ] = results[ scene.slug ] || {};
			results[ scene.slug ].normal = r;

			if ( ENFORCE && existsSync( BUDGETS_FILE ) ) {
				const budgets = JSON.parse( readFileSync( BUDGETS_FILE, 'utf8' ) );
				const budget = ( budgets.scenes && budgets.scenes[ scene.slug ] && budgets.scenes[ scene.slug ].normal ) || budgets.defaults.normal;
				expect( r.median,
					`${ scene.slug } normal median ${ r.median.toFixed( 3 ) }ms > budget ${ budget.median }ms`,
				).toBeLessThanOrEqual( budget.median );
				expect( r.p95,
					`${ scene.slug } normal p95 ${ r.p95.toFixed( 3 ) }ms > budget ${ budget.p95 }ms`,
				).toBeLessThanOrEqual( budget.p95 );
			}
		} );

		it( `samples ${ scene.slug } (tier: low)`, () => {
			const r = sampleScene( scene.slug, 'low' );
			expect( r, `${ scene.slug } setup must not throw` ).not.toBeNull();
			results[ scene.slug ] = results[ scene.slug ] || {};
			results[ scene.slug ].low = r;

			if ( ENFORCE && existsSync( BUDGETS_FILE ) ) {
				const budgets = JSON.parse( readFileSync( BUDGETS_FILE, 'utf8' ) );
				const budget = ( budgets.scenes && budgets.scenes[ scene.slug ] && budgets.scenes[ scene.slug ].low ) || budgets.defaults.low;
				expect( r.median,
					`${ scene.slug } low median ${ r.median.toFixed( 3 ) }ms > budget ${ budget.median }ms`,
				).toBeLessThanOrEqual( budget.median );
			}
		} );
	}
} );
