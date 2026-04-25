/**
 * Iris — first-run onboarding.
 * ---------------------------------------------------------------
 * Wraps the panel's render callback so the very first time a user
 * opens the ODD Control Panel they see a three-beat greeting card
 * instead of the Wallpaper grid:
 *
 *   1. Curtain — body solid, eye fading in.
 *   2. Greeting — Iris's onboarding line crossfades in.
 *   3. Choice — three scene tiles fan out; click one to save the
 *      wallpaper + the `odd_initiated` flag atomically.
 *
 * A "Look around first" link lets the user skip straight to the
 * panel; it still writes `odd_initiated` so the card doesn't come
 * back on the next open. The card is gated on
 * `store.user.initiated`; once that flag is true this module is a
 * no-op and delegates to the stock panel renderer.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	window.__odd.iris = window.__odd.iris || {};
	if ( window.__odd.iris.onboarding ) return;

	function isInitiated() {
		var store = window.__odd.store;
		return !! ( store && store.get( 'user.initiated' ) );
	}

	function markInitiated() {
		var store = window.__odd.store;
		if ( store && typeof store.set === 'function' ) {
			store.set( 'user.initiated', true );
		}
		var api = window.__odd.api;
		if ( api && typeof api.savePrefs === 'function' ) {
			api.savePrefs( { initiated: true } );
		}
	}

	function pickScenes() {
		var store = window.__odd.store;
		var all   = ( store && store.get( 'registries.scenes' ) ) || [];
		if ( ! all.length ) return [];
		if ( all.length <= 3 ) return all.slice();
		var picks = [];
		var pool  = all.slice();
		while ( picks.length < 3 && pool.length ) {
			var i = Math.floor( Math.random() * pool.length );
			picks.push( pool.splice( i, 1 )[ 0 ] );
		}
		return picks;
	}

	function line() {
		var iris = window.__odd.iris;
		if ( iris && typeof iris.say === 'function' ) {
			var got = iris.say( 'onboarding', { silent: true, force: true } );
			if ( got ) return got;
		}
		return 'Hello. I decorate. Pick one of three.';
	}

	function renderOnboarding( body ) {
		while ( body.firstChild ) body.removeChild( body.firstChild );

		var wrap = document.createElement( 'div' );
		wrap.setAttribute( 'data-odd-onboard', '' );
		wrap.style.cssText = [
			'position:relative',
			'width:100%',
			'height:100%',
			'min-height:440px',
			'display:flex',
			'flex-direction:column',
			'align-items:center',
			'justify-content:center',
			'gap:24px',
			'background:radial-gradient(circle at 30% 20%, #2a0b52 0%, #0a0416 80%)',
			'color:#fdfaf2',
			'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif',
			'padding:32px',
			'box-sizing:border-box',
			'overflow:hidden',
			'opacity:0',
			'transition:opacity 600ms ease',
		].join( ';' );

		var eye = document.createElement( 'div' );
		eye.style.cssText = 'font-size:96px; line-height:1; transform:scale(0.6); transition:transform 800ms cubic-bezier(.2,.9,.3,1.3);';
		eye.setAttribute( 'aria-hidden', 'true' );
		eye.innerHTML = '\uD83D\uDC41';

		var greeting = document.createElement( 'p' );
		greeting.textContent = line();
		greeting.style.cssText = 'margin:0; font-size:18px; letter-spacing:0.2px; opacity:0; transition:opacity 600ms ease;';

		var row = document.createElement( 'div' );
		row.style.cssText = 'display:flex; gap:16px; flex-wrap:wrap; justify-content:center; opacity:0; transform:translateY(16px); transition:all 600ms ease; margin-top:8px;';

		var scenes = pickScenes();
		if ( ! scenes.length ) {
			scenes = [
				{ slug: 'aurora',  label: 'Aurora'  },
				{ slug: 'flux',    label: 'Flux'    },
				{ slug: 'origami', label: 'Origami' },
			];
		}
		scenes.forEach( function ( sc ) {
			var tile = document.createElement( 'button' );
			tile.type = 'button';
			tile.textContent = sc.label || sc.slug;
			tile.style.cssText = [
				'background:rgba(253,250,242,0.1)',
				'color:#fdfaf2',
				'border:1.5px solid rgba(253,250,242,0.3)',
				'border-radius:10px',
				'padding:14px 20px',
				'font-size:15px',
				'font-weight:500',
				'cursor:pointer',
				'min-width:120px',
				'transition:all 180ms ease',
			].join( ';' );
			tile.addEventListener( 'mouseenter', function () {
				tile.style.background = 'rgba(253,250,242,0.2)';
				tile.style.borderColor = 'rgba(253,250,242,0.6)';
			} );
			tile.addEventListener( 'mouseleave', function () {
				tile.style.background = 'rgba(253,250,242,0.1)';
				tile.style.borderColor = 'rgba(253,250,242,0.3)';
			} );
			tile.addEventListener( 'click', function () {
				var api = window.__odd.api;
				if ( api && typeof api.savePrefs === 'function' ) {
					api.savePrefs( { wallpaper: sc.slug, initiated: true } );
				}
				var store = window.__odd.store;
				if ( store ) {
					store.set( 'user.wallpaper', sc.slug );
					store.set( 'user.initiated', true );
				}
				var hooks = window.wp && window.wp.hooks;
				if ( hooks && typeof hooks.doAction === 'function' ) {
					try { hooks.doAction( 'odd.pickScene', sc.slug ); } catch ( e ) {}
				}
				var iris = window.__odd.iris;
				if ( iris && typeof iris.say === 'function' ) iris.say( 'kept' );
				if ( typeof window.wpDesktopNativeWindows === 'object'
					&& window.wpDesktopNativeWindows
					&& window.wpDesktopNativeWindows.odd
					&& window.__odd.iris.onboarding.__stockPanel ) {
					window.__odd.iris.onboarding.__stockPanel( body );
				}
			} );
			row.appendChild( tile );
		} );

		var skip = document.createElement( 'button' );
		skip.type = 'button';
		skip.textContent = 'Look around first';
		skip.style.cssText = 'background:none; border:none; color:#cdbfa6; font-size:13px; text-decoration:underline; cursor:pointer; opacity:0; transition:opacity 800ms ease; margin-top:16px;';
		skip.addEventListener( 'click', function () {
			markInitiated();
			if ( window.__odd.iris.onboarding.__stockPanel ) {
				window.__odd.iris.onboarding.__stockPanel( body );
			}
		} );

		wrap.appendChild( eye );
		wrap.appendChild( greeting );
		wrap.appendChild( row );
		wrap.appendChild( skip );
		body.appendChild( wrap );

		// Three-beat timing.
		requestAnimationFrame( function () {
			wrap.style.opacity   = '1';
			eye.style.transform  = 'scale(1)';
		} );
		setTimeout( function () { greeting.style.opacity = '1'; }, 600 );
		setTimeout( function () {
			row.style.opacity   = '1';
			row.style.transform = 'translateY(0)';
			skip.style.opacity  = '1';
			var first = row.querySelector( 'button' );
			if ( first && typeof first.focus === 'function' ) first.focus();
		}, 1200 );
	}

	function wrapPanel() {
		var stock = window.wpDesktopNativeWindows && window.wpDesktopNativeWindows.odd;
		if ( typeof stock !== 'function' ) {
			setTimeout( wrapPanel, 120 );
			return;
		}
		if ( stock.__oddOnboardWrapped ) return;
		var wrapped = function ( body ) {
			if ( ! body ) return stock( body );
			if ( isInitiated() ) return stock( body );
			renderOnboarding( body );
		};
		wrapped.__oddOnboardWrapped = true;
		window.__odd.iris.onboarding.__stockPanel = stock;
		window.wpDesktopNativeWindows.odd = wrapped;
	}

	window.__odd.iris.onboarding = {
		render: renderOnboarding,
		isInitiated: isInitiated,
		markInitiated: markInitiated,
	};

	var lifecycle = window.__odd.lifecycle;
	if ( lifecycle && typeof lifecycle.whenPhase === 'function' ) {
		lifecycle.whenPhase( 'ready' ).then( wrapPanel, wrapPanel );
	} else {
		setTimeout( wrapPanel, 300 );
	}
} )();
