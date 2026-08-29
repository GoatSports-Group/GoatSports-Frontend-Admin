import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { StorageRepository } from '@application/ports/persistence/storage.repository';
import { UploadVenueImageUseCase } from './upload-venue-image.usecase';

describe('UploadVenueImageUseCase', () => {
  it('lấy presigned URL rồi upload và chỉ trả temp objectKey', async () => {
    const repository = {
      getPresignedUrl: vi.fn().mockReturnValue(of([{
        uploadUrl: 'https://r2.test/upload',
        objectKey: 'temp/venues/owner/new.png'
      }])),
      uploadToPresignedUrl: vi.fn().mockReturnValue(of(void 0))
    } as unknown as StorageRepository;
    const useCase = new UploadVenueImageUseCase(repository);
    const file = new File(['image'], 'new.png', { type: 'image/png' });

    const objectKey = await firstValueFrom(useCase.execute(file));

    expect(repository.getPresignedUrl).toHaveBeenCalledWith('new.png', 'image/png', 'venues');
    expect(repository.uploadToPresignedUrl).toHaveBeenCalledWith('https://r2.test/upload', file);
    expect(objectKey).toBe('temp/venues/owner/new.png');
  });

  it('không tạo trạng thái upload thành công khi Storage Service thiếu presigned response', async () => {
    const repository = {
      getPresignedUrl: vi.fn().mockReturnValue(of([])),
      uploadToPresignedUrl: vi.fn()
    } as unknown as StorageRepository;
    const useCase = new UploadVenueImageUseCase(repository);
    const file = new File(['image'], 'new.png', { type: 'image/png' });

    await expect(firstValueFrom(useCase.execute(file))).rejects
      .toThrow('Không nhận được đường dẫn tải ảnh từ Storage Service.');
    expect(repository.uploadToPresignedUrl).not.toHaveBeenCalled();
  });
});
