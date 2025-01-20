import type { Installation, InstallationQuery } from '@slack/bolt'
import { Database } from 'bun:sqlite'
import { logger } from '../utils/logger'

type InstallationRow = {
  id: string
  type: 'enterprise' | 'team'
  data: string
}

export const installationDb = new Database('installations.sqlite')

installationDb.exec(`
  CREATE TABLE IF NOT EXISTS installations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL
  )
`)

export const installationStore = {
  storeInstallation: async (installation: Installation) => {
    try {
      if (
        installation.isEnterpriseInstall &&
        installation.enterprise !== undefined
      ) {
        const query = `INSERT OR REPLACE INTO installations (id, type, data) VALUES (?, ?, ?)`
        installationDb.run(query, [
          installation.enterprise.id,
          'enterprise',
          JSON.stringify(installation),
        ])
        return
      }

      if (installation.team !== undefined) {
        const query = `INSERT OR REPLACE INTO installations (id, type, data) VALUES (?, ?, ?)`
        installationDb.run(query, [
          installation.team.id,
          'team',
          JSON.stringify(installation),
        ])
        return
      }

      throw new Error('Failed saving installation data to database')
    } catch (error) {
      logger.error('Error storing installation:', error)
      throw error
    }
  },

  fetchInstallation: async (
    installQuery: InstallationQuery<boolean>,
  ): Promise<Installation> => {
    try {
      if (
        installQuery.isEnterpriseInstall &&
        installQuery.enterpriseId !== undefined
      ) {
        const query = `SELECT data FROM installations WHERE id = ? AND type = 'enterprise'`
        const result = installationDb
          .query(query)
          .get(installQuery.enterpriseId) as InstallationRow | undefined

        if (!result) throw new Error('Enterprise installation not found')
        return JSON.parse(result.data) as Installation
      }

      if (installQuery.teamId !== undefined) {
        const query = `SELECT data FROM installations WHERE id = ? AND type = 'team'`
        const result = installationDb.query(query).get(installQuery.teamId) as
          | InstallationRow
          | undefined

        if (!result) throw new Error('Team installation not found')
        return JSON.parse(result.data) as Installation
      }

      throw new Error('Failed fetching installation')
    } catch (error) {
      logger.error('Error fetching installation:', error)
      throw error
    }
  },

  deleteInstallation: async (
    installQuery: InstallationQuery<boolean>,
  ): Promise<void> => {
    try {
      if (
        installQuery.isEnterpriseInstall &&
        installQuery.enterpriseId !== undefined
      ) {
        const query = `DELETE FROM installations WHERE id = ? AND type = 'enterprise'`
        installationDb.run(query, [installQuery.enterpriseId])
        return
      }

      if (installQuery.teamId !== undefined) {
        const query = `DELETE FROM installations WHERE id = ? AND type = 'team'`
        installationDb.run(query, [installQuery.teamId])
        return
      }

      throw new Error('Failed to delete installation')
    } catch (error) {
      logger.error('Error deleting installation:', error)
      throw error
    }
  },
}
