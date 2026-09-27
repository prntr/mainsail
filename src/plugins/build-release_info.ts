import fs from 'fs'
import path from 'path'
import { version } from '../../package.json'
import { PluginOption } from 'vite'

/**
 * Custom build plugin to write the version in a dedicated release_info.json file after bundling
 *
 * Moonraker's update_manager reads project_owner and version from this file. A fork build
 * sets MAINSAIL_RELEASE_OWNER and MAINSAIL_RELEASE_VERSION so Moonraker tracks the fork's
 * releases instead of falling back to upstream mainsail-crew.
 */

export default function buildReleaseInfo(): PluginOption {
    return {
        name: 'build-release_info',
        writeBundle: () => {
            setImmediate(async () => {
                const owner = process.env.MAINSAIL_RELEASE_OWNER || 'mainsail-crew'
                const releaseVersion = process.env.MAINSAIL_RELEASE_VERSION || `v${version.toString()}`
                const releaseInfoFile = await fs.promises.open(
                    path.resolve(__dirname, '../../dist/release_info.json'),
                    'w'
                )
                await releaseInfoFile.writeFile(
                    JSON.stringify({
                        project_name: 'mainsail',
                        project_owner: owner,
                        version: releaseVersion,
                    })
                )
                await releaseInfoFile.close()
            })
        },
    }
}
