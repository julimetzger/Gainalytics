import {canReadBodyWeight, canReadSleep, canReadSteps, canWriteTrainings, describeHealthConnectConnection} from '../../../app/utils/healthConnect/healthConnectStatus';
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
      granted: ['android.permission.health.READ_HEART_RATE', HC_PERMISSION.READ_WEIGHT, HC_PERMISSION.READ_HISTORY],
      historyReadAvailable: true,
    };
    const connection = describeHealthConnectConnection({status, everConnected: true});

    expect(connection).toEqual({
      kind: 'connected',
      granted: [HC_PERMISSION.READ_WEIGHT, HC_PERMISSION.READ_HISTORY],
      missing: [HC_PERMISSION.READ_EXERCISE, HC_PERMISSION.WRITE_EXERCISE, HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS],
    });
    expect([canWriteTrainings(connection), canReadBodyWeight(connection), canReadSleep(connection), canReadSteps(connection)]).toEqual([false, true, false, false]);
  });

  it('GH-619: sleep and steps are granted and revoked one by one', () => {
    const connectionWith = (granted: string[]) =>
      describeHealthConnectConnection({status: {sdkStatus: 'AVAILABLE', providedBySystem: true, granted, historyReadAvailable: true}, everConnected: true});

    expect(
      [[HC_PERMISSION.READ_SLEEP], [HC_PERMISSION.READ_STEPS], [HC_PERMISSION.READ_SLEEP, HC_PERMISSION.READ_STEPS]].map((granted) => {
        const connection = connectionWith(granted);
        return [canReadSleep(connection), canReadSteps(connection)];
      }),
    ).toEqual([
      [true, false],
      [false, true],
      [true, true],
    ]);
  });
});
