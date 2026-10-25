import {canReadBodyWeight, canWriteTrainings, describeHealthConnectConnection} from '../../../app/utils/healthConnect/healthConnectStatus';
import {HC_PERMISSION} from '../../../app/utils/healthConnect/healthConnectNative';

describe('GH-528 describeHealthConnectConnection', () => {
  it('tells every provider state apart', () => {
    expect(
      [
        undefined,
        {sdkStatus: 'NOT_SUPPORTED' as const},
        {sdkStatus: 'UNAVAILABLE' as const, providedBySystem: false},
        {sdkStatus: 'UNAVAILABLE' as const, providedBySystem: true},
        {sdkStatus: 'PROVIDER_UPDATE_REQUIRED' as const, providedBySystem: false},
      ].map((status) => describeHealthConnectConnection({status, everConnected: false})),
    ).toEqual([{kind: 'checking'}, {kind: 'not_supported'}, {kind: 'not_installed'}, {kind: 'unavailable'}, {kind: 'update_required'}]);
  });

  it('distinguishes never connected from revoked permissions', () => {
    const status = {sdkStatus: 'AVAILABLE' as const, providedBySystem: true, granted: [], historyReadAvailable: true};

    expect(describeHealthConnectConnection({status, everConnected: false})).toEqual({kind: 'not_connected'});
    expect(describeHealthConnectConnection({status, everConnected: true})).toEqual({kind: 'revoked'});
  });

  it('lists granted and missing permissions and ignores unrelated ones', () => {
    const status = {
      sdkStatus: 'AVAILABLE' as const,
      providedBySystem: true,
      granted: ['android.permission.health.READ_STEPS', HC_PERMISSION.READ_WEIGHT, HC_PERMISSION.READ_HISTORY],
      historyReadAvailable: true,
    };
    const connection = describeHealthConnectConnection({status, everConnected: true});

    expect(connection).toEqual({kind: 'connected', granted: [HC_PERMISSION.READ_WEIGHT, HC_PERMISSION.READ_HISTORY], missing: [HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE]});
    expect([canWriteTrainings(connection), canReadBodyWeight(connection)]).toEqual([false, true]);
  });
});
