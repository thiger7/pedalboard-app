import { expect, test } from '@playwright/test';

// ローカルモードをモックするヘルパー
async function mockLocalMode(page: import('@playwright/test').Page) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', mode: 'local' }),
    });
  });
  await page.route('**/api/input-files', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: ['test1.wav', 'test2.wav'] }),
    });
  });
}

test.describe('Pedalboard App', () => {
  test.beforeEach(async ({ page }) => {
    await mockLocalMode(page);
    await page.goto('/');
  });

  test('ページタイトルが表示される', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Pedalboard');
    await expect(page.locator('.app-header p')).toHaveText(
      'Guitar Effect Simulator',
    );
  });

  test('ファイル選択のセレクトボックスが表示される', async ({ page }) => {
    // Wait for files to load
    await page.waitForSelector('select#input-file', { timeout: 5000 });
    const select = page.locator('select#input-file');
    await expect(select).toBeVisible();
  });

  test('エフェクトボードが表示される', async ({ page }) => {
    await expect(page.locator('.effector-board')).toBeVisible();
    // At least one effect card should be visible
    await expect(page.locator('.effector-card').first()).toBeVisible();
  });

  test('Apply Effects ボタンが表示される', async ({ page }) => {
    const button = page.locator('button.process-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Apply Effects');
  });

  test('ファイル未選択時は Process ボタンが無効', async ({ page }) => {
    const button = page.locator('button.process-button');
    await expect(button).toBeDisabled();
  });

  test('Input/Output プレイヤーが表示される', async ({ page }) => {
    const audioPlayers = page.locator('.audio-player');
    await expect(audioPlayers).toHaveCount(2);
    await expect(
      page.locator('.audio-player-label', { hasText: 'Input' }),
    ).toBeVisible();
    await expect(
      page.locator('.audio-player-label', { hasText: 'Output' }),
    ).toBeVisible();
  });
});

test.describe('エフェクト操作', () => {
  test.beforeEach(async ({ page }) => {
    await mockLocalMode(page);
    await page.goto('/');
  });

  test('エフェクトをクリックでON/OFF切り替え', async ({ page }) => {
    const firstCard = page.locator('.effector-card').first();

    // Get initial state (check for LED indicator)
    const initialEnabled =
      (await firstCard.locator('.led-indicator.on').count()) > 0;

    // Click card to toggle
    await firstCard.click();

    // Verify state changed
    const newEnabled =
      (await firstCard.locator('.led-indicator.on').count()) > 0;
    expect(newEnabled).not.toBe(initialEnabled);
  });

  test('有効なエフェクトの数が表示される', async ({ page }) => {
    await expect(page.locator('.enabled-count')).toBeVisible();
  });
});

test.describe('音声処理フロー (Local Mode)', () => {
  test('処理前はダウンロードセクションが表示されない', async ({ page }) => {
    await mockLocalMode(page);
    await page.goto('/');

    const outputSection = page.locator('.output-section');
    await expect(outputSection).not.toBeVisible();
  });

  test('ファイル選択後に処理を実行し、ダウンロードリンクが表示される', async ({
    page,
  }) => {
    await mockLocalMode(page);

    // Process エンドポイントをモック
    await page.route('**/api/process', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          output_file: 'output.wav',
          download_url: '/api/audio/output.wav',
          effects_applied: ['Chorus'],
          input_normalized: 'input_norm.wav',
          output_normalized: 'output_norm.wav',
        }),
      });
    });

    await page.goto('/');

    // Wait for file list to load
    const select = page.locator('select#input-file');
    await expect(select).toBeVisible({ timeout: 5000 });

    // Wait for options to be populated
    await expect(select.locator('option:not([value=""])').first()).toBeAttached(
      { timeout: 5000 },
    );

    // Select the first available file
    const firstOption = await select
      .locator('option:not([value=""])')
      .first()
      .getAttribute('value');

    if (firstOption) {
      await select.selectOption(firstOption);

      // Enable at least one effect
      const firstCard = page.locator('.effector-card').first();
      const isEnabled =
        (await firstCard.locator('.led-indicator.on').count()) > 0;
      if (!isEnabled) {
        await firstCard.click();
      }

      // Click process button
      const processButton = page.locator('button.process-button');
      await expect(processButton).toBeEnabled();
      await processButton.click();

      // Wait for processing to complete
      await expect(processButton).toHaveText('Apply Effects', {
        timeout: 10000,
      });
      await expect(processButton).toBeEnabled();

      // ダウンロードセクションが表示される
      const outputSection = page.locator('.output-section');
      await expect(outputSection).toBeVisible();

      // ダウンロードリンクが正しい href を持つ
      const downloadLink = page.locator('.download-link');
      await expect(downloadLink).toBeVisible();
      await expect(downloadLink).toHaveAttribute(
        'href',
        /\/api\/audio\/output\.wav/,
      );
      await expect(downloadLink).toHaveAttribute('download', '');
    }
  });
});

test.describe('S3 モード (モック)', () => {
  test.beforeEach(async ({ page }) => {
    // Health エンドポイントをモックして S3 モードを返す
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', mode: 's3' }),
      });
    });
  });

  test('S3 モードでファイルアップロード UI が表示される', async ({ page }) => {
    await page.goto('/');

    // S3 モードではカスタムファイル選択ボタンが表示される
    const fileSelectButton = page.locator('.file-select-button');
    await expect(fileSelectButton).toBeVisible({ timeout: 5000 });

    // セレクトボックスは表示されない
    const select = page.locator('select#input-file');
    await expect(select).not.toBeVisible();
  });

  test('ファイル未アップロード時は Process ボタンが無効', async ({ page }) => {
    await page.goto('/');

    const button = page.locator('button.process-button');
    await expect(button).toBeDisabled();
  });

  test('ファイルアップロードと処理のフロー、ダウンロードリンクが表示される', async ({
    page,
  }) => {
    // Upload URL エンドポイントをモック
    await page.route('**/api/upload-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          upload_url: 'https://s3.example.com/upload',
          s3_key: 'input/mock-file.wav',
        }),
      });
    });

    // S3 PUT リクエストをモック
    await page.route('https://s3.example.com/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // S3 Process エンドポイントをモック（同期処理）
    await page.route('**/api/s3-process-sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          output_key: 'output/mock-output.wav',
          download_url: 'https://s3.example.com/output.wav',
          effects_applied: ['reverb'],
          input_normalized_url: 'https://s3.example.com/input_norm.wav',
          output_normalized_url: 'https://s3.example.com/output_norm.wav',
        }),
      });
    });

    await page.goto('/');

    // ファイルをアップロード（input は非表示だが setInputFiles は動作する）
    const fileInput = page.locator('input[type="file"]');

    // テスト用のダミーファイルを作成してアップロード
    await fileInput.setInputFiles({
      name: 'test.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF....WAVEfmt '),
    });

    // アップロード完了を待つ
    await expect(page.locator('text=test.wav')).toBeVisible({ timeout: 5000 });

    // エフェクトを有効化
    const firstCard = page.locator('.effector-card').first();
    const isEnabled =
      (await firstCard.locator('.led-indicator.on').count()) > 0;
    if (!isEnabled) {
      await firstCard.click();
    }

    // Process ボタンが有効になる
    const processButton = page.locator('button.process-button');
    await expect(processButton).toBeEnabled();

    // 処理を実行
    await processButton.click();

    // 処理完了を待つ
    await expect(processButton).toHaveText('Apply Effects', { timeout: 10000 });
    await expect(processButton).toBeEnabled();

    // ダウンロードセクションが表示される
    const outputSection = page.locator('.output-section');
    await expect(outputSection).toBeVisible();

    // ダウンロードリンクが S3 URL を持つ
    const downloadLink = page.locator('.download-link');
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute(
      'href',
      'https://s3.example.com/output.wav',
    );
    await expect(downloadLink).toHaveAttribute('download', '');
  });
});

test.describe('非同期処理フロー (S3 モード)', () => {
  test.beforeEach(async ({ page }) => {
    // Health エンドポイントをモックして S3 モードを返す
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', mode: 's3' }),
      });
    });
  });

  test('非同期処理でジョブが作成され、完了後にダウンロードリンクが表示される', async ({
    page,
  }) => {
    // Upload URL エンドポイントをモック
    await page.route('**/api/upload-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          upload_url: 'https://s3.example.com/upload',
          s3_key: 'input/mock-file.wav',
        }),
      });
    });

    // S3 PUT リクエストをモック
    await page.route('https://s3.example.com/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // S3 Process エンドポイントをモック（非同期レスポンス）
    await page.route('**/api/s3-process', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'job-async-123',
          status: 'pending',
        }),
      });
    });

    // ジョブステータスエンドポイントをモック
    let pollCount = 0;
    const completedJob = {
      job_id: 'job-async-123',
      status: 'completed',
      effect_chain: [{ name: 'Reverb' }],
      download_url: 'https://s3.example.com/output-async.wav',
      input_normalized_url: 'https://s3.example.com/input_norm.wav',
      output_normalized_url: 'https://s3.example.com/output_norm.wav',
      original_filename: 'test-async.wav',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:31:00Z',
    };

    await page.route('**/api/jobs/job-async-123', async (route) => {
      pollCount++;
      if (pollCount < 3) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            job_id: 'job-async-123',
            status: 'processing',
            effect_chain: [{ name: 'Reverb' }],
            original_filename: 'test-async.wav',
            created_at: '2024-01-15T10:30:00Z',
            updated_at: '2024-01-15T10:30:30Z',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(completedJob),
        });
      }
    });

    // バッチAPIをモック
    await page.route('**/api/jobs/batch', async (route) => {
      // pollCountが3以上なら完了状態を返す
      const status = pollCount >= 3 ? 'completed' : 'processing';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            status === 'completed'
              ? completedJob
              : {
                  job_id: 'job-async-123',
                  status: 'processing',
                  effect_chain: [{ name: 'Reverb' }],
                  original_filename: 'test-async.wav',
                  created_at: '2024-01-15T10:30:00Z',
                  updated_at: '2024-01-15T10:30:30Z',
                },
          ],
        }),
      });
    });

    await page.goto('/');

    // ファイルをアップロード（input は非表示だが setInputFiles は動作する）
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'test-async.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF....WAVEfmt '),
    });

    await expect(page.locator('text=test-async.wav')).toBeVisible({
      timeout: 5000,
    });

    // エフェクトを有効化
    const firstCard = page.locator('.effector-card').first();
    const isEnabled =
      (await firstCard.locator('.led-indicator.on').count()) > 0;
    if (!isEnabled) {
      await firstCard.click();
    }

    // 処理を実行
    const processButton = page.locator('button.process-button');
    await expect(processButton).toBeEnabled();
    await processButton.click();

    // ボタンがすぐに再び有効になる（真の非同期）
    await expect(processButton).toHaveText('Apply Effects', { timeout: 5000 });
    await expect(processButton).toBeEnabled();

    // 履歴パネルにジョブが表示される
    await expect(page.locator('.history-panel')).toBeVisible({
      timeout: 10000,
    });

    // ジョブが完了するまで待つ（ステータスがCompletedになる）
    await expect(page.locator('.status-badge.status-completed')).toBeVisible({
      timeout: 15000,
    });

    // 完了したジョブをクリックしてダウンロードリンクを取得
    await page.locator('.history-item').first().click();

    // ダウンロードリンクが表示される
    const downloadLink = page.locator('.download-link');
    await expect(downloadLink).toBeVisible({ timeout: 5000 });
    await expect(downloadLink).toHaveAttribute(
      'href',
      'https://s3.example.com/output-async.wav',
    );
  });

  test('非同期処理が失敗した場合、履歴パネルにFailedステータスが表示される', async ({
    page,
  }) => {
    const failedJob = {
      job_id: 'job-fail-123',
      status: 'failed',
      error_message: 'Audio processing failed: Invalid format',
      effect_chain: [{ name: 'Reverb' }],
      original_filename: 'test-fail.wav',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:31:00Z',
    };

    await page.route('**/api/upload-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          upload_url: 'https://s3.example.com/upload',
          s3_key: 'input/mock-file.wav',
        }),
      });
    });

    await page.route('https://s3.example.com/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.route('**/api/s3-process', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'job-fail-123',
          status: 'pending',
        }),
      });
    });

    await page.route('**/api/jobs/job-fail-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(failedJob),
      });
    });

    // バッチAPIをモック
    await page.route('**/api/jobs/batch', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [failedJob] }),
      });
    });

    await page.goto('/');

    // ファイルをアップロード（input は非表示だが setInputFiles は動作する）
    const fileInput = page.locator('input[type="file"]');

    await fileInput.setInputFiles({
      name: 'test-fail.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF....WAVEfmt '),
    });

    await expect(page.locator('text=test-fail.wav')).toBeVisible({
      timeout: 5000,
    });

    const firstCard = page.locator('.effector-card').first();
    const isEnabled =
      (await firstCard.locator('.led-indicator.on').count()) > 0;
    if (!isEnabled) {
      await firstCard.click();
    }

    const processButton = page.locator('button.process-button');
    await expect(processButton).toBeEnabled();
    await processButton.click();

    // ボタンがすぐに再び有効になる（真の非同期）
    await expect(processButton).toHaveText('Apply Effects', { timeout: 5000 });

    // 履歴パネルにジョブが表示され、Failedステータスが表示される
    await expect(page.locator('.history-panel')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('.status-badge.status-failed')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('text=Failed')).toBeVisible();
  });
});

test.describe('履歴パネル', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', mode: 's3' }),
      });
    });
  });

  test('履歴がある場合、履歴パネルが表示される', async ({ page }) => {
    // Session Storage に履歴を設定
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'pedalboard_job_ids',
        JSON.stringify(['job-history-1', 'job-history-2']),
      );
    });

    // Batch API をモック
    await page.route('**/api/jobs/batch', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            {
              job_id: 'job-history-1',
              status: 'completed',
              effect_chain: [{ name: 'Reverb' }, { name: 'Delay' }],
              download_url: 'https://s3.example.com/output1.wav',
              original_filename: 'my-audio.wav',
              created_at: '2024-01-15T10:30:00Z',
              updated_at: '2024-01-15T10:31:00Z',
            },
            {
              job_id: 'job-history-2',
              status: 'pending',
              effect_chain: [{ name: 'Chorus' }],
              original_filename: 'another-file.mp3',
              created_at: '2024-01-15T10:35:00Z',
              updated_at: '2024-01-15T10:35:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // 履歴パネルが表示される
    await expect(page.locator('.history-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.history-section-header h2')).toHaveText(
      'History',
    );

    // ファイル名が表示される
    await expect(
      page.locator('.history-item-filename', { hasText: 'my-audio.wav' }),
    ).toBeVisible();
    await expect(
      page.locator('.history-item-filename', { hasText: 'another-file.mp3' }),
    ).toBeVisible();

    // エフェクトが一覧表示される
    await expect(
      page.locator('.history-item-effects', { hasText: 'Reverb, Delay' }),
    ).toBeVisible();
    await expect(
      page.locator('.history-item-effects', { hasText: 'Chorus' }),
    ).toBeVisible();

    // ステータスバッジが表示される
    await expect(page.locator('.status-badge.status-completed')).toBeVisible();
    await expect(page.locator('.status-badge.status-pending')).toBeVisible();
  });

  test('完了したジョブをクリックするとダウンロードリンクが設定される', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'pedalboard_job_ids',
        JSON.stringify(['job-click-1']),
      );
    });

    await page.route('**/api/jobs/batch', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            {
              job_id: 'job-click-1',
              status: 'completed',
              effect_chain: [{ name: 'Distortion' }],
              download_url: 'https://s3.example.com/output-click.wav',
              input_normalized_url: 'https://s3.example.com/input_norm.wav',
              output_normalized_url: 'https://s3.example.com/output_norm.wav',
              original_filename: 'click-test.wav',
              created_at: '2024-01-15T10:30:00Z',
              updated_at: '2024-01-15T10:31:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    await expect(page.locator('.history-panel')).toBeVisible({ timeout: 5000 });

    // 完了したジョブをクリック（履歴パネル内のボタンを選択）
    await page
      .locator('.history-panel .history-item-effects', {
        hasText: 'Distortion',
      })
      .click();

    // ダウンロードセクションが表示される
    const outputSection = page.locator('.output-section');
    await expect(outputSection).toBeVisible({ timeout: 5000 });

    const downloadLink = page.locator('.download-link');
    await expect(downloadLink).toHaveAttribute(
      'href',
      'https://s3.example.com/output-click.wav',
    );
  });

  test('Refreshボタンで履歴を更新する', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'pedalboard_job_ids',
        JSON.stringify(['job-refresh-1']),
      );
    });

    let refreshCount = 0;
    await page.route('**/api/jobs/batch', async (route) => {
      refreshCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            {
              job_id: 'job-refresh-1',
              status: refreshCount === 1 ? 'processing' : 'completed',
              effect_chain: [{ name: 'Reverb' }],
              download_url:
                refreshCount === 1
                  ? undefined
                  : 'https://s3.example.com/output.wav',
              original_filename: 'audio-update.wav',
              created_at: '2024-01-15T10:30:00Z',
              updated_at: '2024-01-15T10:31:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    await expect(page.locator('.history-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Processing')).toBeVisible();

    // Refresh ボタンをクリック（history-actionsクラス内のボタンを指定）
    await page.locator('.history-actions button:has-text("Refresh")').click();

    // ステータスが更新される
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 5000 });
  });

  test('Clearボタンで履歴をクリアする', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'pedalboard_job_ids',
        JSON.stringify(['job-clear-1']),
      );
    });

    await page.route('**/api/jobs/batch', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [
            {
              job_id: 'job-clear-1',
              status: 'completed',
              effect_chain: [{ name: 'Reverb' }],
              original_filename: 'audio-remove.wav',
              created_at: '2024-01-15T10:30:00Z',
              updated_at: '2024-01-15T10:31:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    await expect(page.locator('.history-panel')).toBeVisible({ timeout: 5000 });

    // Clear ボタンをクリック（history-actionsクラス内のボタンを指定）
    await page.locator('.history-actions button:has-text("Clear")').click();

    // 履歴パネルが非表示になる（ジョブがなくなるため）
    await expect(page.locator('.history-panel')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('履歴がない場合、履歴パネルは表示されない', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.removeItem('pedalboard_job_ids');
    });

    await page.goto('/');

    // 履歴パネルが表示されない
    await expect(page.locator('.history-panel')).not.toBeVisible();
  });
});
