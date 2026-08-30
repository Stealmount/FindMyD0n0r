// e-RaktKosh Sync Engine Unit & Integration Tests
import './setup-env';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { syncBloodBanks, syncCamps, getLastSyncLog } from '../services/eraktkoshSyncService';
import { ALL_INDIA_SEED_BLOOD_BANKS, ALL_INDIA_SEED_CAMPS, INDIAN_STATES_AND_UT } from '../../src/data/allIndiaBloodBankSeed';

describe('e-RaktKosh Sync Engine & Master Seed Tests', () => {
  test('ALL_INDIA_SEED_BLOOD_BANKS provides nationwide coverage', () => {
    assert.ok(ALL_INDIA_SEED_BLOOD_BANKS.length >= 8, 'Master seed must contain multi-state blood bank records');
    assert.ok(INDIAN_STATES_AND_UT.includes('Delhi'), 'Delhi must be in states list');
    assert.ok(INDIAN_STATES_AND_UT.includes('Maharashtra'), 'Maharashtra must be in states list');
    assert.ok(INDIAN_STATES_AND_UT.includes('Tamil Nadu'), 'Tamil Nadu must be in states list');
  });

  test('syncBloodBanks executes normalization, deduplication, and logging', async () => {
    const result = await syncBloodBanks();
    assert.equal(result.sync_type, 'blood_banks');
    assert.ok(result.records_fetched > 0, 'Fetched records count should be > 0');
    assert.ok(result.records_added > 0 || result.records_updated > 0, 'Should add or update records');
    assert.ok(result.duration_ms >= 0, 'Duration should be recorded');

    const lastLog = await getLastSyncLog() as any;
    assert.ok(lastLog, 'Last sync log should be saved in cache');
    assert.equal(lastLog.sync_type, 'blood_banks');
  });

  test('syncCamps executes camp normalization and logging', async () => {
    const result = await syncCamps();
    assert.equal(result.sync_type, 'camps');
    assert.ok(result.records_fetched > 0, 'Fetched camp records count should be > 0');
    assert.ok(result.records_added > 0 || result.records_updated > 0, 'Should add or update camp records');
  });
});
