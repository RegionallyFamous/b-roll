/**
 * ODD — desktop widgets for WP Desktop Mode
 * ---------------------------------------------------------------
 * Registers four right-column cards via wp.desktop.registerWidget.
 * All four are live — they subscribe to `odd/pickScene` + the
 * OS clock and re-render without a reload when the user swaps
 * scenes or icon sets from the Control Panel, the slash palette,
 * or another widget.
 *
 *   odd/now-playing  — current scene + "Shuffle" button
 *   odd/picker       — mini scene grid, click to swap
 *   odd/postcard     — single hero thumb of the active scene
 *   odd/clock        — time-of-day, re-skinned per icon set
 *
 * Uses the shared client API at window.__odd.api so every
 * surface performs swaps identically.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;

	function ready( cb ) {
		if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
			window.wp.desktop.ready( cb );
		} else if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', cb, { once: true } );
		} else {
			cb();
		}
	}

	function api() { return window.__odd && window.__odd.api; }

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

	function sceneLabel( slug ) {
		if ( ! api() ) return slug;
		var s = api().sceneBySlug( slug );
		return s && s.label ? s.label : slug;
	}
	function sceneCategory( slug ) {
		if ( ! api() ) return '';
		var s = api().sceneBySlug( slug );
		return s && s.franchise ? s.franchise : '';
	}
	function sceneFallback( slug ) {
		if ( ! api() ) return '#111';
		var s = api().sceneBySlug( slug );
		return s && s.fallbackColor ? s.fallbackColor : '#111';
	}
	function previewUrl( slug ) {
		var c = ( window.odd || {} );
		if ( ! c.pluginUrl ) return '';
		return c.pluginUrl + '/assets/previews/' + slug + '.webp?v=' + encodeURIComponent( c.version || '' );
	}

	// ============================================================ //
	// Now Playing — live scene title + shuffle button.
	// ============================================================ //

	function mountNowPlaying( container ) {
		container.classList.add( 'odd-widget', 'odd-widget--now' );

		var sub    = el( 'div', { class: 'odd-widget__sub' }, 'Now playing' );
		var title  = el( 'div', { class: 'odd-widget__title' }, sceneLabel( api() ? api().currentScene() : '' ) );
		var cat    = el( 'div', { class: 'odd-widget__cat' }, sceneCategory( api() ? api().currentScene() : '' ) );
		var btn    = el( 'button', { type: 'button', class: 'odd-widget__btn' }, 'Shuffle' );
		var panel  = el( 'button', { type: 'button', class: 'odd-widget__btn odd-widget__btn--ghost' }, 'Open ODD' );

		var row    = el( 'div', { class: 'odd-widget__row' }, [ btn, panel ] );
		container.appendChild( sub );
		container.appendChild( title );
		container.appendChild( cat );
		container.appendChild( row );

		function update( slug ) {
			title.textContent = sceneLabel( slug );
			cat.textContent   = sceneCategory( slug );
			container.style.setProperty( '--odd-accent', sceneFallback( slug ) );
		}
		update( api() ? api().currentScene() : '' );

		btn.addEventListener( 'click', function () {
			if ( api() ) api().shuffle();
		} );
		panel.addEventListener( 'click', function () {
			if ( api() ) api().openPanel();
		} );

		var unsub = api() ? api().onSceneChange( update ) : function () {};
		return function () {
			unsub();
			container.classList.remove( 'odd-widget', 'odd-widget--now' );
		};
	}

	// ============================================================ //
	// Picker — mini grid of scene thumbs.
	// ============================================================ //

	function mountPicker( container ) {
		container.classList.add( 'odd-widget', 'odd-widget--picker' );

		var heading = el( 'div', { class: 'odd-widget__sub' }, 'Scenes' );
		var grid    = el( 'div', { class: 'odd-widget__grid' } );
		container.appendChild( heading );
		container.appendChild( grid );

		function renderGrid() {
			grid.innerHTML = '';
			var list = api() ? api().scenes() : [];
			var cur  = api() ? api().currentScene() : '';
			list.forEach( function ( s ) {
				if ( ! s || ! s.slug ) return;
				var tile = el( 'button', {
					type: 'button',
					class: 'odd-widget__tile' + ( s.slug === cur ? ' is-active' : '' ),
					title: s.label || s.slug,
					'data-slug': s.slug,
				} );
				var thumb = el( 'span', { class: 'odd-widget__thumb', style: 'background:' + ( s.fallbackColor || '#111' ) } );
				var url   = previewUrl( s.slug );
				if ( url ) thumb.style.backgroundImage = 'url(' + url + ')';
				var label = el( 'span', { class: 'odd-widget__tile-label' }, s.label || s.slug );
				tile.appendChild( thumb );
				tile.appendChild( label );
				tile.addEventListener( 'click', function () {
					if ( api() ) api().setScene( s.slug );
				} );
				grid.appendChild( tile );
			} );
		}
		renderGrid();

		var unsub = api() ? api().onSceneChange( function () { renderGrid(); } ) : function () {};
		return function () {
			unsub();
			container.classList.remove( 'odd-widget', 'odd-widget--picker' );
		};
	}

	// ============================================================ //
	// Postcard — hero preview with parallax-on-hover.
	// ============================================================ //

	function mountPostcard( container ) {
		container.classList.add( 'odd-widget', 'odd-widget--postcard' );

		var frame = el( 'div', { class: 'odd-widget__frame' } );
		var art   = el( 'div', { class: 'odd-widget__art' } );
		var meta  = el( 'div', { class: 'odd-widget__caption' } );
		var label = el( 'div', { class: 'odd-widget__title' } );
		var cat   = el( 'div', { class: 'odd-widget__cat' } );
		meta.appendChild( label );
		meta.appendChild( cat );
		frame.appendChild( art );
		container.appendChild( frame );
		container.appendChild( meta );

		function setArt( slug ) {
			var url = previewUrl( slug );
			art.style.backgroundColor = sceneFallback( slug );
			art.style.backgroundImage = url ? 'url(' + url + ')' : 'none';
			label.textContent = sceneLabel( slug );
			cat.textContent   = sceneCategory( slug );
		}
		setArt( api() ? api().currentScene() : '' );

		function onMove( ev ) {
			var r = frame.getBoundingClientRect();
			var x = ( ev.clientX - r.left ) / Math.max( 1, r.width )  - 0.5;
			var y = ( ev.clientY - r.top  ) / Math.max( 1, r.height ) - 0.5;
			art.style.transform = 'translate3d(' + ( -x * 14 ).toFixed( 2 ) + 'px,' + ( -y * 10 ).toFixed( 2 ) + 'px,0) scale(1.06)';
		}
		function onLeave() { art.style.transform = ''; }
		frame.addEventListener( 'pointermove', onMove );
		frame.addEventListener( 'pointerleave', onLeave );

		frame.addEventListener( 'click', function () {
			if ( api() ) api().openPanel();
		} );

		var unsub = api() ? api().onSceneChange( setArt ) : function () {};
		return function () {
			unsub();
			frame.removeEventListener( 'pointermove', onMove );
			frame.removeEventListener( 'pointerleave', onLeave );
			container.classList.remove( 'odd-widget', 'odd-widget--postcard' );
		};
	}

	// ============================================================ //
	// Clock — time-of-day re-skinned per active icon set.
	// ============================================================ //

	var CLOCK_SKINS = {
		none:     { cls: 'odd-clock--neutral',  accent: '#7a8190' },
		filament: { cls: 'odd-clock--filament', accent: '#ffd480' },
		arctic:   { cls: 'odd-clock--arctic',   accent: '#ff3f98' },
		fold:     { cls: 'odd-clock--fold',     accent: '#c89a62' },
	};

	function mountClock( container ) {
		container.classList.add( 'odd-widget', 'odd-widget--clock' );

		var time = el( 'div', { class: 'odd-clock__time' } );
		var date = el( 'div', { class: 'odd-clock__date' } );
		container.appendChild( time );
		container.appendChild( date );

		function paint( slug ) {
			var k = slug || 'none';
			var skin = CLOCK_SKINS[ k ] || CLOCK_SKINS.none;
			// Remove any previous skin class.
			Object.keys( CLOCK_SKINS ).forEach( function ( kk ) {
				container.classList.remove( CLOCK_SKINS[ kk ].cls );
			} );
			container.classList.add( skin.cls );
			container.style.setProperty( '--odd-accent', skin.accent );
		}

		function pad( n ) { return ( n < 10 ? '0' : '' ) + n; }
		function tick() {
			var now = new Date();
			var h = now.getHours();
			var m = now.getMinutes();
			var mer = h >= 12 ? 'PM' : 'AM';
			var h12 = ( ( h + 11 ) % 12 ) + 1;
			time.innerHTML = '<span class="odd-clock__h">' + h12 + '</span><span class="odd-clock__colon">:</span><span class="odd-clock__m">' + pad( m ) + '</span><span class="odd-clock__mer">' + mer + '</span>';
			date.textContent = now.toLocaleDateString( undefined, { weekday: 'short', month: 'short', day: 'numeric' } );
		}
		paint( api() ? api().currentIconSet() : '' );
		tick();
		var iv = window.setInterval( tick, 15 * 1000 );

		var unsubIcons = api() ? api().onIconSetChange( paint ) : function () {};
		return function () {
			window.clearInterval( iv );
			unsubIcons();
			Object.keys( CLOCK_SKINS ).forEach( function ( k ) {
				container.classList.remove( CLOCK_SKINS[ k ].cls );
			} );
			container.classList.remove( 'odd-widget', 'odd-widget--clock' );
		};
	}

	// ============================================================ //
	// Register.
	// ============================================================ //

	// Wrap each widget's `mount` so a throw inside one mount doesn't
	// brick the other widgets on the same page. Reports via the ODD
	// event bus when the foundation is available.
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

	ready( function () {
		if ( ! window.wp || ! window.wp.desktop || typeof window.wp.desktop.registerWidget !== 'function' ) return;

		window.wp.desktop.registerWidget( {
			id:          'odd/now-playing',
			label:       'ODD · Now Playing',
			description: 'Current scene, with a quick-shuffle button.',
			icon:        'dashicons-format-video',
			movable:     true,
			resizable:   true,
			minWidth:    220,
			minHeight:   140,
			defaultWidth:  260,
			defaultHeight: 150,
			mount:       safeMount( mountNowPlaying, 'widget.now-playing' ),
		} );

		window.wp.desktop.registerWidget( {
			id:          'odd/picker',
			label:       'ODD · Scene Picker',
			description: 'Mini grid of scenes, click to swap instantly.',
			icon:        'dashicons-art',
			movable:     true,
			resizable:   true,
			minWidth:    260,
			minHeight:   200,
			defaultWidth:  320,
			defaultHeight: 260,
			mount:       safeMount( mountPicker, 'widget.picker' ),
		} );

		window.wp.desktop.registerWidget( {
			id:          'odd/postcard',
			label:       'ODD · Postcard',
			description: 'Hero thumbnail of the active scene with a subtle tilt.',
			icon:        'dashicons-format-image',
			movable:     true,
			resizable:   true,
			minWidth:    220,
			minHeight:   180,
			defaultWidth:  260,
			defaultHeight: 200,
			mount:       safeMount( mountPostcard, 'widget.postcard' ),
		} );

		window.wp.desktop.registerWidget( {
			id:          'odd/clock',
			label:       'ODD · Clock',
			description: 'Time of day, re-skinned to match the active icon set.',
			icon:        'dashicons-clock',
			movable:     true,
			resizable:   true,
			minWidth:    200,
			minHeight:   110,
			defaultWidth:  240,
			defaultHeight: 130,
			mount:       safeMount( mountClock, 'widget.clock' ),
		} );
	} );
} )();
