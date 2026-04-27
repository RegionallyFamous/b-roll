/**
 * Pixi v8 stub for ODD scene tests.
 *
 * Scenes built for ODD assume a full Pixi v8 surface at env.PIXI, at
 * env.app, and at env.app.stage. Real Pixi needs a GPU and a live DOM,
 * both of which vitest+jsdom don't provide. This stub returns
 * a chainable Proxy for every unknown property so calls like
 * `g.rect(...).fill({ color: 0xff0000 }).stroke({ width: 2 })` don't
 * throw — they just return more stubs.
 *
 * The stub tracks children counts on containers + call counts on
 * `stage.addChild` so your tests can assert "scene added N things" or
 * "scene added children during swap" without caring what they were.
 */

export function createPixiStub() {
	const counters = { stageAddChild: 0, tickerAdd: 0 };

	function stubFactory() {
		const fn = function () { return fn; };
		fn.children = [];
		fn.stage = {
			addChild( child ) { counters.stageAddChild++; fn.stage.children.push( child ); return child; },
			addChildAt( child ) { counters.stageAddChild++; fn.stage.children.push( child ); return child; },
			removeChildren() { fn.stage.children.length = 0; },
			children: [],
		};
		fn.ticker = {
			add( cb ) { counters.tickerAdd++; return { remove() {} }; },
			remove() {},
		};
		fn.renderer = { width: 1920, height: 1080, resize() {} };
		fn.screen = { width: 1920, height: 1080 };
		fn.width = 1920; fn.height = 1080;
		fn.alpha = 1; fn.rotation = 0; fn.visible = true;
		fn.scale = { set: () => {}, x: 1, y: 1 };
		fn.position = { set: () => {}, x: 0, y: 0 };
		fn.anchor = { set: () => {}, x: 0, y: 0 };
		fn.tint = 0xffffff;
		fn.style = {};
		fn.filters = [];
		fn.blendMode = 'normal';
		fn.destroy = () => {};
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

	PIXI.__counters = counters;
	return PIXI;
}
