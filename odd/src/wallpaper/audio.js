/**
 * ODD audio analyser — v0.10
 * ---------------------------------------------------------------
 * Opt-in Web Audio pipeline. Loaded lazily by the wallpaper runtime
 * the first time a user turns on audio-reactivity from the ODD panel.
 *
 * Contract:
 *   window.__odd.audio.enable()  → Promise<boolean>
 *       Requests mic permission. On grant, wires up an
 *       AnalyserNode and starts sampling. On deny/error,
 *       resolves false and leaves the state off.
 *
 *   window.__odd.audio.disable()
 *       Stops the mic track, disconnects nodes, zeroes out
 *       the level/bass/mid/high signal.
 *
 *   window.__odd.audio.sample( out )
 *       Called by the shared tick runner every frame. Writes
 *       the current level/bass/mid/high/enabled into `out`
 *       (a plain object used as env.audio). Keeps zero allocs
 *       per frame.
 *
 *   window.__odd.audio.state()
 *       Returns `{ enabled, permission, error }` — used by the
 *       panel toggle to paint the right icon state.
 *
 * Frequency buckets (at 44.1 kHz, FFT 1024):
 *   bass: 20 Hz – 250 Hz
 *   mid:  250 Hz – 2 kHz
 *   high: 2 kHz – 8 kHz
 *
 * Values are smoothed toward peaks (fast attack, slow decay)
 * so scenes can map them directly to visual amplitude without
 * extra easing.
 */
( function () {
	'use strict';
	if ( typeof window === 'undefined' ) return;
	window.__odd = window.__odd || {};
	if ( window.__odd.audio && window.__odd.audio._installed ) return;

	var ctx        = null;
	var source     = null;
	var analyser   = null;
	var stream     = null;
	var freqBuf    = null;
	var sampleRate = 44100;
	var binCount   = 0;
	var state = {
		enabled: false,
		permission: 'unknown', // 'granted' | 'denied' | 'error' | 'unknown'
		error: null,
	};
	// Smoothed output. Updated in sample(), copied to env.audio.
	var smooth = { level: 0, bass: 0, mid: 0, high: 0 };

	function hzToBin( hz ) {
		if ( ! binCount ) return 0;
		var nyq = sampleRate * 0.5;
		return Math.max( 0, Math.min( binCount - 1, Math.round( ( hz / nyq ) * binCount ) ) );
	}

	function avgBand( lo, hi ) {
		if ( ! freqBuf ) return 0;
		var a = hzToBin( lo ), b = hzToBin( hi );
		if ( b <= a ) return 0;
		var sum = 0;
		for ( var i = a; i <= b; i++ ) sum += freqBuf[ i ];
		return ( sum / ( b - a + 1 ) ) / 255;
	}

	function sample( out ) {
		if ( ! analyser || ! freqBuf ) {
			if ( out ) {
				out.level = 0; out.bass = 0; out.mid = 0; out.high = 0;
				out.enabled = false;
			}
			return;
		}
		analyser.getByteFrequencyData( freqBuf );
		var bass = avgBand( 20, 250 );
		var mid  = avgBand( 250, 2000 );
		var high = avgBand( 2000, 8000 );
		// Overall level weights bass a little higher so drums
		// drive the "beat" more than cymbals.
		var level = Math.min( 1, bass * 0.55 + mid * 0.35 + high * 0.15 );
		// Asymmetric smoothing: snap up to peaks, ease off.
		function mix( prev, next ) {
			return next > prev ? next : prev * 0.88 + next * 0.12;
		}
		smooth.bass  = mix( smooth.bass,  bass  );
		smooth.mid   = mix( smooth.mid,   mid   );
		smooth.high  = mix( smooth.high,  high  );
		smooth.level = mix( smooth.level, level );
		if ( out ) {
			out.level = smooth.level;
			out.bass  = smooth.bass;
			out.mid   = smooth.mid;
			out.high  = smooth.high;
			out.enabled = true;
		}
	}

	function enable() {
		if ( state.enabled ) return Promise.resolve( true );
		if ( ! navigator.mediaDevices || ! navigator.mediaDevices.getUserMedia ) {
			state.error = new Error( 'getUserMedia unavailable' );
			state.permission = 'error';
			return Promise.resolve( false );
		}
		var AC = window.AudioContext || window.webkitAudioContext;
		if ( ! AC ) {
			state.error = new Error( 'AudioContext unavailable' );
			state.permission = 'error';
			return Promise.resolve( false );
		}
		return navigator.mediaDevices.getUserMedia( { audio: true, video: false } )
			.then( function ( s ) {
				stream   = s;
				ctx      = new AC();
				sampleRate = ctx.sampleRate || sampleRate;
				source   = ctx.createMediaStreamSource( s );
				analyser = ctx.createAnalyser();
				analyser.fftSize = 1024;
				analyser.smoothingTimeConstant = 0.72;
				binCount = analyser.frequencyBinCount;
				freqBuf  = new Uint8Array( binCount );
				source.connect( analyser );
				// Safari / autoplay: AudioContext may start suspended.
				if ( ctx.state === 'suspended' ) { try { ctx.resume(); } catch ( e ) { /* ignore */ } }
				state.enabled    = true;
				state.permission = 'granted';
				state.error      = null;
				window.dispatchEvent( new CustomEvent( 'odd:audio-change' ) );
				return true;
			} )
			.catch( function ( err ) {
				state.enabled = false;
				state.permission = ( err && err.name === 'NotAllowedError' ) ? 'denied' : 'error';
				state.error = err;
				window.dispatchEvent( new CustomEvent( 'odd:audio-change' ) );
				return false;
			} );
	}

	function disable() {
		state.enabled = false;
		smooth.level = 0; smooth.bass = 0; smooth.mid = 0; smooth.high = 0;
		try { if ( source ) source.disconnect(); } catch ( e ) { /* ignore */ }
		try { if ( analyser ) analyser.disconnect(); } catch ( e ) { /* ignore */ }
		if ( stream ) {
			try { stream.getTracks().forEach( function ( t ) { t.stop(); } ); } catch ( e ) { /* ignore */ }
		}
		if ( ctx && ctx.close ) { try { ctx.close(); } catch ( e ) { /* ignore */ } }
		source = null; analyser = null; freqBuf = null; ctx = null; stream = null; binCount = 0;
		window.dispatchEvent( new CustomEvent( 'odd:audio-change' ) );
	}

	function snapshot() {
		return {
			enabled: state.enabled,
			permission: state.permission,
			error: state.error ? ( state.error.message || String( state.error ) ) : null,
		};
	}

	window.__odd.audio = {
		_installed: true,
		enable:  enable,
		disable: disable,
		sample:  sample,
		state:   snapshot,
	};
} )();
