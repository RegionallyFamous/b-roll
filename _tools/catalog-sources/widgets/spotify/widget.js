/**
 * ODD · Spotify Embed widget.
 *
 * The user pastes any Spotify URL (open.spotify.com/...) or URI
 * (spotify:...) for a playlist, album, track, artist, show, or
 * episode. The widget parses and validates the input, then renders
 * Spotify's official Embed iframe built from the known
 * https://open.spotify.com/embed/{type}/{id} shape. Raw iframe HTML
 * and unknown domains are rejected; we never inject user-supplied
 * markup.
 *
 * Playback is owned by Spotify. Region, login state, and
 * encrypted-media support all live inside Spotify's iframe; the
 * widget only brokers the embed URL and persists the user's choice
 * through ctx.persist / ctx.restore.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	var wpI18nW = window.wp && window.wp.i18n;
	function __( s ) {
		return ( wpI18nW && typeof wpI18nW.__ === 'function' ) ? wpI18nW.__( s, 'odd' ) : s;
	}

	function ready( cb ) {
		if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( cb );
		} else if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', cb, { once: true } );
		} else {
			cb();
		}
	}

	function el( tag, attrs, children ) {
		var n = document.createElement( tag );
		if ( attrs ) {
			for ( var k in attrs ) {
				if ( ! Object.prototype.hasOwnProperty.call( attrs, k ) ) continue;
				if ( k === 'class' ) n.className = attrs[ k ];
				else if ( k === 'style' ) n.setAttribute( 'style', attrs[ k ] );
				else n.setAttribute( k, attrs[ k ] );
			}
		}
		if ( children ) {
			if ( ! Array.isArray( children ) ) children = [ children ];
			children.forEach( function ( c ) {
				if ( c == null ) return;
				n.appendChild( typeof c === 'string' ? document.createTextNode( c ) : c );
			} );
		}
		return n;
	}

	function safeMount( fn, source ) {
		return function ( node, ctx ) {
			try {
				return fn( node, ctx );
			} catch ( err ) {
				if ( window.__odd && window.__odd.events ) {
					try {
						window.__odd.events.emit( 'odd.error', {
							source:   source,
							err:      err,
							severity: 'error',
							message:  err && err.message,
							stack:    err && err.stack,
						} );
					} catch ( e2 ) {}
				}
				if ( window.console ) { try { window.console.error( '[ODD ' + source + ']', err ); } catch ( e3 ) {} }
				return function () {};
			}
		};
	}

	// ---------------------------------------------------------------
	// URL parsing. Accept only open.spotify.com URLs and spotify:
	// URIs. Map the Spotify content type to an embed path segment and
	// validate the ID as a Spotify base62-ish token.
	// ---------------------------------------------------------------

	var SUPPORTED_TYPES = {
		playlist: __( 'Playlist' ),
		album:    __( 'Album' ),
		track:    __( 'Track' ),
		artist:   __( 'Artist' ),
		show:     __( 'Show' ),
		episode:  __( 'Episode' ),
	};
	var ID_RE = /^[A-Za-z0-9]{16,40}$/;

	function parseSpotifyInput( raw ) {
		if ( typeof raw !== 'string' ) return null;
		var trimmed = raw.trim();
		if ( ! trimmed ) return null;

		// Reject anything that looks like HTML or javascript: payloads.
		if ( /<[a-z!\/]/i.test( trimmed ) ) return null;
		if ( /^javascript:/i.test( trimmed ) ) return null;

		// spotify:{type}:{id} URI form.
		var uri = trimmed.match( /^spotify:([a-z]+):([A-Za-z0-9]+)$/i );
		if ( uri ) {
			var uType = uri[ 1 ].toLowerCase();
			var uId   = uri[ 2 ];
			if ( ! SUPPORTED_TYPES[ uType ] ) return null;
			if ( ! ID_RE.test( uId ) )         return null;
			return {
				type:        uType,
				id:          uId,
				originalUrl: 'spotify:' + uType + ':' + uId,
				openUrl:     'https://open.spotify.com/' + uType + '/' + uId,
			};
		}

		// open.spotify.com/{type}/{id} URL form.
		var parsed;
		try {
			parsed = new URL( trimmed );
		} catch ( e ) {
			return null;
		}
		if ( parsed.protocol !== 'https:' && parsed.protocol !== 'http:' ) return null;
		if ( parsed.hostname !== 'open.spotify.com' ) return null;

		// Path shapes: /{type}/{id}, /embed/{type}/{id}, or /intl-xx/{type}/{id}.
		var parts = parsed.pathname.split( '/' ).filter( Boolean );
		if ( parts.length < 2 ) return null;
		if ( parts[ 0 ] === 'embed' )             parts.shift();
		else if ( /^intl-[a-z]{2}$/i.test( parts[ 0 ] ) ) parts.shift();
		if ( parts.length < 2 ) return null;

		var pType = parts[ 0 ].toLowerCase();
		var pId   = parts[ 1 ];
		if ( ! SUPPORTED_TYPES[ pType ] ) return null;
		if ( ! ID_RE.test( pId ) )         return null;

		return {
			type:        pType,
			id:          pId,
			originalUrl: 'https://open.spotify.com/' + pType + '/' + pId,
			openUrl:     'https://open.spotify.com/' + pType + '/' + pId,
		};
	}

	function buildEmbedUrl( parsed ) {
		return 'https://open.spotify.com/embed/' + parsed.type + '/' + parsed.id +
			'?utm_source=odd';
	}

	// ---------------------------------------------------------------
	// Scoped styles. Injected into the widget container so two copies
	// of the widget never interfere with each other.
	// ---------------------------------------------------------------

	var STYLE_RULES =
		'.odd-spotify{display:flex;flex-direction:column;height:100%;width:100%;box-sizing:border-box;' +
			'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1d1d1f;}' +
		'.odd-spotify__head{display:flex;align-items:center;justify-content:space-between;gap:8px;' +
			'padding:6px 8px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#555;}' +
		'.odd-spotify__head strong{color:#1db954;letter-spacing:.08em;}' +
		'.odd-spotify__kind{font-weight:600;color:#1d1d1f;text-transform:none;letter-spacing:0;font-size:12px;' +
			'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}' +
		'.odd-spotify__body{flex:1;display:flex;min-height:0;}' +
		'.odd-spotify__iframe{flex:1;width:100%;height:100%;border:0;border-radius:12px;' +
			'background:#121212;min-height:80px;}' +
		'.odd-spotify__setup{flex:1;display:flex;flex-direction:column;gap:8px;padding:10px 12px;' +
			'background:linear-gradient(145deg,#121212 0%,#1f1f1f 100%);color:#f5f5f7;border-radius:12px;}' +
		'.odd-spotify__setup h4{margin:0;font-size:13px;font-weight:600;letter-spacing:.02em;}' +
		'.odd-spotify__setup p{margin:0;font-size:11px;line-height:1.35;opacity:.75;}' +
		'.odd-spotify__input{flex:1;font:inherit;font-size:12px;padding:8px 10px;border-radius:8px;' +
			'border:1px solid #3a3a3c;background:#2c2c2e;color:#f5f5f7;min-width:0;}' +
		'.odd-spotify__input:focus{outline:none;border-color:#1db954;box-shadow:0 0 0 2px rgba(29,185,84,.35);}' +
		'.odd-spotify__row{display:flex;gap:6px;align-items:stretch;}' +
		'.odd-spotify__actions{display:flex;gap:6px;padding:6px 8px 8px;justify-content:flex-end;flex-wrap:wrap;}' +
		'.odd-spotify__btn{font:inherit;font-size:11px;padding:5px 9px;border-radius:6px;cursor:pointer;' +
			'border:1px solid rgba(0,0,0,.12);background:#fff;color:#1d1d1f;transition:background .15s;}' +
		'.odd-spotify__btn:hover{background:#f2f2f2;}' +
		'.odd-spotify__btn--primary{background:#1db954;color:#fff;border-color:transparent;}' +
		'.odd-spotify__btn--primary:hover{background:#17a34a;}' +
		'.odd-spotify__btn--ghost{background:transparent;border-color:transparent;color:#555;}' +
		'.odd-spotify__btn--ghost:hover{background:rgba(0,0,0,.05);color:#1d1d1f;}' +
		'.odd-spotify__error{margin:0;font-size:11px;color:#ff6b6b;min-height:1em;}' +
		'.odd-spotify__hint{margin:0;font-size:10px;opacity:.6;line-height:1.35;}' +
		'@media (prefers-color-scheme: dark){' +
			'.odd-spotify{color:#f5f5f7;}' +
			'.odd-spotify__head{color:#a1a1a6;}' +
			'.odd-spotify__kind{color:#f5f5f7;}' +
			'.odd-spotify__btn{background:#2c2c2e;color:#f5f5f7;border-color:#3a3a3c;}' +
			'.odd-spotify__btn:hover{background:#3a3a3c;}' +
			'.odd-spotify__btn--ghost{color:#a1a1a6;}' +
			'.odd-spotify__btn--ghost:hover{background:rgba(255,255,255,.08);color:#f5f5f7;}' +
		'}';

	function injectStyles( container ) {
		if ( container.querySelector( '.odd-spotify__styles' ) ) return;
		var style = document.createElement( 'style' );
		style.className = 'odd-spotify__styles';
		style.textContent = STYLE_RULES;
		container.appendChild( style );
	}

	// ---------------------------------------------------------------
	// Render states.
	// ---------------------------------------------------------------

	function mountSpotify( container, ctx ) {
		container.classList.add( 'odd-widget', 'odd-widget--spotify' );
		injectStyles( container );

		var root = el( 'div', { class: 'odd-spotify' } );
		container.appendChild( root );

		var state = {
			parsed: null,
		};

		// Hydrate from persisted snapshot if the parsed form still
		// validates. Anything stale or malformed falls back to setup.
		var restored = ( typeof ctx.restore === 'function' ) ? ctx.restore() : null;
		if ( restored && typeof restored === 'object' && restored.originalUrl ) {
			var hydrated = parseSpotifyInput( restored.originalUrl );
			if ( hydrated ) state.parsed = hydrated;
		}

		function persist() {
			if ( typeof ctx.persist !== 'function' ) return;
			if ( ! state.parsed ) { ctx.persist( null ); return; }
			ctx.persist( {
				type:        state.parsed.type,
				id:          state.parsed.id,
				originalUrl: state.parsed.originalUrl,
				updatedAt:   Date.now(),
			} );
		}

		function renderSetup( prefill, errorMessage ) {
			root.innerHTML = '';

			var setup = el( 'div', { class: 'odd-spotify__setup' } );
			setup.appendChild( el( 'h4', {}, __( 'Embed a Spotify link' ) ) );
			setup.appendChild( el( 'p', {}, __( 'Paste a Spotify playlist, album, track, artist, show, or episode URL — from the Share menu or the Spotify address bar.' ) ) );

			var form = el( 'form', { class: 'odd-spotify__row' } );
			var input = el( 'input', {
				type:          'url',
				class:         'odd-spotify__input',
				placeholder:   'https://open.spotify.com/playlist/…',
				'aria-label':  __( 'Spotify URL' ),
				spellcheck:    'false',
				autocomplete:  'off',
				autocorrect:   'off',
				autocapitalize: 'off',
			} );
			if ( prefill ) input.value = prefill;
			var submit = el( 'button', {
				type:  'submit',
				class: 'odd-spotify__btn odd-spotify__btn--primary',
			}, __( 'Embed' ) );
			form.appendChild( input );
			form.appendChild( submit );
			setup.appendChild( form );

			var err = el( 'p', { class: 'odd-spotify__error', role: 'alert' }, errorMessage || '' );
			setup.appendChild( err );

			setup.appendChild( el( 'p', { class: 'odd-spotify__hint' },
				__( 'Spotify may only play 30-second previews unless your browser is signed in and supports encrypted media.' )
			) );

			root.appendChild( setup );

			form.addEventListener( 'submit', function ( ev ) {
				ev.preventDefault();
				var parsed = parseSpotifyInput( input.value );
				if ( ! parsed ) {
					err.textContent = __( 'That doesn\u2019t look like a Spotify playlist, album, track, artist, show, or episode URL.' );
					return;
				}
				state.parsed = parsed;
				persist();
				renderPlayer();
			} );

			setTimeout( function () { try { input.focus(); } catch ( e ) {} }, 0 );
		}

		function renderPlayer() {
			if ( ! state.parsed ) { renderSetup(); return; }

			root.innerHTML = '';

			var head = el( 'div', { class: 'odd-spotify__head' } );
			head.appendChild( el( 'strong', {}, 'Spotify' ) );
			var kindText = SUPPORTED_TYPES[ state.parsed.type ] || state.parsed.type;
			head.appendChild( el( 'span', { class: 'odd-spotify__kind' }, kindText ) );
			root.appendChild( head );

			var body = el( 'div', { class: 'odd-spotify__body' } );
			var iframe = el( 'iframe', {
				src:             buildEmbedUrl( state.parsed ),
				class:           'odd-spotify__iframe',
				title:           __( 'Spotify Embed' ) + ' — ' + kindText,
				loading:         'lazy',
				referrerpolicy:  'strict-origin-when-cross-origin',
				allow:           'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
				allowfullscreen: 'true',
			} );
			body.appendChild( iframe );
			root.appendChild( body );

			var actions = el( 'div', { class: 'odd-spotify__actions' } );
			var change = el( 'button', { type: 'button', class: 'odd-spotify__btn' }, __( 'Change' ) );
			var open   = el( 'a', {
				href:   state.parsed.openUrl,
				target: '_blank',
				rel:    'noopener noreferrer',
				class:  'odd-spotify__btn',
			}, __( 'Open in Spotify' ) );
			var clear  = el( 'button', { type: 'button', class: 'odd-spotify__btn odd-spotify__btn--ghost' }, __( 'Clear' ) );

			change.addEventListener( 'click', function () {
				renderSetup( state.parsed ? state.parsed.originalUrl : '', '' );
			} );
			clear.addEventListener( 'click', function () {
				state.parsed = null;
				persist();
				renderSetup( '', '' );
			} );

			actions.appendChild( change );
			actions.appendChild( open );
			actions.appendChild( clear );
			root.appendChild( actions );
		}

		if ( state.parsed ) renderPlayer();
		else                renderSetup();

		return function unmount() {
			container.classList.remove( 'odd-widget', 'odd-widget--spotify' );
			root.innerHTML = '';
			if ( root.parentNode === container ) container.removeChild( root );
		};
	}

	// Expose the parser for integration tests. Keep it under the ODD
	// global so test harnesses can reach it without re-requiring a
	// module system inside catalog widgets.
	try {
		window.__odd = window.__odd || {};
		window.__odd.widgets = window.__odd.widgets || {};
		window.__odd.widgets.spotify = {
			parse:    parseSpotifyInput,
			embedUrl: buildEmbedUrl,
			types:    Object.keys( SUPPORTED_TYPES ),
		};
	} catch ( e ) {}

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWidget !== 'function' ) return;
		window.wp.desktop.registerWidget( {
			id:            'odd/spotify',
			label:         __( 'ODD \u00b7 Spotify Embed' ),
			description:   __( 'Embed a Spotify playlist, album, track, artist, show, or episode on your desktop.' ),
			icon:          'dashicons-format-audio',
			movable:       true,
			resizable:     true,
			minWidth:      300,
			minHeight:     190,
			defaultWidth:  360,
			defaultHeight: 460,
			mount:         safeMount( mountSpotify, 'widget.spotify' ),
		} );
	} );
} )();
