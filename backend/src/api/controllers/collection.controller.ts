import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CollectionService } from '../../services/collection-service';
import { DuplicateNameError, NotFoundError, ValidationError } from '../../services/collection-types';
import { getVectorsDb } from '../../db/sqlite-client';
import { AppError } from '../middleware/error';

const createCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.enum(['local', 'global']),
  projectDir: z.string().min(1).optional(),
});

const renameCollectionSchema = z.object({
  name: z.string().min(1).max(255),
});

const addFilesSchema = z.object({
  files: z.array(z.object({
    filePath: z.string().min(1),
    repo: z.string().min(1),
  })).min(1),
  repoBasePaths: z.record(z.string()).optional(),
});

let serviceInstance: CollectionService | null = null;

export function getService(): CollectionService {
  if (!serviceInstance) {
    serviceInstance = new CollectionService(getVectorsDb());
  }
  return serviceInstance;
}

export function resetService(): void {
  serviceInstance = null;
}

function parseId(idParam: string): number {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'Invalid collection ID');
  }
  return id;
}

function parseFileId(fileIdParam: string): number {
  const fileId = Number(fileIdParam);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    throw new AppError(400, 'Invalid file ID');
  }
  return fileId;
}

function handleServiceError(error: unknown, next: NextFunction): void {
  if (error instanceof AppError) {
    next(error);
    return;
  }
  if (error instanceof ValidationError) {
    next(new AppError(400, error.message));
    return;
  }
  if (error instanceof DuplicateNameError) {
    next(new AppError(422, error.message));
    return;
  }
  if (error instanceof NotFoundError) {
    next(new AppError(404, error.message));
    return;
  }
  next(error);
}

export function listCollections(req: Request, res: Response, next: NextFunction): void {
  try {
    const projectDir = req.query.projectDir as string | undefined;
    const service = getService();
    const collections = service.listCollections(projectDir);
    res.json(collections);
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function createCollection(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = createCollectionSchema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'Invalid request', result.error.issues));
      return;
    }
    const service = getService();
    const collection = service.createCollection(result.data);
    res.status(201).json(collection);
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function renameCollection(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const result = renameCollectionSchema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'Invalid request', result.error.issues));
      return;
    }
    const service = getService();
    const collection = service.renameCollection(id, result.data.name);
    res.json(collection);
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function deleteCollection(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const service = getService();
    service.deleteCollection(id);
    res.status(204).send();
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function listFiles(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const service = getService();
    const files = service.getFiles(id);
    res.json(files);
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function addFiles(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const result = addFilesSchema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'Invalid request', result.error.issues));
      return;
    }
    const service = getService();
    const repoBasePaths = result.data.repoBasePaths
      ? new Map(Object.entries(result.data.repoBasePaths))
      : undefined;
    service.addFiles(id, result.data.files, repoBasePaths);
    res.status(201).json({ message: 'Files added, indexing started' });
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function removeFile(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const fileId = parseFileId(req.params.fileId);
    const service = getService();
    service.removeFile(id, fileId);
    res.status(204).send();
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function reindexCollection(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const service = getService();
    service.reindexPendingFiles(id);
    res.json({ message: 'Reindex started for pending files' });
  } catch (error) {
    handleServiceError(error, next);
  }
}

export function getIndexingStatus(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseId(req.params.id);
    const service = getService();
    const { status, progress } = service.getIndexingStatus(id);
    res.json({ status, progress });
  } catch (error) {
    handleServiceError(error, next);
  }
}
