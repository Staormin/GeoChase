import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const modelResponse = (output: unknown[]) => ({ status: 'completed', output });
function call(name: string, args: unknown, id = name) {
  return {
    type: 'function_call',
    call_id: id,
    name,
    arguments: JSON.stringify(args),
  };
}
function text(value: string) {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: value }],
  };
}

test('creates real map elements, persists, undoes and redoes the complete request', async ({
  page,
  blankProject,
}) => {
  await page.route('https://geo.api.gouv.fr/communes?**', (route) => route.fulfill({ json: [] }));
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  await page.route('https://data.geopf.fr/geocodage/completion?**', (route) =>
    route.fulfill({
      json: {
        results: [
          { fulltext: 'Fontainebleau', x: 2.7, y: 48.4 },
          { fulltext: 'Bourges', x: 2.4, y: 47.1 },
        ],
      },
    })
  );
  const requests: Record<string, unknown>[] = [];
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', (route) => {
    requests.push(route.request().postDataJSON());
    turn++;
    const output =
      turn === 1
        ? [call('search_places', { query: 'Fontainebleau et Bourges' })]
        : turn === 2
          ? [
              call('create_points', {
                points: [
                  { location_id: 'place-1', name: 'Fontainebleau', source_urls: [] },
                  { location_id: 'place-2', name: 'Bourges', source_urls: [] },
                ],
              }),
            ]
          : [text('Fontainebleau and Bourges are ready.')];
    return route.fulfill({ json: modelResponse(output) });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-settings-done')).toBeVisible();
  await page.getByTestId('assistant-effort').click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.getByTestId('assistant-settings-done').click();
  await expect(page.getByTestId('assistant-model')).not.toBeVisible();
  await page.evaluate(() => {
    const animations: Animation[] = [];
    Reflect.set(window, 'qaPointAnimations', animations);
    Element.prototype.animate = new Proxy(Element.prototype.animate, {
      apply(animate, element: Element, args) {
        const animation = Reflect.apply(animate, element, args) as Animation;
        if (element.classList.contains('point-arrival')) {
          animation.pause();
          animations.push(animation);
        }
        return animation;
      },
    });
  });
  await page.getByTestId('assistant-prompt').fill('Place Fontainebleau and Bourges.');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-result')).toHaveText('2 element(s) added to the map');
  await expect(page.locator('.point-arrival')).toHaveCount(2);
  const drop = await page.evaluate(async () => {
    const animations = Reflect.get(window, 'qaPointAnimations') as Animation[];
    await Promise.all(animations.map((animation) => animation.ready));
    for (const animation of animations) animation.currentTime = 430;
    await new Promise(requestAnimationFrame);
    return (Reflect.get(window, 'qaPointAnimations') as Animation[])
      .map((animation) => (animation.effect as KeyframeEffect).target!)
      .map((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        y: new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
      }));
  });
  expect(drop[0]!.opacity).toBe(1);
  expect(drop[0]!.y).toBeLessThan(0);
  expect(drop[1]!.opacity).toBe(0);
  await page.screenshot({ path: '/tmp/geochase-ai-arrival-drop.png' });
  const rebound = await page.evaluate(async () => {
    for (const animation of Reflect.get(window, 'qaPointAnimations') as Animation[])
      animation.currentTime = 606;
    await new Promise(requestAnimationFrame);
    return (Reflect.get(window, 'qaPointAnimations') as Animation[])
      .map((animation) => (animation.effect as KeyframeEffect).target!)
      .map((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        y: new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
      }));
  });
  expect(rebound[0]!.y).toBeCloseTo(-8, 0);
  expect(rebound[1]!.opacity).toBe(1);
  await page.screenshot({ path: '/tmp/geochase-ai-arrival-bounce.png' });
  await expect(page.getByTestId('layers-sidebar')).toContainText('Fontainebleau');
  await expect(page.getByTestId('layers-sidebar')).toContainText('Bourges');
  const count = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.points.length
    );
  await expect.poll(count).toBe(5);
  expect(requests[0]).toMatchObject({ store: false, reasoning: { effort: 'high' } });
  expect(await page.evaluate(() => localStorage.getItem('geochase_assistant_key'))).toBeNull();
  await page
    .getByTestId('assistant-panel')
    .getByRole('button', { name: 'Undo', exact: true })
    .click();
  await expect(page.locator('.point-arrival')).toHaveCount(0);
  await expect.poll(count).toBe(3);
  await page.getByTestId('redo-btn').click();
  await expect.poll(count).toBe(5);
  await page.reload();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Fontainebleau');
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-key').locator('input')).toHaveValue('');
});

test('stopping a request discards prepared mutations', async ({ page, blankProject }) => {
  await page.route('https://geo.api.gouv.fr/communes?**', (route) => route.fulfill({ json: [] }));
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-4.1-mini' }] } })
  );
  await page.route('https://data.geopf.fr/geocodage/completion?**', (route) =>
    route.fulfill({ json: { results: [{ fulltext: 'Fontainebleau', x: 2.7, y: 48.4 }] } })
  );
  let calls = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    calls++;
    if (calls === 3) await held;
    const output =
      calls === 1
        ? [call('search_places', { query: 'Fontainebleau' })]
        : calls === 2
          ? [
              call('create_points', {
                points: [{ location_id: 'place-1', name: 'Fontainebleau', source_urls: [] }],
              }),
            ]
          : [text('Done')];
    await route.fulfill({ json: modelResponse(output) }).catch(() => {});
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-settings-done')).toBeVisible();
  await page.getByTestId('assistant-settings-done').click();
  await page.getByTestId('assistant-prompt').fill('Place Fontainebleau');
  await page.getByTestId('assistant-send').click();
  await expect.poll(() => calls).toBe(3);
  await page.getByTestId('assistant-stop').click();
  release();
  await expect(page.locator('.assistant-stopped')).toContainText('No elements');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.points.length
    )
  ).toBe(3);
  await expect(page.getByTestId('layers-sidebar')).not.toContainText('Fontainebleau');
});

test('remembers a key only when selected and lets the user erase it', async ({
  page,
  blankProject,
}) => {
  await page.route('https://api.anthropic.com/v1/models?**', (route) =>
    route.fulfill({ json: { data: [{ id: 'claude-sonnet-4-6' }], has_more: false } })
  );
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-ant-e2e-fake');
  await expect(page.getByTestId('assistant-provider')).toContainText('Anthropic');
  await page.getByRole('checkbox', { name: 'Remember the key on this device' }).check();
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-settings-done')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('geochase_assistant_key'))).toBe(
    'sk-ant-e2e-fake'
  );
  await page.reload();
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-prompt')).toBeVisible();
  await expect(page.getByTestId('assistant-model')).not.toBeVisible();
  await page.getByRole('button', { name: 'Assistant settings' }).click();
  await page.getByRole('button', { name: 'Forget key', exact: true }).click();
  await expect(page.getByTestId('assistant-key').locator('input')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('geochase_assistant_key'))).toBeNull();
});

test('invalid credentials display a safe error without sending a conversation', async ({
  page,
  blankProject,
}) => {
  await page.route('https://geo.api.gouv.fr/communes?**', (route) => route.fulfill({ json: [] }));
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ status: 401, json: { error: { message: 'secret echoed by server' } } })
  );
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-error')).toContainText('Key rejected');
  await expect(page.getByTestId('assistant-error')).not.toContainText('secret');
  await expect(page.getByTestId('assistant-send')).not.toBeVisible();
});

for (const provider of ['anthropic', 'gemini'] as const) {
  test(`${provider}: routes tool results through the real application`, async ({
    page,
    blankProject,
  }) => {
    await page.route('https://geo.api.gouv.fr/communes?**', (route) => route.fulfill({ json: [] }));
    await page.route('https://data.geopf.fr/geocodage/completion?**', (route) =>
      route.fulfill({ json: { results: [{ fulltext: 'Fontainebleau', x: 2.7, y: 48.4 }] } })
    );
    await (provider === 'anthropic'
      ? page.route('https://api.anthropic.com/v1/models?**', (route) =>
          route.fulfill({ json: { data: [{ id: 'claude-sonnet-4-6' }] } })
        )
      : page.route('https://generativelanguage.googleapis.com/v1beta/models?**', (route) =>
          route.fulfill({
            json: {
              models: [
                {
                  name: 'models/gemini-2.5-flash',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            },
          })
        ));
    let count = 0;
    const requests: Record<string, unknown>[] = [];
    const endpoint =
      provider === 'anthropic'
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';
    await page.route(endpoint, (route) => {
      count++;
      requests.push(route.request().postDataJSON());
      const name = count === 1 ? 'search_places' : 'create_points';
      const args =
        count === 1
          ? { query: 'Fontainebleau' }
          : { points: [{ location_id: 'place-1', name: 'Fontainebleau', source_urls: [] }] };
      const content =
        count < 3
          ? [{ type: 'tool_use', id: `call${count}`, name, input: args }]
          : [{ type: 'text', text: 'Ready.' }];
      const parts =
        count < 3
          ? [{ functionCall: { name, args }, thoughtSignature: 'opaque-signature' }]
          : [{ text: 'Ready.' }];
      return route.fulfill({
        json:
          provider === 'anthropic'
            ? { content, stop_reason: count < 3 ? 'tool_use' : 'end_turn' }
            : { candidates: [{ content: { parts }, finishReason: 'STOP' }] },
      });
    });
    await page.getByTestId('assistant-toggle').click();
    await page
      .getByTestId('assistant-key')
      .locator('input')
      .fill(provider === 'anthropic' ? 'sk-ant-e2e-fake' : 'AIza-e2e-fake');
    await page.getByTestId('assistant-connect').click();
    await expect(page.getByTestId('assistant-settings-done')).toBeVisible();
    await page.getByTestId('assistant-settings-done').click();
    await page.getByTestId('assistant-prompt').fill('Place Fontainebleau');
    await page.getByTestId('assistant-send').click();
    await expect(page.locator('.assistant-result')).toContainText('1 element');
    await expect(page.getByTestId('layers-sidebar')).toContainText('Fontainebleau');
    await expect(page.locator('.point-arrival')).toHaveCount(0);
    expect(count).toBe(3);
    expect(JSON.stringify(requests[1])).toContain(
      provider === 'gemini' ? 'opaque-signature' : 'tool_result'
    );
  });
}

test('research citations survive as point notes, and source text is inert', async ({
  page,
  blankProject,
}) => {
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  await page.route('https://geo.api.gouv.fr/communes?**', (route) => route.fulfill({ json: [] }));
  await page.route('https://data.geopf.fr/geocodage/completion?**', (route) =>
    route.fulfill({
      json: { results: [{ fulltext: 'Basilique de Saint-Denis', x: 2.359, y: 48.935 }] },
    })
  );
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', (route) => {
    const request = route.request().postDataJSON();
    if (request.tools[0].type === 'web_search')
      return route.fulfill({
        json: modelResponse([
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'The tomb is in the basilica.',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.org/history',
                    title: '<img src=x onerror=alert(1)>',
                  },
                ],
              },
            ],
          },
        ]),
      });
    turn++;
    const output =
      turn === 1
        ? [call('research_places', { query: 'Du Guesclin burial sites' })]
        : turn === 2
          ? [call('search_places', { query: 'Basilique de Saint-Denis' })]
          : turn === 3
            ? [
                call('create_points', {
                  points: [
                    {
                      location_id: 'place-1',
                      name: 'Du Guesclin',
                      source_urls: ['https://example.org/history'],
                    },
                  ],
                }),
              ]
            : [text('Prepared with a source.')];
    return route.fulfill({ json: modelResponse(output) });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-settings-done')).toBeVisible();
  await page.getByTestId('assistant-settings-done').click();
  await page.getByTestId('assistant-prompt').fill('Place the burial site of Du Guesclin');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-result')).toContainText('1 element');
  await expect(page.locator('.assistant-sources a')).toHaveAttribute(
    'href',
    'https://example.org/history'
  );
  expect(await page.locator('.assistant-sources img').count()).toBe(0);
  const data = await page.evaluate(
    () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data
  );
  expect(data.notes[0].content).toContain('https://example.org/history');
  expect(data.points.at(-1).noteId).toBe(data.notes[0].id);
});

test('refreshes the API catalogue, searches models and uses the selected model', async ({
  page,
  blankProject,
}) => {
  let catalogue = [
    { id: 'gpt-5-mini' },
    { id: 'o4-mini', shutdown_date: '2000-01-01' },
    { id: 'gpt-4o', created: 20 },
    { id: 'gpt-7-mini', created: 30 },
  ];
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: catalogue } })
  );
  let selectedModel = '';
  await page.route('https://api.openai.com/v1/responses', (route) => {
    selectedModel = route.request().postDataJSON().model;
    return route.fulfill({ json: modelResponse([text('Ready.')]) });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await expect(page.getByTestId('assistant-settings-done')).toBeEnabled();
  const picker = page.getByTestId('assistant-model').locator('input[type="text"]');
  await picker.fill('o4-mini');
  await expect(page.getByRole('option', { name: 'o4-mini', exact: true })).toHaveCount(0);
  await picker.fill('gpt-4o');
  await page.getByRole('option', { name: 'gpt-4o', exact: true }).click();
  // Refresh reflects the API changing, replacing a previously selected retired model.
  catalogue = [
    { id: 'gpt-4o', shutdown_date: '2000-01-01' },
    { id: 'gpt-8-mini', created: 40 },
  ];
  await page.getByTestId('assistant-connect').click();
  await expect(picker).toHaveValue('gpt-8-mini');
  await page.getByTestId('assistant-settings-done').click();
  await page.getByTestId('assistant-prompt').fill('Hello');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-message.assistant')).toContainText('Ready.');
  expect(selectedModel).toBe('gpt-8-mini');
  expect(blankProject).toBeTruthy();
});

test('places thirds and midpoints on an existing line with links, undo and persistence', async ({
  page,
  blankProject,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('line-seeded')) return;
    sessionStorage.setItem('line-seeded', '1');
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].data.lineSegments = [
      {
        id: 'line-ab',
        name: 'AB',
        mode: 'coordinate',
        center: { lat: 60, lon: 0 },
        endpoint: { lat: 60, lon: 9 },
      },
    ];
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect(page.getByTestId('layers-sidebar')).toContainText('AB');
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', (route) => {
    turn++;
    return route.fulfill({
      json: modelResponse(
        turn === 1
          ? [
              call(
                'create_point_on_line',
                {
                  line_id: 'line-ab',
                  name: 'Third',
                  position: 1 / 3,
                  unit: 'fraction',
                  from_end: false,
                },
                'third'
              ),
              call(
                'create_point_on_line',
                {
                  line_id: 'line-ab',
                  name: 'Middle',
                  position: 0.5,
                  unit: 'fraction',
                  from_end: false,
                },
                'middle'
              ),
            ]
          : [text('Two points placed on AB.')]
      ),
    });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await page.getByTestId('assistant-settings-done').click();
  await page.getByTestId('assistant-prompt').fill('Place un point au tiers et un au milieu de AB.');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-result')).toContainText('2 element(s)');
  const read = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data);
  const data = await read();
  for (const [name, lon] of [
    ['Third', 3],
    ['Middle', 4.5],
  ] as const) {
    const p = data.points.find((p: { name: string }) => p.name === name);
    expect(p.coordinates.lon).toBeCloseTo(lon, 8);
    expect(p.coordinates.lat).toBeCloseTo(60, 8);
    expect(p.lineId).toBe('line-ab');
    expect(p.construction.lineId).toBe('line-ab');
    expect(data.lineSegments[0].pointsOnLine).toContain(p.id);
    await expect(page.getByTestId('layers-sidebar')).toContainText(name);
  }
  await page
    .locator('.assistant-conversation-actions')
    .getByRole('button', { name: 'Undo' })
    .click();
  await expect.poll(async () => (await read()).points.length).toBe(blankProject.data.points.length);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await read()).points.length).toBe(data.points.length);
  await page.reload();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Middle');
  expect((await read()).lineSegments[0].pointsOnLine).toHaveLength(2);
});

async function setupAssistantConstructions(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('construction-seeded')) return;
    sessionStorage.setItem('construction-seeded', '1');
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].data.lineSegments = [
      {
        id: 'ab',
        name: 'AB',
        mode: 'coordinate',
        center: { lat: 48, lon: 2 },
        endpoint: { lat: 48, lon: 8 },
      },
      {
        id: 'cd',
        name: 'CD',
        mode: 'coordinate',
        center: { lat: 46, lon: 5 },
        endpoint: { lat: 50, lon: 5 },
      },
    ];
    projects[0].data.circles = [
      { id: 'circle-c', name: 'Circle C', center: { lat: 48, lon: 2 }, radius: 10 },
    ];
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await expect(page.getByTestId('layers-sidebar')).toContainText('AB');
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await page.getByTestId('assistant-settings-done').click();
}

test('selection, conversational corrections, preview, rename and targeted deletion use real map history', async ({
  page,
  blankProject,
}) => {
  await setupAssistantConstructions(page);
  let turn = 0;
  let action = 'create';
  let pointId = '';
  const requests: { instructions: string }[] = [];
  await page.route('https://api.openai.com/v1/responses', (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    turn++;
    const output =
      turn % 2 === 0
        ? [text('Done.')]
        : action === 'create'
          ? [
              call('create_point_on_line', {
                line_id: 'ab',
                name: 'Third',
                position: 1 / 3,
                unit: 'fraction',
                from_end: false,
              }),
            ]
          : action === 'move'
            ? [call('reverse_point_origin', { point_id: pointId })]
            : action === 'rename'
              ? [
                  call('rename_element', {
                    element_type: 'point',
                    element_id: pointId,
                    name: 'Repère',
                  }),
                ]
              : [call('delete_element', { element_type: 'circle', element_id: 'circle-c' })];
    return route.fulfill({ json: modelResponse(output) });
  });
  const data = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data);
  const send = async (value: string) => {
    await page.getByTestId('assistant-prompt').fill(value);
    await page.getByTestId('assistant-send').click();
  };
  await page.locator('[data-layer-id="ab"]').getByRole('button', { name: /^AB/ }).first().click();
  await expect(page.getByTestId('assistant-selection')).toContainText('AB');
  await send('Place un point au tiers de cette droite.');
  await expect(page.locator('.assistant-result')).toContainText('1 element(s)');
  expect(requests[0]!.instructions).toContain('"selection":[{"type":"lineSegment","id":"ab"');
  pointId = (await data()).points.find((p: { name: string }) => p.name === 'Third').id;
  await page.locator('.assistant-element-links').getByRole('button', { name: 'Third' }).click();
  action = 'move';
  await send('Depuis l’autre extrémité plutôt.');
  await expect(page.getByTestId('assistant-preview')).toBeVisible();
  expect(
    (await data()).points.find((p: { id: string }) => p.id === pointId).coordinates.lon
  ).toBeCloseTo(4, 6);
  expect(requests[2]!.instructions).toContain('"recent":[{"type":"point","id":"' + pointId);
  await page
    .getByTestId('assistant-preview')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.getByTestId('assistant-preview')).not.toBeVisible();
  await send('Depuis l’autre extrémité plutôt.');
  await page.getByTestId('assistant-apply').click();
  await expect
    .poll(
      async () =>
        (await data()).points.find((p: { id: string }) => p.id === pointId).coordinates.lon
    )
    .toBeCloseTo(6, 6);
  action = 'rename';
  await send('Renomme-le Repère.');
  await expect(page.getByTestId('layers-sidebar')).toContainText('Repère');
  expect((await data()).points.length).toBe(blankProject.data.points.length + 1);
  action = 'delete';
  await send('Annule seulement le cercle C.');
  await expect(page.getByTestId('assistant-preview')).toContainText('Delete Circle C');
  expect((await data()).circles).toHaveLength(1);
  await page.screenshot({ path: '/tmp/geochase-assistant-preview.png' });
  await page.getByTestId('assistant-apply').click();
  await expect.poll(async () => (await data()).circles.length).toBe(0);
  await page
    .getByTestId('assistant-panel')
    .getByRole('button', { name: 'Undo', exact: true })
    .click();
  await expect.poll(async () => (await data()).circles.length).toBe(1);
  // An external undo changes the baseline while a new deletion preview is open.
  await send('Supprime le cercle C.');
  await expect(page.getByTestId('assistant-preview')).toBeVisible();
  await page
    .getByTestId('assistant-panel')
    .getByRole('button', { name: 'Undo', exact: true })
    .click();
  await expect
    .poll(async () => (await data()).points.find((p: { id: string }) => p.id === pointId).name)
    .toBe('Third');
  await page.getByTestId('assistant-apply').click();
  await expect(page.getByTestId('assistant-error')).toContainText('project changed');
  await expect(page.getByTestId('assistant-preview')).not.toBeVisible();
  expect((await data()).circles).toHaveLength(1);
  await page.getByTestId('redo-btn').click();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Repère');
  await page.reload();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Repère');
});

test('ambiguity offers actual choices and passes the clicked ID to the next request', async ({
  page,
  blankProject,
}) => {
  await setupAssistantConstructions(page);
  let turn = 0;
  const requests: { instructions: string }[] = [];
  await page.route('https://api.openai.com/v1/responses', (route) => {
    requests.push(route.request().postDataJSON());
    turn++;
    return route.fulfill({
      json: modelResponse(
        turn === 1
          ? [
              call('choose_elements', {
                question: 'Which line?',
                elements: [
                  { element_type: 'lineSegment', element_id: 'ab' },
                  { element_type: 'lineSegment', element_id: 'cd' },
                ],
              }),
            ]
          : turn === 2
            ? [text('Which line?')]
            : turn === 3
              ? [
                  call('create_point_on_line', {
                    line_id: 'cd',
                    name: 'Middle CD',
                    position: 0.5,
                    unit: 'fraction',
                    from_end: false,
                  }),
                ]
              : [text('Middle created.')]
      ),
    });
  });
  await page.getByTestId('assistant-prompt').fill('Place a midpoint.');
  await page.getByTestId('assistant-send').click();
  const choices = page.getByTestId('assistant-choices');
  await expect(choices.getByRole('button')).toHaveCount(2);
  await choices.getByRole('button', { name: 'CD', exact: true }).hover();
  await choices.getByRole('button', { name: 'CD', exact: true }).click();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Middle CD');
  expect(requests[2]!.instructions).toContain('"selection":[{"type":"lineSegment","id":"cd"');
  expect(blankProject.id).toBeTruthy();
});

test('renaming a linked point preserves its line references, including after a combined move and construction', async ({
  page,
  blankProject,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('linked-point-seeded')) return;
    sessionStorage.setItem('linked-point-seeded', '1');
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].data.points.push({
      id: 'linked',
      name: 'Linked point',
      coordinates: { lat: 48, lon: 4 },
      lineId: 'ab',
    });
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await setupAssistantConstructions(page);
  // Seed the manual association on initial load, independently from AI construction metadata.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('linked-reference-seeded')) return;
    sessionStorage.setItem('linked-reference-seeded', '1');
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    projects[0].data.lineSegments.find((line: { id: string }) => line.id === 'ab').pointsOnLine = [
      'linked',
    ];
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await page.getByTestId('assistant-settings-done').click();
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', (route) => {
    turn++;
    return route.fulfill({
      json: modelResponse(
        turn === 1
          ? [
              call('rename_element', {
                element_type: 'point',
                element_id: 'linked',
                name: 'Renamed point',
              }),
            ]
          : turn === 3
            ? [
                call('reposition_point_on_line', {
                  point_id: 'linked',
                  line_id: 'ab',
                  position: 2 / 3,
                  unit: 'fraction',
                  from_end: false,
                }),
                call('create_line', {
                  start_point_id: 'linked',
                  end_point_id: 'point-3',
                  name: 'From corrected point',
                }),
              ]
            : [text('Done.')]
      ),
    });
  });
  const read = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data);
  await page.getByTestId('assistant-prompt').fill('Rename the linked point.');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Renamed point');
  expect(
    (await read()).lineSegments.find((l: { id: string }) => l.id === 'ab').pointsOnLine
  ).toContain('linked');
  await page
    .getByTestId('assistant-prompt')
    .fill('Move it to two thirds and connect it to Berlin.');
  await page.getByTestId('assistant-send').click();
  await page.getByTestId('assistant-apply').click();
  await expect.poll(async () => (await read()).lineSegments.length).toBe(3);
  const result = await read();
  const line = result.lineSegments.find((l: { name: string }) => l.name === 'From corrected point');
  expect(line.startPointId).toBe('linked');
  expect(line.endPointId).toBe('point-3');
  expect(line.center.lon).toBeCloseTo(6, 8);
  expect(result.points).toHaveLength(blankProject.data.points.length + 1);
  await page.reload();
  expect(
    (await read()).lineSegments.find((l: { id: string }) => l.id === line.id).startPointId
  ).toBe('linked');
});

test('a storage failure rolls the complete assistant action back and allows retry', async ({
  page,
  blankProject,
}) => {
  await setupAssistantConstructions(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = new Proxy(Storage.prototype.setItem, {
      apply(target, storage, args) {
        if (args[0] === 'geochase_projects' && Reflect.get(window, 'failAssistantSave')) {
          Reflect.set(window, 'failAssistantSave', false);
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }
        return Reflect.apply(target, storage, args);
      },
    });
  });
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', async (route) => {
    turn++;
    if (turn === 2) await page.evaluate(() => Reflect.set(window, 'failAssistantSave', true));
    return route.fulfill({
      json: modelResponse(
        turn % 2 === 1
          ? [
              call('create_point_on_line', {
                line_id: 'ab',
                name: 'Atomic point',
                position: 0.5,
                unit: 'fraction',
                from_end: false,
              }),
            ]
          : [text('Done.')]
      ),
    });
  });
  await page.getByTestId('assistant-prompt').fill('Place a midpoint.');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-error')).toContainText('Unable to save');
  await expect(page.getByTestId('layers-sidebar')).not.toContainText('Atomic point');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.points.length
    )
  ).toBe(blankProject.data.points.length);
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('layers-sidebar')).toContainText('Atomic point');
  await expect(page.getByTestId('assistant-error')).toHaveCount(0);
});

test('preview controls remain usable on a small screen and closing discards the preview', async ({
  page,
  blankProject,
}) => {
  await setupAssistantConstructions(page);
  await page.setViewportSize({ width: 390, height: 844 });
  let turn = 0;
  await page.route('https://api.openai.com/v1/responses', (route) => {
    turn++;
    return route.fulfill({
      json: modelResponse(
        turn === 1
          ? [call('resize_circle', { circle_id: 'circle-c', radius_km: 20 })]
          : [text('Radius change prepared.')]
      ),
    });
  });
  await page.getByTestId('assistant-prompt').fill('Change the circle radius to 20 km.');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-preview')).toBeVisible();
  const bounds = await page.getByTestId('assistant-apply').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: '/tmp/geochase-assistant-small-screen.png' });
  await page
    .getByTestId('assistant-panel')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(page.getByTestId('assistant-preview')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data.circles[0].radius
    )
  ).toBe(10);
  expect(blankProject.id).toBeTruthy();
});

test('a pasted image becomes an attachment sent with the request, pasted text stays text', async ({
  page,
  blankProject,
}) => {
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  const requests: Record<string, unknown>[] = [];
  await page.route('https://api.openai.com/v1/responses', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: modelResponse([text('I can see the image.')]) });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await page.getByTestId('assistant-settings-done').click();
  const prompt = page.getByTestId('assistant-prompt');
  // A 1×1 PNG, pasted like a screenshot from the clipboard.
  await prompt.evaluate((element) => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      ),
      (c) => c.codePointAt(0)!
    );
    const data = new DataTransfer();
    data.items.add(new File([png], 'image.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await expect(page.locator('.assistant-attachments')).toContainText('Pasted image.png');
  await expect(prompt).toHaveValue('');
  await prompt.fill('What is in this picture?');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-message.assistant')).toContainText('I can see the image.');
  const input = requests[0]!.input as { role?: string; content?: unknown }[];
  expect(input.findLast((item) => item.role === 'user')!.content).toContainEqual({
    type: 'input_image',
    image_url: expect.stringMatching(/^data:image\/png;base64,iVBOR/),
  });
  await prompt.evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'just text');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await expect(page.locator('form .assistant-attachments')).toHaveCount(0);
  expect(blankProject.id).toBeTruthy();
});

test('a pasted image is remembered for the next message and compared with real place photos', async ({
  page,
  blankProject,
}) => {
  await page.route('https://api.openai.com/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'gpt-5-mini' }] } })
  );
  await page.route('https://query.wikidata.org/sparql?**', (route) =>
    route.fulfill({
      json: {
        results: {
          bindings: [
            {
              itemLabel: { value: 'Paris' },
              image: { value: 'https://commons.wikimedia.org/wiki/Special:FilePath/Paris.jpg' },
              dist: { value: '0.02' },
            },
          ],
        },
      },
    })
  );
  await page.route('https://commons.wikimedia.org/w/api.php?**', (route) =>
    route.fulfill({
      json: {
        query: {
          pages: {
            1: {
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/thumb/Paris.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Paris.jpg',
                },
              ],
            },
          },
        },
      },
    })
  );
  await page.route('https://upload.wikimedia.org/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) })
  );
  const requests: Record<string, unknown>[] = [];
  await page.route('https://api.openai.com/v1/responses', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    const output =
      requests.length === 1
        ? [text('Noted.')]
        : requests.length === 2
          ? [call('get_place_photos', { point_ids: ['point-1'] })]
          : [text('The pasted image looks like the photo of Paris.')];
    return route.fulfill({ json: modelResponse(output) });
  });
  await page.getByTestId('assistant-toggle').click();
  await page.getByTestId('assistant-key').locator('input').fill('sk-proj-e2e-fake');
  await page.getByTestId('assistant-connect').click();
  await page.getByTestId('assistant-settings-done').click();
  const prompt = page.getByTestId('assistant-prompt');
  await prompt.evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(
      new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'image.png', { type: 'image/png' })
    );
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await prompt.fill('Here is a church photo.');
  await page.getByTestId('assistant-send').click();
  await expect(page.getByTestId('assistant-remembered')).toContainText('1 earlier attachment');

  await prompt.fill('Which point looks like it?');
  await page.getByTestId('assistant-send').click();
  await expect(page.locator('.assistant-message.assistant').last()).toContainText(
    'looks like the photo of Paris'
  );
  type Item = { role?: string; type?: string; content?: unknown; output?: unknown };
  const second = requests[1]!.input as Item[];
  expect(second.findLast((item) => item.role === 'user')!.content).toContainEqual(
    expect.objectContaining({ type: 'input_image' })
  );
  const third = requests[2]!.input as Item[];
  const toolOutput = third.find((item) => item.type === 'function_call_output')!.output;
  expect(toolOutput).toContainEqual({
    type: 'input_image',
    image_url: 'data:image/jpeg;base64,/9j/2Q==',
  });
  await expect(page.locator('.assistant-sources a')).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Paris.jpg'
  );

  await page.getByTestId('assistant-remembered').getByRole('button').click();
  await expect(page.getByTestId('assistant-remembered')).toHaveCount(0);
  expect(blankProject.id).toBeTruthy();
});
