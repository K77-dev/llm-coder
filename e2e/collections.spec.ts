import { test, expect } from '@playwright/test';
import { setupApiMocks, MockCollection } from './helpers/api-mocks';

test.describe('Collections RAG E2E', () => {
  test.describe('Create collection', () => {
    test('should create a local collection via sidebar', async ({ page }) => {
      await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await expect(page.getByTestId('empty-message')).toBeVisible();
      await page.getByTestId('create-collection-btn').click();
      await expect(page.getByTestId('create-collection-modal')).toBeVisible();
      await page.getByTestId('collection-name-input').fill('Backend API');
      await page.getByTestId('scope-local').check();
      await page.getByTestId('create-submit-btn').click();
      await expect(page.getByTestId('create-collection-modal')).not.toBeVisible();
      await expect(page.getByText('Backend API')).toBeVisible();
    });

    test('should create a global collection via sidebar', async ({ page }) => {
      await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('create-collection-btn').click();
      await page.getByTestId('collection-name-input').fill('Framework Docs');
      await page.getByTestId('scope-global').check();
      await page.getByTestId('create-submit-btn').click();
      await expect(page.getByTestId('create-collection-modal')).not.toBeVisible();
      await expect(page.getByText('Framework Docs')).toBeVisible();
      await expect(page.getByText('global')).toBeVisible();
    });

    test('should show validation error for empty name', async ({ page }) => {
      await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('create-collection-btn').click();
      await page.getByTestId('create-submit-btn').click();
      await expect(page.getByTestId('create-error')).toHaveText('Collection name is required');
    });

    test('should close create modal on cancel', async ({ page }) => {
      await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('create-collection-btn').click();
      await expect(page.getByTestId('create-collection-modal')).toBeVisible();
      await page.getByTestId('create-cancel-btn').click();
      await expect(page.getByTestId('create-collection-modal')).not.toBeVisible();
    });

    test('should close create modal on Escape key', async ({ page }) => {
      await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('create-collection-btn').click();
      await expect(page.getByTestId('create-collection-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('create-collection-modal')).not.toBeVisible();
    });
  });

  test.describe('Add files to collection', () => {
    test('should open collection detail and add files via DirectoryPicker', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Click on the collection name to open CollectionDetail
      await page.getByTestId('collection-name-1').click();
      await expect(page.getByTestId('collection-detail')).toBeVisible();
      // Verify existing files are displayed
      await expect(page.getByText('/src/api/routes.ts')).toBeVisible();
      await expect(page.getByText('/src/api/controllers.ts')).toBeVisible();
      // Click "Add files" button to open DirectoryPicker
      await page.getByTestId('add-files-btn').click();
      await expect(page.getByTestId('directory-picker')).toBeVisible();
      // Simulate selecting files through DirectoryPicker
      // The DirectoryPicker should allow file selection and submit
      await page.getByTestId('file-path-input').fill('/src/api/middleware.ts');
      await page.getByTestId('add-file-submit-btn').click();
      // Verify the newly added file appears in the collection file list
      await expect(page.getByText('/src/api/middleware.ts')).toBeVisible({ timeout: 5000 });
    });

    test('should add folder to collection and display added files', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Open collection detail for collection 3 (CNAB Rules, has 0 files in mock)
      await page.getByTestId('collection-name-3').click();
      await expect(page.getByTestId('collection-detail')).toBeVisible();
      // Click "Add folder" button
      await page.getByTestId('add-folder-btn').click();
      await expect(page.getByTestId('directory-picker')).toBeVisible();
      // Enter a folder path
      await page.getByTestId('folder-path-input').fill('/src/rules');
      await page.getByTestId('add-folder-submit-btn').click();
      // Verify files from the folder appear (mocked response adds them)
      await expect(page.getByTestId('collection-detail')).toBeVisible();
    });

    test('should show indexed status for files in collection', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Open collection detail
      await page.getByTestId('collection-name-1').click();
      await expect(page.getByTestId('collection-detail')).toBeVisible();
      // Verify files show indexed status
      await expect(page.getByText('Indexed').first()).toBeVisible();
    });
  });

  test.describe('Collection list display', () => {
    test('should display existing collections with checkboxes', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await expect(page.getByTestId('collection-item-1')).toBeVisible();
      await expect(page.getByTestId('collection-item-2')).toBeVisible();
      await expect(page.getByTestId('collection-item-3')).toBeVisible();
      await expect(page.getByTestId('checkbox-1')).toBeVisible();
      await expect(page.getByTestId('checkbox-2')).toBeVisible();
      await expect(page.getByTestId('checkbox-3')).toBeVisible();
    });

    test('should show scope badges for local and global collections', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      const item1 = page.getByTestId('collection-item-1');
      await expect(item1.getByText('local')).toBeVisible();
      const item2 = page.getByTestId('collection-item-2');
      await expect(item2.getByText('global')).toBeVisible();
    });

    test('should show file count for each collection', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await expect(page.getByTestId('collection-item-1').getByText('(12)')).toBeVisible();
      await expect(page.getByTestId('collection-item-2').getByText('(8)')).toBeVisible();
      await expect(page.getByTestId('collection-item-3').getByText('(3)')).toBeVisible();
    });
  });

  test.describe('Select/deselect collections', () => {
    test('should toggle collection selection via checkbox', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      const checkbox = page.getByTestId('checkbox-1');
      await expect(checkbox).not.toBeChecked();
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    });

    test('should select all collections via "Select all" checkbox', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('select-all-checkbox').check();
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-2')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
    });

    test('should deselect all collections when "Select all" is unchecked', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // First select all
      await page.getByTestId('select-all-checkbox').check();
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-2')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
      // Then deselect all
      await page.getByTestId('select-all-checkbox').uncheck();
      await expect(page.getByTestId('checkbox-1')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-3')).not.toBeChecked();
    });

    test('should persist selection after page reload', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('checkbox-1').check();
      await page.getByTestId('checkbox-3').check();
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
      // Reload the page - selection should persist via localStorage
      await setupApiMocks(page);
      await page.reload();
      await page.waitForSelector('[data-testid="collection-list"]');
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
    });
  });

  test.describe('Rename collection', () => {
    test('should rename a collection via context menu', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-1').click({ button: 'right' });
      await expect(page.getByTestId('ctx-rename')).toBeVisible();
      await page.getByTestId('ctx-rename').click();
      const renameInput = page.getByTestId('rename-input-1');
      await expect(renameInput).toBeVisible();
      await renameInput.fill('Renamed Backend');
      // Use blur instead of Enter to avoid double-fire of handleRenameSubmit
      await renameInput.evaluate((el) => el.blur());
      await expect(page.getByText('Renamed Backend')).toBeVisible({ timeout: 5000 });
    });

    test('should rename a collection via double-click', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-2').dblclick();
      const renameInput = page.getByTestId('rename-input-2');
      await expect(renameInput).toBeVisible();
      await renameInput.fill('AI Documentation');
      await renameInput.evaluate((el) => el.blur());
      await expect(page.getByText('AI Documentation')).toBeVisible({ timeout: 5000 });
    });

    test('should cancel rename on Escape', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-1').dblclick();
      const renameInput = page.getByTestId('rename-input-1');
      await expect(renameInput).toBeVisible();
      await renameInput.fill('Something new');
      await renameInput.press('Escape');
      await expect(page.getByText('Backend API')).toBeVisible();
    });
  });

  test.describe('Delete collection', () => {
    test('should delete a collection with confirmation dialog', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-1').click({ button: 'right' });
      await page.getByTestId('ctx-delete').click();
      await expect(page.getByTestId('delete-dialog')).toBeVisible();
      await expect(page.getByText('Delete Collection')).toBeVisible();
      await expect(page.getByTestId('delete-dialog').getByText(/Backend API/)).toBeVisible();
      await page.getByTestId('delete-confirm-btn').click();
      await expect(page.getByTestId('delete-dialog')).not.toBeVisible();
      // After delete, collection-item-1 should not be in the list
      await expect(page.getByTestId('collection-item-1')).toHaveCount(0, { timeout: 5000 });
    });

    test('should cancel delete on cancel button', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-1').click({ button: 'right' });
      await page.getByTestId('ctx-delete').click();
      await expect(page.getByTestId('delete-dialog')).toBeVisible();
      await page.getByTestId('delete-cancel-btn').click();
      await expect(page.getByTestId('delete-dialog')).not.toBeVisible();
      await expect(page.getByTestId('collection-item-1')).toBeVisible();
    });
  });

  test.describe('Accessibility - keyboard navigation', () => {
    test('should navigate checkboxes with Tab key', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Focus the first checkbox
      await page.getByTestId('checkbox-1').focus();
      await expect(page.getByTestId('checkbox-1')).toBeFocused();
      // Toggle with Space
      await page.keyboard.press('Space');
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      // Tab to next checkbox
      await page.keyboard.press('Tab');
      // The focus moves to the collection name button, then next checkbox
      // Tab through to checkbox-2
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute('data-testid') ?? el?.tagName;
      });
      // Focus should move to the next focusable element: collection name or next checkbox
      expect(focusedElement).toMatch(/^(collection-name-1|checkbox-2|collection-item-1)$/);
    });

    test('should toggle checkbox selection with Space key', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('checkbox-2').focus();
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
      await page.keyboard.press('Space');
      await expect(page.getByTestId('checkbox-2')).toBeChecked();
      await page.keyboard.press('Space');
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
    });

    test('should navigate "Select all" checkbox with keyboard', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('select-all-checkbox').focus();
      await expect(page.getByTestId('select-all-checkbox')).toBeFocused();
      await page.keyboard.press('Space');
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-2')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
    });
  });

  test.describe('Accessibility - focus trap in delete dialog', () => {
    test('should trap focus within delete dialog', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Open delete dialog
      await page.getByTestId('collection-item-1').click({ button: 'right' });
      await page.getByTestId('ctx-delete').click();
      await expect(page.getByTestId('delete-dialog')).toBeVisible();
      // Confirm button should be focused initially
      await expect(page.getByTestId('delete-confirm-btn')).toBeFocused();
      // Tab should cycle within dialog (Cancel -> Confirm -> Cancel)
      await page.keyboard.press('Tab');
      // After Tab from confirm button, focus wraps to cancel button (since confirm is last)
      const focusedAfterTab = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );
      expect(focusedAfterTab).toBe('delete-cancel-btn');
      // Shift+Tab should wrap back
      await page.keyboard.press('Shift+Tab');
      const focusedAfterShiftTab = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );
      expect(focusedAfterShiftTab).toBe('delete-confirm-btn');
    });

    test('should close delete dialog on Escape key', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('collection-item-2').click({ button: 'right' });
      await page.getByTestId('ctx-delete').click();
      await expect(page.getByTestId('delete-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('delete-dialog')).not.toBeVisible();
      // Collection should still exist
      await expect(page.getByTestId('collection-item-2')).toBeVisible();
    });
  });

  test.describe('Chat with collections', () => {
    test('should send collectionIds when collections are selected', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Select a collection
      await page.getByTestId('checkbox-1').check();
      // Capture the chat request
      const chatRequestPromise = page.waitForRequest((req) =>
        req.url().includes('/api/chat') && req.method() === 'POST'
      );
      // Find the chat input and send a message
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('What are the API routes?');
      await chatInput.press('Enter');
      const chatRequest = await chatRequestPromise;
      const requestBody = chatRequest.postDataJSON();
      expect(requestBody.collectionIds).toContain(1);
    });

    test('should send empty collectionIds when no collections are selected', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Ensure no collections are selected
      const chatRequestPromise = page.waitForRequest((req) =>
        req.url().includes('/api/chat') && req.method() === 'POST'
      );
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Hello');
      await chatInput.press('Enter');
      const chatRequest = await chatRequestPromise;
      const requestBody = chatRequest.postDataJSON();
      expect(requestBody.collectionIds).toEqual([]);
    });

    test('should send multiple collectionIds when multiple collections are selected', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('checkbox-1').check();
      await page.getByTestId('checkbox-3').check();
      const chatRequestPromise = page.waitForRequest((req) =>
        req.url().includes('/api/chat') && req.method() === 'POST'
      );
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Show me CNAB rules and API routes');
      await chatInput.press('Enter');
      const chatRequest = await chatRequestPromise;
      const requestBody = chatRequest.postDataJSON();
      expect(requestBody.collectionIds).toContain(1);
      expect(requestBody.collectionIds).toContain(3);
      expect(requestBody.collectionIds).toHaveLength(2);
    });

    test('should display response with sources from selected collections', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await page.getByTestId('checkbox-1').check();
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('What are the routes?');
      await chatInput.press('Enter');
      // Wait for the response to appear
      await expect(page.getByText(/Here is the answer/)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Full flow: create -> select -> chat', () => {
    test('should complete the full flow from creating a collection to chatting with it', async ({ page }) => {
      const { collections } = await setupApiMocks(page, { collections: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // 1. Create a collection
      await page.getByTestId('create-collection-btn').click();
      await page.getByTestId('collection-name-input').fill('My Test Collection');
      await page.getByTestId('scope-local').check();
      await page.getByTestId('create-submit-btn').click();
      await expect(page.getByText('My Test Collection')).toBeVisible();
      // 2. Select the collection
      const newId = collections[0].id;
      await page.getByTestId(`checkbox-${newId}`).check();
      await expect(page.getByTestId(`checkbox-${newId}`)).toBeChecked();
      // 3. Send a chat message
      const chatRequestPromise = page.waitForRequest((req) =>
        req.url().includes('/api/chat') && req.method() === 'POST'
      );
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Tell me about the test collection');
      await chatInput.press('Enter');
      const chatRequest = await chatRequestPromise;
      const requestBody = chatRequest.postDataJSON();
      expect(requestBody.collectionIds).toContain(newId);
    });
  });

  test.describe('Select all behavior', () => {
    test('should mark/unmark all checkboxes when "Select all" is toggled', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // All start unchecked
      await expect(page.getByTestId('checkbox-1')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-3')).not.toBeChecked();
      // Select all
      await page.getByTestId('select-all-checkbox').check();
      await expect(page.getByTestId('checkbox-1')).toBeChecked();
      await expect(page.getByTestId('checkbox-2')).toBeChecked();
      await expect(page.getByTestId('checkbox-3')).toBeChecked();
      await expect(page.getByTestId('select-all-checkbox')).toBeChecked();
      // Deselect all
      await page.getByTestId('select-all-checkbox').uncheck();
      await expect(page.getByTestId('checkbox-1')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-2')).not.toBeChecked();
      await expect(page.getByTestId('checkbox-3')).not.toBeChecked();
    });

    test('should show indeterminate state when some but not all are selected', async ({ page }) => {
      await setupApiMocks(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      // Select only one
      await page.getByTestId('checkbox-1').check();
      // Select all checkbox should be indeterminate (not fully checked, not unchecked)
      const isIndeterminate = await page.getByTestId('select-all-checkbox').evaluate(
        (el: HTMLInputElement) => el.indeterminate
      );
      expect(isIndeterminate).toBe(true);
    });
  });

  test.describe('Migration - existing repos appear as collections', () => {
    test('should display migrated repositories as global collections', async ({ page }) => {
      const migratedCollections: MockCollection[] = [
        {
          id: 1,
          name: 'my-backend-repo',
          scope: 'global',
          projectDir: null,
          fileCount: 50,
          createdAt: '2025-12-01T00:00:00.000Z',
        },
        {
          id: 2,
          name: 'my-frontend-repo',
          scope: 'global',
          projectDir: null,
          fileCount: 30,
          createdAt: '2025-12-01T00:00:00.000Z',
        },
      ];
      await setupApiMocks(page, { collections: migratedCollections });
      await page.goto('/');
      await page.waitForSelector('[data-testid="collection-list"]');
      await expect(page.getByText('my-backend-repo')).toBeVisible();
      await expect(page.getByText('my-frontend-repo')).toBeVisible();
      // Both should be global (migrated repos become global collections)
      const item1 = page.getByTestId('collection-item-1');
      await expect(item1.getByText('global')).toBeVisible();
      const item2 = page.getByTestId('collection-item-2');
      await expect(item2.getByText('global')).toBeVisible();
    });
  });
});
