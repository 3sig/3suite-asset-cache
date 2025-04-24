# 3suite-asset-cache

asset-cache works as a proxy to transform HTTP-based APIs that respond with files or base64 assets to ones that respond with links.

asset-cache saves files to a directory and returns a link with the filename, however some other service is required to serve the files. see [asset-cache](https://github.com/3sig/3suite-http-server)

## usage

### creating a new project

fork the repository--any changes that we make to the build workflows should be merged upstream to this template.

enable workflows in github so that the build workflows can run.

### creating a release

ensure that you are in a fully committed state before creating a tag.
you likely want to download and check the related build before tagging.

create a tag:

`git tag -a v1.0.0 -m "release v1.0.0"`

the message inside of the quotes will be the release message.
the version number will be appended to the output build files.

push the tag:

`git push origin tag v1.0.0`

you DEFINITELY don't want to run `git push --tags` because it will trigger releases for tags across the history.

### macOS builds

we currently do not support notarization for macOS builds.
to run mac builds, flag them as safe for gatekeeper with the following command:

`xattr -c <path_to_mac_executable>`
