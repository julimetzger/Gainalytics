import createAppStore from '../../configureStore';

// RTK 2: `configureStore({middleware})` only accepts a callback. The plain array the store used
// with RTK 1 throws outside production and is silently replaced by the default middleware in a
// release build, so the Health Connect middleware never saw an action.

const mockSeenActionTypes: string[] = [];

jest.mock('../../app/redux/HealthConnect/healthConnectMiddleware', () => ({
  healthConnectMiddleware: () => (next: (action: unknown) => unknown) => (action: {type: string}) => {
    mockSeenActionTypes.push(action.type);
    return next(action);
  },
}));

describe('configureStore (RTK 2)', () => {
  it('creates the store and routes every dispatched action through the Health Connect middleware', () => {
    const {store} = createAppStore();

    store.dispatch({type: 'HEALTH_CONNECT_REFRESH', force: true});

    expect(mockSeenActionTypes).toEqual(expect.arrayContaining(['persist/PERSIST', 'HEALTH_CONNECT_REFRESH']));
  });
});
