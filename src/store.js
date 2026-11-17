import pg from 'pg';

const { Pool } = pg;

export class Store {
  constructor(connectionString, { pool } = {}) {
    this.pool = pool || new Pool({ connectionString, max: 5 });
  }

  async migrate(sql) {
    await this.pool.query(sql);
  }

  async health() {
    await this.pool.query('SELECT 1');
  }

  async getState() {
    const result = await this.pool.query(
      'SELECT config, version, updated_at FROM overlay_state WHERE singleton = true',
    );
    return result.rows[0] || null;
  }

  async replaceConfig(config) {
    const result = await this.pool.query(
      `INSERT INTO overlay_state (singleton, config, version)
       VALUES (true, $1::jsonb, 1)
       ON CONFLICT (singleton) DO UPDATE
       SET config = EXCLUDED.config,
           version = overlay_state.version + 1,
           updated_at = now()
       RETURNING config, version, updated_at`,
      [JSON.stringify(config)],
    );
    return result.rows[0];
  }

  async replaceSection(section, value) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT config FROM overlay_state WHERE singleton = true FOR UPDATE',
      );
      if (!current.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const config = current.rows[0].config;
      config[section] = value;
      const updated = await client.query(
        `UPDATE overlay_state
         SET config = $1::jsonb, version = version + 1, updated_at = now()
         WHERE singleton = true
         RETURNING config, version, updated_at`,
        [JSON.stringify(config)],
      );
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /* Modifie UNE roue de sportsCustom, de facon atomique : verrou de ligne, controle de version
     (expectedVersion = version de la config lue par l'appelant) et trace dans wheel_history.
     fn(avant) rend la nouvelle valeur, ou null pour supprimer. */
  async mutateWheel(wheelId, fn, { expectedVersion, action = 'put', actor = 'wheels-token' } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT config, version FROM overlay_state WHERE singleton = true FOR UPDATE');
      const row = current.rows[0];
      if (!row) { await client.query('ROLLBACK'); return { error: 'empty' }; }
      if (expectedVersion != null && Number(expectedVersion) !== Number(row.version)) {
        await client.query('ROLLBACK');
        return { error: 'conflict', version: row.version };
      }
      const config = row.config;
      const sports = { ...(config.sportsCustom || {}) };
      const before = sports[wheelId] ?? null;
      const after = fn(before);
      if (after === null) delete sports[wheelId]; else sports[wheelId] = after;
      config.sportsCustom = sports;
      const updated = await client.query(
        `UPDATE overlay_state SET config = $1::jsonb, version = version + 1, updated_at = now()
         WHERE singleton = true RETURNING config, version, updated_at`,
        [JSON.stringify(config)],
      );
      await client.query(
        'INSERT INTO wheel_history (wheel_id, action, before, after, config_version, actor) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)',
        [wheelId, action, JSON.stringify(before), JSON.stringify(after), updated.rows[0].version, actor],
      );
      await client.query('COMMIT');
      return { state: updated.rows[0], before, after };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async wheelHistory(wheelId, limit = 20) {
    const result = await this.pool.query(
      'SELECT id, wheel_id, action, config_version, actor, created_at, (before IS NOT NULL) AS had_before FROM wheel_history WHERE wheel_id = $1 ORDER BY id DESC LIMIT $2',
      [wheelId, limit],
    );
    return result.rows;
  }

  async wheelHistoryEntry(wheelId, id) {
    const result = await this.pool.query('SELECT * FROM wheel_history WHERE wheel_id = $1 AND id = $2', [wheelId, id]);
    return result.rows[0] || null;
  }

  async getWhatnotState() {
    const result = await this.pool.query(
      'SELECT state, updated_at FROM whatnot_sync WHERE singleton = true',
    );
    return result.rows[0] || null;
  }

  async putWhatnotState(state) {
    const result = await this.pool.query(
      `INSERT INTO whatnot_sync (singleton, state)
       VALUES (true, $1::jsonb)
       ON CONFLICT (singleton) DO UPDATE
       SET state = EXCLUDED.state, updated_at = now()
       RETURNING state, updated_at`,
      [JSON.stringify(state)],
    );
    return result.rows[0];
  }

  async listMedia(slot) {
    const result = await this.pool.query(
      `SELECT id, name AS nom, content_type AS type, byte_size AS octets,
              created_at AS cree, sha256
       FROM overlay_media WHERE slot = $1 ORDER BY created_at DESC`,
      [slot],
    );
    return result.rows;
  }

  async getMedia(slot, id) {
    const result = await this.pool.query(
      'SELECT * FROM overlay_media WHERE slot = $1 AND id = $2',
      [slot, id],
    );
    return result.rows[0] || null;
  }

  async putMedia(media) {
    await this.pool.query(
      `INSERT INTO overlay_media
         (slot, id, name, content_type, byte_size, sha256, object_key, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slot, id) DO UPDATE SET
         name = EXCLUDED.name, content_type = EXCLUDED.content_type,
         byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256,
         object_key = EXCLUDED.object_key, created_at = EXCLUDED.created_at`,
      [media.slot, media.id, media.name, media.contentType, media.byteSize,
        media.sha256, media.objectKey, media.createdAt],
    );
  }

  async deleteMedia(slot, id) {
    await this.pool.query('DELETE FROM overlay_media WHERE slot = $1 AND id = $2', [slot, id]);
  }

  async close() {
    await this.pool.end();
  }
}
