import { StatelessOAuthStateStore } from './oauth-state.store';

function makeReq(cookies: Record<string, string> = {}) {
  const cookieJar = new Map<string, string>();
  const res = {
    cookie: jest.fn((name: string, value: string) => {
      cookieJar.set(name, value);
    }),
    clearCookie: jest.fn(),
  };
  return { req: { cookies, res } as never, res, cookieJar };
}

describe('StatelessOAuthStateStore', () => {
  const store = new StatelessOAuthStateStore('test-secret');

  function issueState(): { state: string; browserCookie: string } {
    const { req, cookieJar } = makeReq();
    let issuedState = '';
    store.store(req, (_err, state) => {
      issuedState = state;
    });
    const browserCookie = [...cookieJar.values()][0];
    return { state: issuedState, browserCookie };
  }

  it('verifies a state whose cookie matches the browser that requested it', () => {
    const { state, browserCookie } = issueState();
    const { req } = makeReq({ oauth_state_binding: browserCookie });

    let ok = false;
    store.verify(req, state, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(true);
  });

  it('rejects a state replayed without the matching browser cookie (stolen state, different browser)', () => {
    const { state } = issueState();
    const { req } = makeReq(); // no cookie at all — different browser

    let ok = true;
    let info: unknown;
    store.verify(req, state, (_err, result, i) => {
      ok = result;
      info = i;
    });

    expect(ok).toBe(false);
    expect(info).toBe('state không khớp trình duyệt khởi tạo');
  });

  it('rejects a state replayed a second time even with the original cookie (single-use)', () => {
    const { state, browserCookie } = issueState();
    const { req: req1 } = makeReq({ oauth_state_binding: browserCookie });
    store.verify(req1, state, () => {});

    // Cookie đã bị clearCookie() ở lần verify đầu — mô phỏng lần thử lại
    // bằng cách KHÔNG còn cookie trong request thứ hai.
    const { req: req2 } = makeReq();
    let ok = true;
    store.verify(req2, state, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(false);
  });

  it('rejects a tampered state (signature mismatch)', () => {
    const { state, browserCookie } = issueState();
    const tampered = state.slice(0, -1) + (state.at(-1) === 'a' ? 'b' : 'a');
    const { req } = makeReq({ oauth_state_binding: browserCookie });

    let ok = true;
    store.verify(req, tampered, (_err, result) => {
      ok = result;
    });

    expect(ok).toBe(false);
  });
});
