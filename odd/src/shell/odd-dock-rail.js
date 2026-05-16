/**
 * Dock rail renderer — “ODD compact rail”.
 *
 * Contributes wp.desktop.registerDockRailRenderer({ id:'odd-compact', … }) so OS
 * Settings → Dock style can swap to a high-legibility mosaic row.
 *
 * Mirrors the Desktop Mode dispatcher contract returned by default Icon strip's
 * mount(): replaceItems / appendSystemItem / removeSystemItem / setBadge /
 * setAttention / setOrientation / destroy (see wordpress.org/desktop-mode trunk
 * desktop.js mountRail helpers).
 *
 * @since ODD bundling Desktop Mode surface expansion
 */
( function () {
	'use strict';

	var OWNER = 'odd-dock-rail';

	function __( text ) {
		if ( window.wp && window.wp.i18n && typeof window.wp.i18n.__ === 'function' ) {
			return window.wp.i18n.__( text, 'odd-outlandish-desktop-decorator' );
		}
		return text;
	}

	function dashIconMarkup( klass ) {
		var sp = document.createElement( 'span' );
		sp.className = 'dashicons ' + klass;
		sp.setAttribute( 'aria-hidden', 'true' );
		return sp;
	}

	/** True when `src` belongs on `<img>` (absolute URL, proto-relative, site-relative SVG, data URI). */
	function isIconImgSrc( u ) {
		if ( typeof u !== 'string' || '' === u ) {
			return false;
		}
		if ( /^https?:\/\//i.test( u ) ) {
			return true;
		}
		if ( u.slice( 0, 2 ) === '//' ) {
			return true;
		}
		if ( u.slice( 0, 5 ) === 'data:' ) {
			return true;
		}
		if ( u.slice( 0, 1 ) === '/' ) {
			return true;
		}
		return false;
	}

	function imageMarkup( src, klass ) {
		var img = document.createElement( 'img' );
		if ( klass ) {
			img.className = klass;
		}
		img.loading = 'lazy';
		img.decoding = 'async';
		img.src = src;
		img.alt = '';
		return img;
	}

	function thumbForItem( icon ) {
		icon = typeof icon === 'string' ? icon : '';
		if ( icon.slice( 0, 10 ) === 'dashicons-' ) {
			return dashIconMarkup( icon );
		}
		if ( isIconImgSrc( icon ) ) {
			return imageMarkup( icon );
		}
		var fallback = dashIconMarkup( 'dashicons-admin-plugins' );
		return fallback;
	}

	function dockKeyUrl( item ) {
		var u = '';
		try {
			if ( item.url ) {
				u = item.url + '';
			}
		} catch ( _ ) {}
		try {
			if ( ! u && typeof item.slug === 'string' ) {
				u = item.slug + '';
			}
		} catch ( __ ) {}
		return u ? u : '_' + JSON.stringify( { t: item.title || '' } ).slice( 0, 80 );
	}

	function openMenuTile( deps, item ) {
		try {
			if ( item.multi && deps.requestSubmenu && typeof deps.requestSubmenu === 'function' ) {
				deps.requestSubmenu( item );
				return;
			}
			if ( deps.openItem && typeof deps.openItem === 'function' ) {
				deps.openItem( item );
			}
		} catch ( _ ) {}
	}

	function oddDockMenuBridge() {
		return window.__odd && window.__odd.desktopHooks || null;
	}

	function itemId( item ) {
		if ( ! item || typeof item !== 'object' ) {
			return '';
		}
		return String( item.id || item.windowId || item.baseId || item.slug || '' );
	}

	function isOddDockItem( item ) {
		var id = itemId( item );
		if ( id === 'odd' || id.indexOf( 'odd-app-' ) === 0 || id.indexOf( 'odd/' ) === 0 ) {
			return true;
		}
		return !! ( item && typeof item.title === 'string' && item.title.indexOf( 'ODD' ) === 0 );
	}

	function keyboardMenuPoint( tile ) {
		if ( ! tile || typeof tile.getBoundingClientRect !== 'function' ) {
			return { x: 16, y: 16 };
		}
		var rect = tile.getBoundingClientRect();
		return {
			x: rect.left + Math.max( 12, Math.min( rect.width - 8, 28 ) ),
			y: rect.top + Math.max( 12, Math.min( rect.height - 8, 28 ) ),
		};
	}

	function openOddDockMenu( eventOrPoint, item ) {
		if ( ! isOddDockItem( item ) ) {
			return false;
		}
		var bridge = oddDockMenuBridge();
		if ( ! bridge || typeof bridge.openDockTileMenu !== 'function' ) {
			return false;
		}
		var point = eventOrPoint || {};
		bridge.openDockTileMenu( {
			x:      point.clientX != null ? point.clientX : point.x,
			y:      point.clientY != null ? point.clientY : point.y,
			item:   item,
			source: 'desktop-mode.dock-rail.context-menu',
		} );
		return true;
	}

	function attachOddDockMenu( tile, item ) {
		if ( ! tile || ! isOddDockItem( item ) || typeof tile.addEventListener !== 'function' ) {
			return;
		}
		tile.setAttribute( 'aria-haspopup', 'menu' );
		tile.addEventListener( 'contextmenu', function ( ev ) {
			if ( ev.defaultPrevented ) return;
			if ( openOddDockMenu( ev, item ) ) {
				ev.preventDefault();
				ev.stopPropagation();
			}
		} );
		tile.addEventListener( 'keydown', function ( ev ) {
			if ( ev.key !== 'ContextMenu' && ! ( ev.shiftKey && ev.key === 'F10' ) ) {
				return;
			}
			var point = keyboardMenuPoint( tile );
			if ( openOddDockMenu( point, item ) ) {
				ev.preventDefault();
			}
		} );
	}

	function rebuildMenuTiles( deps, menuRow ) {
		var frag = document.createDocumentFragment();
		( deps.items || [] ).forEach(
			function ( item ) {
				var btn = document.createElement( 'button' );
				btn.type = 'button';
				btn.className = 'odd-dock-rail-mount__tile';
				btn.setAttribute( 'data-odd-kind', 'menu' );
				btn.setAttribute( 'data-odd-ref', dockKeyUrl( item ) );
				btn.setAttribute( 'aria-label', item.title || '' );
				btn.appendChild( thumbForItem( item.icon, item ) );
				btn.addEventListener( 'click', function () {
					openMenuTile( deps, item );
				} );
				attachOddDockMenu( btn, item );
				frag.appendChild( btn );
			}
		);
		menuRow.textContent = '';
		menuRow.appendChild( frag );
	}

	function registerRenderer() {
		var d = window.wp && window.wp.desktop;
		if ( ! d || typeof d.registerDockRailRenderer !== 'function' ) {
			return;
		}

		function mountMount( deps ) {
			var wrapper = deps.container;
			wrapper.innerHTML = '';
			wrapper.classList.add( 'odd-dock-rail-mount' );

			var menuRow = document.createElement( 'div' );
			menuRow.className = 'odd-dock-rail-mount__menu';

			var div = document.createElement( 'div' );
			div.className = 'odd-dock-rail-mount__divider';
			div.setAttribute( 'aria-hidden', 'true' );

			var sysRow = document.createElement( 'div' );
			sysRow.className = 'odd-dock-rail-mount__system';

			wrapper.appendChild( menuRow );
			wrapper.appendChild( div );
			wrapper.appendChild( sysRow );

			function applyOrientation( next ) {
				deps.orientation = next != null ? next : deps.orientation;
				var o = deps.orientation;
				if ( o === 'left' || o === 'right' ) {
					wrapper.setAttribute( 'data-odd-orient', 'side' );
				} else {
					wrapper.setAttribute( 'data-odd-orient', 'horizontal' );
				}
			}
			applyOrientation( deps.orientation );
			rebuildMenuTiles( deps, menuRow );

			var sysById = {};

			function makeSystemBtn( item ) {
				var idRaw = '';
				try {
					if ( item.id != null ) {
						idRaw = String( item.id );
					}
				} catch ( __ ) {}

				var btn = document.createElement( 'button' );
				btn.type = 'button';
				btn.className = 'odd-dock-rail-mount__tile odd-dock-rail-mount__tile--system';
				btn.setAttribute( 'data-odd-kind', 'system' );
				if ( idRaw ) {
					btn.setAttribute( 'data-odd-system-id', idRaw );
					sysById[ idRaw ] = btn;
				}
				btn.setAttribute(
					'aria-label',
					item.title ||
						item.label ||
						( item.window ? String( item.window ) : 'App' )
				);

				btn.appendChild( thumbForItem( item.icon, item ) );
				btn.addEventListener(
					'click',
					function () {
						try {
							if ( typeof item.onOpen === 'function' ) {
								item.onOpen();
							} else if ( deps.openSystemItem && typeof deps.openSystemItem === 'function' ) {
								deps.openSystemItem( item );
							}
						} catch ( _ ) {}
					}
				);
				attachOddDockMenu( btn, item );
				return btn;
			}

			return {
				replaceItems: function ( items ) {
					deps.items = Array.isArray( items ) ? items : [];
					rebuildMenuTiles( deps, menuRow );
				},
				appendSystemItem: function ( wrapped ) {
					sysRow.appendChild( makeSystemBtn( wrapped ) );
				},
				removeSystemItem: function ( id ) {
					var key = String( id );
					var el = sysById[ key ];
					if ( el && el.parentNode ) {
						el.parentNode.removeChild( el );
					}
					delete sysById[ key ];
				},
				setBadge: function () {
				},
				setAttention: function () {
				},
				setOrientation: function ( next ) {
					applyOrientation( next );
				},
				destroy: function () {
					wrapper.innerHTML = '';
				},
			};
		}

		try {
			d.registerDockRailRenderer( {
				id:          'odd-compact',
				label:       __( 'ODD compact rail' ),
				description: __( 'High-contrast icon mosaic selectable alongside the shipped strip in OS Settings.', 'odd-outlandish-desktop-decorator' ),
				icon:        'dashicons-art',
				apiVersion:  1,
				owner:       OWNER,
				mount:       function ( deps ) {
					return mountMount( deps );
				},
			} );
		} catch ( _ ) {}
	}

	function boot() {
		registerRenderer();
	}

	if ( window.wp && window.wp.desktop && typeof window.wp.desktop.ready === 'function' ) {
		window.wp.desktop.ready( boot );
	} else {
		boot();
	}
} )();
