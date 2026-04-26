#!/usr/bin/env bash
# install-wp-tests.sh
#
# Downloads WordPress core + creates a test database, then writes a
# wp-tests-config.php that the wp-phpunit bootstrap can pick up.
#
# Usage:
#   install-wp-tests.sh <db-name> <db-user> <db-pass> [db-host] [wp-version]
#
# Env:
#   WP_TESTS_DIR — override where core is unpacked (default /tmp/wordpress).

set -euo pipefail

DB_NAME="${1:?db name required}"
DB_USER="${2:?db user required}"
DB_PASS="${3:?db pass required}"
DB_HOST="${4:-127.0.0.1:3306}"
WP_VERSION="${5:-latest}"

WP_CORE_DIR="${WP_CORE_DIR:-/tmp/wordpress}"
TMP="${TMPDIR:-/tmp}"

download() {
	local src="$1" dest="$2"
	if command -v curl >/dev/null 2>&1; then
		curl -fSL -o "$dest" "$src"
	else
		wget -q -O "$dest" "$src"
	fi
}

install_wp() {
	if [ -d "$WP_CORE_DIR" ] && [ -f "$WP_CORE_DIR/wp-settings.php" ]; then
		echo "-- WP core already at $WP_CORE_DIR"
		return
	fi
	mkdir -p "$WP_CORE_DIR"

	if [ "$WP_VERSION" = "latest" ]; then
		local archive_url="https://wordpress.org/latest.tar.gz"
	else
		local archive_url="https://wordpress.org/wordpress-${WP_VERSION}.tar.gz"
	fi

	echo "-- downloading $archive_url"
	download "$archive_url" "$TMP/wordpress.tar.gz"
	tar --strip-components=1 -xzf "$TMP/wordpress.tar.gz" -C "$WP_CORE_DIR"

	download \
		"https://raw.githubusercontent.com/markoheijnen/wp-mysqli/master/db.php" \
		"$WP_CORE_DIR/wp-content/db.php" 2>/dev/null || true
}

install_db() {
	echo "-- creating database $DB_NAME on $DB_HOST"
	local host port
	if [[ "$DB_HOST" == *:* ]]; then
		host="${DB_HOST%%:*}"
		port="${DB_HOST##*:}"
	else
		host="$DB_HOST"
		port=3306
	fi
	mysqladmin --host="$host" --port="$port" --user="$DB_USER" --password="$DB_PASS" -f drop "$DB_NAME" >/dev/null 2>&1 || true
	mysqladmin --host="$host" --port="$port" --user="$DB_USER" --password="$DB_PASS" create "$DB_NAME"
}

write_config() {
	local cfg
	cfg="$(dirname "$WP_CORE_DIR")/wp-tests-config.php"
	cat >"$cfg" <<PHP
<?php
define( 'ABSPATH', '$WP_CORE_DIR/' );
define( 'WP_DEBUG', true );
define( 'DB_NAME', '$DB_NAME' );
define( 'DB_USER', '$DB_USER' );
define( 'DB_PASSWORD', '$DB_PASS' );
define( 'DB_HOST', '$DB_HOST' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );
\$table_prefix  = 'wptests_';
define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
PHP
	echo "WP_PHPUNIT__TESTS_CONFIG=$cfg" >>"${GITHUB_ENV:-/dev/null}"
	export WP_PHPUNIT__TESTS_CONFIG="$cfg"
	echo "-- wrote $cfg"
}

install_wp
install_db
write_config
