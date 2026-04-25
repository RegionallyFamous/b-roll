/**
 * ODD error boundary helpers (window.__odd.safeCall + wrapMethod)
 * ---------------------------------------------------------------
 * Catches exceptions thrown by scene / panel / widget / command
 * callbacks, routes them to the shared event bus as `odd.error`,
 * and returns undefined so the calling site continues instead of
 * cascading. Scene authors get the same contract as before; an
 * unhandled throw in one scene's `setup` or `tick` no longer takes
 * the whole Pixi stage down.
 *
 * Usage:
 *
 *   var result = window.__odd.safeCall( fn, 'wallpaper.tick', 'error', arg1, arg2 );
 *
 *   // Or lift an object's method in place:
 *   window.__odd.safeCall.wrapMethod( scene, 'setup', 'wallpaper.scene:' + slug );
 *   scene.setup( env );  // now safe
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	if ( window.__odd.safeCall ) return;

	function report( source, err, severity ) {
		if ( window.__odd.events ) {
			try {
				window.__odd.events.emit( 'odd.error', {
					source:   source || 'unknown',
					err:      err,
					severity: severity || 'error',
					message:  err && err.message,
					stack:    err && err.stack,
				} );
			} catch ( e2 ) { /* bus itself failed; nothing to do */ }
		}
		if ( window.__odd.store && window.__odd.store.get( 'runtime.debug' ) && window.console ) {
			try { window.console.error( '[ODD ' + ( source || 'unknown' ) + ']', err ); } catch ( e3 ) {}
		}
	}

	function safeCall( fn, source, severity ) {
		if ( typeof fn !== 'function' ) return undefined;
		var args = Array.prototype.slice.call( arguments, 3 );
		try {
			return fn.apply( null, args );
		} catch ( err ) {
			report( source, err, severity );
			return undefined;
		}
	}

	function wrapMethod( obj, method, source ) {
		if ( ! obj || typeof obj[ method ] !== 'function' ) return;
		if ( obj[ method ].__odd_wrapped ) return;
		var original = obj[ method ];
		var wrapped  = function () {
			try {
				return original.apply( this, arguments );
			} catch ( err ) {
				report( source, err, 'error' );
				return undefined;
			}
		};
		wrapped.__odd_wrapped = true;
		obj[ method ] = wrapped;
	}

	safeCall.wrapMethod = wrapMethod;

	window.__odd.safeCall = safeCall;
} )();
