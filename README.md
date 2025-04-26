# 3suite-asset-cache

asset-cache works as a proxy to transform HTTP-based APIs that respond with files or base64 assets to ones that respond with links.

asset-cache saves files to a directory and returns a link with the filename, however some other service is required to serve the files. see [http-server](https://github.com/3sig/3suite-http-server)

## usage

most settings should be self-evident from `config.toml`. for advanced configuration information, see [3lib-config](https://github.com/3sig/3lib-config)

asset-cache additionally allows you to specify the file path for a given request via
the `3suite-filepath` header.

### macOS builds

we currently do not support notarization for macOS builds.
to run mac builds, flag them as safe for gatekeeper with the following command:

`xattr -c <path_to_mac_executable>`
