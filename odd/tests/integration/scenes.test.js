/**
 * scenes.test.js — smoke-test every scene in scenes.json.
 *
 * For each slug:
 *   - The scene JS file exists at odd/src/wallpaper/scenes/<slug>.js.
 *   - Evaluating the file (which is an IIFE) registers the scene onto
 *     `window.__odd.scenes[slug]`.
 *   - The registered object exposes `setup` + `tick` as functions.
 *   - A safe sync call to setup() with a Proxy-backed PIXI stub
 *     doesn't throw synchronously (the scene may still do async work
 *     via Promises; we ignore rejected promises but catch sync throws).
 *
 * A naive "just assert the file exists" check would not catch a scene
 * that ships with a stray `\x14` byte in a comment or a typo in the
 * `window.__odd.scenes[slug]` assignment — both classes of bug we've
 * actually hit in the past.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const SCENES_DIR = resolve( __dirname, '../../src/wallpaper/scenes' );
const SCENES_JSON = resolve( __dirname, '../../src/wallpaper/scenes.json' );

const manifest = JSON.parse( readFileSync( SCENES_JSON, 'utf8' ) );
const SCENES = Array.isArray( manifest )
	? manifest
	: ( manifest && Array.isArray( manifest.scenes ) ? manifest.scenes : [] );

function createPixiStub() {
	function stubFactory() {
		const fn = function () { return fn; };
		fn.children = [];
		fn.stage = { addChild: () => {}, removeChildren: () => {}, children: [] };
		fn.renderer = { width: 1920, height: 1080 };
		fn.screen = { width: 1920, height: 1080 };
		fn.width = 1920;
		fn.height = 1080;
		fn.alpha = 1;
		fn.rotation = 0;
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
		makeBloomLayer: ( PIXI ) => {
			const c = new PIXI.Container();
			c.blendMode = 'add';
			return c;
		},
		computeTod: () => ( { phase: 'day', amount: 0.5 } ),
		computeSeason: () => 'summer',
	};
}

function makeEnv( PIXI ) {
	return {
		app: PIXI,
		PIXI,
		ctx: { pluginUrl: '', version: 'test' },
		helpers: window.__odd.helpers,
		dt: 1,
		parallax: { x: 0, y: 0 },
		reducedMotion: false,
		tod: { phase: 'day', amount: 0.5 },
		todPhase: 'day',
		season: 'summer',
		audio: { enabled: false, level: 0, bass: 0, mid: 0, high: 0 },
		perfTier: 'normal',
	};
}

describe( 'scenes manifest', () => {
	it( 'scenes.json contains at least one scene', () => {
		expect( SCENES.length ).toBeGreaterThan( 0 );
	} );

	it.each( SCENES.map( ( s ) => [ s.slug, s ] ) )(
		'scene %s has JS + preview + wallpaper on disk',
		( slug ) => {
			expect( existsSync( resolve( SCENES_DIR, `${ slug }.js` ) ) ).toBe( true );
			expect( existsSync( resolve( __dirname, `../../assets/previews/${ slug }.webp` ) ) ).toBe( true );
			expect( existsSync( resolve( __dirname, `../../assets/wallpapers/${ slug }.webp` ) ) ).toBe( true );
		}
	);
} );

describe( 'scene registration + surface contract', () => {
	beforeEach( () => {
		window.__odd = {};
		installHelpers();
		window.__odd.scenes = {};
	} );

	it.each( SCENES.map( ( s ) => [ s.slug ] ) )(
		'scene %s loads, registers, exposes setup + tick',
		( slug ) => {
			const src = readFileSync( resolve( SCENES_DIR, `${ slug }.js` ), 'utf8' );
			const fn = new Function( `${ src }\n//# sourceURL=${ slug }.js` );
			expect( () => fn.call( globalThis ) ).not.toThrow();

			const scene = window.__odd.scenes[ slug ];
			expect( scene, `scene ${ slug } did not register` ).toBeDefined();
			expect( typeof scene.setup, `scene ${ slug }.setup` ).toBe( 'function' );
			expect( typeof scene.tick,  `scene ${ slug }.tick` ).toBe( 'function' );
		}
	);

	it.each( SCENES.map( ( s ) => [ s.slug ] ) )(
		'scene %s setup() does not throw synchronously',
		( slug ) => {
			const src = readFileSync( resolve( SCENES_DIR, `${ slug }.js` ), 'utf8' );
			const fn = new Function( `${ src }\n//# sourceURL=${ slug }.js` );
			fn.call( globalThis );

			const PIXI = createPixiStub();
			const env  = makeEnv( PIXI );
			const scene = window.__odd.scenes[ slug ];

			// setup may be async — we accept either a state object or a
			// Promise. A synchronous throw is the failure we care about.
			let state;
			expect( () => { state = scene.setup( env ); } ).not.toThrow();
			if ( state && typeof state.then === 'function' ) {
				// Ignore rejections — the stub is intentionally shallow.
				state.catch( () => {} );
			}
		}
	);
} );
