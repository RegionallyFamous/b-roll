/**
 * ODD — shared client API (window.__odd.api)
 * ---------------------------------------------------------------
 * Thin reusable wrapper over the REST endpoint + the
 * @wordpress/hooks event bus the wallpaper engine subscribes to.
 * Widgets, slash commands, and any future surface all call into
 * this so scene / icon-set swaps behave identically no matter
 * where the user triggered them from.
 *
 * Exposes (all no-throw, all tolerant of a missing config):
 *
 *   api.config            — alias of window.odd
 *   api.scenes()          — live scene list
 *   api.sceneBySlug(s)    — lookup
 *   api.currentScene()    — active scene slug
 *   api.iconSets()        — live icon-set list (includes 'none' synthetic)
 *   api.currentIconSet()  — active slug or '' for default
 *   api.savePrefs(p, cb)  — POST /odd/v1/prefs, merges response back into config
 *   api.setScene(slug)    — save + broadcast 'odd/pickScene' + toast
 *   api.setIconSet(slug)  — save + soft reload so dock rebuilds
 *   api.shuffle()         — setScene() with a random non-current slug
 *   api.toast(msg, o?)    — wp.desktop.toast('odd-muse', …) if available
 *   api.onSceneChange(cb) — subscribe to scene swaps (returns unsub fn)
 *   api.onIconSetChange(cb)
 *   api.openPanel()       — wp.desktop.registerWindow({ id: 'odd' })
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	window.__odd = window.__odd || {};
	if ( window.__odd.api ) return;

	var HOOK_SCENE    = 'odd/pickScene';
	var HOOK_ICONSET  = 'odd/pickIconSet';
	var TOAST_TONE    = 'odd-muse';

	function cfg() { return window.odd || {}; }

	function scenes() {
		var s = cfg().scenes;
		return Array.isArray( s ) ? s : [];
	}
	function sceneBySlug( slug ) {
		var list = scenes();
		for ( var i = 0; i < list.length; i++ ) {
			if ( list[ i ] && list[ i ].slug === slug ) return list[ i ];
		}
		return null;
	}
	function currentScene() {
		var c = cfg();
		return c.wallpaper || c.scene || '';
	}
	function iconSets() {
		var s = cfg().iconSets;
		return Array.isArray( s ) ? s : [];
	}
	function iconSetBySlug( slug ) {
		var list = iconSets();
		for ( var i = 0; i < list.length; i++ ) {
			if ( list[ i ] && list[ i ].slug === slug ) return list[ i ];
		}
		return null;
	}
	function currentIconSet() { return cfg().iconSet || ''; }

	function doAction( hook, payload ) {
		try {
			if ( window.wp && window.wp.hooks && typeof window.wp.hooks.doAction === 'function' ) {
				window.wp.hooks.doAction( hook, payload );
			}
		} catch ( e ) { /* ignore */ }
	}

	function addAction( hook, namespace, cb ) {
		if ( ! ( window.wp && window.wp.hooks && typeof window.wp.hooks.addAction === 'function' ) ) {
			return function () {};
		}
		try { window.wp.hooks.addAction( hook, namespace, cb ); } catch ( e ) {}
		return function () {
			try { window.wp.hooks.removeAction( hook, namespace ); } catch ( e ) {}
		};
	}

	function toast( message, opts ) {
		opts = opts || {};
		if ( ! ( window.wp && window.wp.desktop && typeof window.wp.desktop.toast === 'function' ) ) return;
		try {
			window.wp.desktop.toast( opts.tone || TOAST_TONE, {
				message: String( message || '' ),
				duration: typeof opts.duration === 'number' ? opts.duration : 2400,
			} );
		} catch ( e ) { /* ignore */ }
	}

	function savePrefs( patch, cb ) {
		var c = cfg();
		if ( ! c.restUrl ) { if ( cb ) cb( null ); return; }
		try {
			fetch( c.restUrl, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': c.restNonce || '',
				},
				body: JSON.stringify( patch || {} ),
			} )
				.then( function ( r ) { return r.json(); } )
				.then( function ( data ) {
					if ( data && typeof data === 'object' ) {
						// Merge any server-confirmed keys back into window.odd so
						// subsequent widget renders see the truth.
						if ( typeof data.wallpaper === 'string' ) {
							c.wallpaper = data.wallpaper;
							c.scene     = data.wallpaper;
						}
						if ( typeof data.iconSet === 'string' ) {
							c.iconSet = data.iconSet;
						}
					}
					if ( cb ) cb( data );
				} )
				.catch( function () { if ( cb ) cb( null ); } );
		} catch ( e ) {
			if ( cb ) cb( null );
		}
	}

	function setScene( slug, opts ) {
		if ( ! slug || ! sceneBySlug( slug ) ) return false;
		if ( slug === currentScene() ) return false;

		doAction( HOOK_SCENE, slug );
		savePrefs( { wallpaper: slug } );

		var quiet = opts && opts.quiet;
		if ( ! quiet ) {
			var s = sceneBySlug( slug );
			toast( ( s && s.label ) ? s.label : slug, { duration: 1800 } );
		}
		return true;
	}

	function setIconSet( slug, opts ) {
		var valid = slug === 'none' || iconSetBySlug( slug );
		if ( ! valid ) return false;
		if ( slug === ( currentIconSet() || 'none' ) ) return false;

		savePrefs( { iconSet: slug }, function () {
			doAction( HOOK_ICONSET, slug );
			if ( ! ( opts && opts.skipReload ) ) {
				// Icons are server-canonical; refresh so the dock + desktop
				// shortcut filters re-render from the new manifest.
				try { window.location.reload(); } catch ( e ) {}
			}
		} );
		return true;
	}

	function shuffle() {
		var list = scenes();
		if ( ! list.length ) return false;
		var cur = currentScene();
		var pool = list.filter( function ( s ) { return s && s.slug && s.slug !== cur; } );
		if ( ! pool.length ) pool = list.slice();
		var pick = pool[ Math.floor( Math.random() * pool.length ) ];
		return setScene( pick.slug );
	}

	function onSceneChange( cb ) {
		return addAction( HOOK_SCENE, 'odd/api-sub-' + Math.random().toString( 36 ).slice( 2 ), cb );
	}
	function onIconSetChange( cb ) {
		return addAction( HOOK_ICONSET, 'odd/api-sub-' + Math.random().toString( 36 ).slice( 2 ), cb );
	}

	function openPanel() {
		if ( ! ( window.wp && window.wp.desktop && typeof window.wp.desktop.registerWindow === 'function' ) ) return false;
		try {
			window.wp.desktop.registerWindow( { id: 'odd' } );
			return true;
		} catch ( e ) { return false; }
	}

	window.__odd.api = {
		HOOK_SCENE:      HOOK_SCENE,
		HOOK_ICONSET:    HOOK_ICONSET,
		TOAST_TONE:      TOAST_TONE,
		get config()      { return cfg(); },
		scenes:          scenes,
		sceneBySlug:     sceneBySlug,
		currentScene:    currentScene,
		iconSets:        iconSets,
		iconSetBySlug:   iconSetBySlug,
		currentIconSet:  currentIconSet,
		savePrefs:       savePrefs,
		setScene:        setScene,
		setIconSet:      setIconSet,
		shuffle:         shuffle,
		toast:           toast,
		onSceneChange:   onSceneChange,
		onIconSetChange: onIconSetChange,
		openPanel:       openPanel,
	};
} )();
