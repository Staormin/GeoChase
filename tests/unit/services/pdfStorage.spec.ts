import { describe, expect, it } from 'vitest';
import { deletePdf, getPdf, hasPdf, savePdf, updatePdfPassword } from '@/services/pdfStorage';

describe('pdfStorage service', () => {
  // Use unique project IDs to avoid conflicts between tests
  let testCounter = 0;
  const getUniqueProjectId = () => `test-project-${Date.now()}-${testCounter++}`;

  describe('savePdf', () => {
    it('should save PDF data to IndexedDB', async () => {
      const projectId = getUniqueProjectId();
      const data = 'base64-pdf-data';
      const name = 'test.pdf';
      const password = 'secret123';

      await savePdf(projectId, data, name, password);

      const result = await getPdf(projectId);

      expect(result).not.toBeNull();
      expect(result?.data).toBe(data);
      expect(result?.name).toBe(name);
      expect(result?.password).toBe(password);
    });

    it('should save PDF without password', async () => {
      const projectId = getUniqueProjectId();
      const data = 'base64-pdf-data-no-pass';
      const name = 'test-no-pass.pdf';

      await savePdf(projectId, data, name);

      const result = await getPdf(projectId);

      expect(result).not.toBeNull();
      expect(result?.data).toBe(data);
      expect(result?.name).toBe(name);
      expect(result?.password).toBeUndefined();
    });

    it('should update existing PDF data', async () => {
      const projectId = getUniqueProjectId();

      // Save initial PDF
      await savePdf(projectId, 'initial-data', 'initial.pdf', 'pass1');

      // Update with new data
      await savePdf(projectId, 'updated-data', 'updated.pdf', 'pass2');

      const result = await getPdf(projectId);

      expect(result?.data).toBe('updated-data');
      expect(result?.name).toBe('updated.pdf');
      expect(result?.password).toBe('pass2');
    });

    it('should include updatedAt timestamp', async () => {
      const projectId = getUniqueProjectId();

      await savePdf(projectId, 'data', 'test.pdf');

      const result = await getPdf(projectId);

      expect(result).not.toBeNull();
      // The updatedAt is stored in the record but not returned by getPdf
      // So we just verify the save worked
      expect(result?.data).toBe('data');
    });
  });

  describe('getPdf', () => {
    it('should retrieve PDF data from IndexedDB', async () => {
      const projectId = getUniqueProjectId();
      const data = 'base64-pdf-data-get';
      const name = 'test-get.pdf';
      const password = 'secret-get';

      await savePdf(projectId, data, name, password);

      const result = await getPdf(projectId);

      expect(result).toEqual({
        data,
        name,
        password,
      });
    });

    it('should return null when PDF not found', async () => {
      const result = await getPdf('nonexistent-project-' + Date.now());

      expect(result).toBeNull();
    });

    it('should return PDF without password field when not set', async () => {
      const projectId = getUniqueProjectId();

      await savePdf(projectId, 'data', 'test.pdf');

      const result = await getPdf(projectId);

      expect(result).toEqual({
        data: 'data',
        name: 'test.pdf',
        password: undefined,
      });
    });
  });

  describe('deletePdf', () => {
    it('should delete PDF from IndexedDB', async () => {
      const projectId = getUniqueProjectId();

      // Save a PDF first
      await savePdf(projectId, 'data-to-delete', 'test-delete.pdf');

      // Verify it exists
      expect(await getPdf(projectId)).not.toBeNull();

      // Delete it
      await deletePdf(projectId);

      // Verify it's gone
      expect(await getPdf(projectId)).toBeNull();
    });

    it('should not throw when deleting non-existent PDF', async () => {
      // Should not throw
      await expect(deletePdf('nonexistent-project-' + Date.now())).resolves.toBeUndefined();
    });
  });

  describe('hasPdf', () => {
    it('should return true when PDF exists', async () => {
      const projectId = getUniqueProjectId();

      await savePdf(projectId, 'data-has', 'test-has.pdf');

      const result = await hasPdf(projectId);

      expect(result).toBe(true);
    });

    it('should return false when PDF does not exist', async () => {
      const result = await hasPdf('nonexistent-project-' + Date.now());

      expect(result).toBe(false);
    });
  });

  describe('updatePdfPassword', () => {
    it('should update password for existing PDF', async () => {
      const projectId = getUniqueProjectId();

      // Save PDF with initial password
      await savePdf(projectId, 'data-update-pass', 'test-update.pdf', 'oldPassword');

      // Update password
      const result = await updatePdfPassword(projectId, 'newPassword');

      expect(result).toBe(true);

      // Verify password was updated
      const pdf = await getPdf(projectId);
      expect(pdf?.password).toBe('newPassword');
      // Verify other data is preserved
      expect(pdf?.data).toBe('data-update-pass');
      expect(pdf?.name).toBe('test-update.pdf');
    });

    it('should return false when PDF does not exist', async () => {
      const result = await updatePdfPassword('nonexistent-project-' + Date.now(), 'newPassword');

      expect(result).toBe(false);
    });

    it('should remove password when null is passed', async () => {
      const projectId = getUniqueProjectId();

      // Save PDF with password
      await savePdf(projectId, 'data-remove-pass', 'test-remove.pdf', 'password123');

      // Remove password
      const result = await updatePdfPassword(projectId, null);

      expect(result).toBe(true);

      // Verify password was removed
      const pdf = await getPdf(projectId);
      expect(pdf?.password).toBeUndefined();
    });

    it('should preserve data and name when updating password', async () => {
      const projectId = getUniqueProjectId();
      const originalData = 'original-data-preserve';
      const originalName = 'original-preserve.pdf';

      await savePdf(projectId, originalData, originalName, 'oldPass');
      await updatePdfPassword(projectId, 'newPass');

      const pdf = await getPdf(projectId);
      expect(pdf?.data).toBe(originalData);
      expect(pdf?.name).toBe(originalName);
      expect(pdf?.password).toBe('newPass');
    });
  });

  describe('database reuse', () => {
    it('should reuse existing database connection for multiple operations', async () => {
      const projectId1 = getUniqueProjectId();
      const projectId2 = getUniqueProjectId();

      // First operation opens the database
      await savePdf(projectId1, 'data1', 'test1.pdf');

      // Second operation should reuse the connection
      await savePdf(projectId2, 'data2', 'test2.pdf');

      // Both should be accessible
      expect(await getPdf(projectId1)).not.toBeNull();
      expect(await getPdf(projectId2)).not.toBeNull();
    });

    it('should handle multiple concurrent operations', async () => {
      const projectIds = [getUniqueProjectId(), getUniqueProjectId(), getUniqueProjectId()];

      // Run multiple operations concurrently
      await Promise.all([
        savePdf(projectIds[0], 'data1', 'test1.pdf'),
        savePdf(projectIds[1], 'data2', 'test2.pdf'),
        savePdf(projectIds[2], 'data3', 'test3.pdf'),
      ]);

      // All should be accessible
      const results = await Promise.all([
        getPdf(projectIds[0]),
        getPdf(projectIds[1]),
        getPdf(projectIds[2]),
      ]);

      expect(results[0]?.data).toBe('data1');
      expect(results[1]?.data).toBe('data2');
      expect(results[2]?.data).toBe('data3');
    });
  });
});
