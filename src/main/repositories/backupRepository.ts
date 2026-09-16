import type { BackupStatus, BackupTrigger, Prisma } from '@prisma/client'
import { getPrisma } from '../db/client'

export function backupRepository() {
  const prisma = getPrisma()
  return {
    create: (data: {
      fileName: string
      filePath: string
      trigger: BackupTrigger
      createdByUserId?: string | null
      sizeBytes: number
      notes?: string | null
      status?: BackupStatus
      uploadedToDrive?: boolean
      driveFileId?: string | null
      errorMessage?: string | null
    }) =>
      prisma.backupRecord.create({
        data: {
          fileName: data.fileName,
          filePath: data.filePath,
          trigger: data.trigger,
          createdByUserId: data.createdByUserId ?? null,
          sizeBytes: data.sizeBytes,
          notes: data.notes ?? null,
          status: data.status ?? 'LOCAL',
          uploadedToDrive: data.uploadedToDrive ?? false,
          driveFileId: data.driveFileId ?? null,
          errorMessage: data.errorMessage ?? null
        },
        include: { createdBy: true }
      }),
    list: (take = 100) =>
      prisma.backupRecord.findMany({
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' },
        take
      }),
    latest: () =>
      prisma.backupRecord.findFirst({
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' }
      }),
    findById: (id: string) => prisma.backupRecord.findUnique({ where: { id } }),
    markDriveUpload: (id: string, driveFileId: string) =>
      prisma.backupRecord.update({
        where: { id },
        data: {
          status: 'UPLOADED',
          uploadedToDrive: true,
          driveFileId,
          driveUploadedAt: new Date(),
          errorMessage: null
        },
        include: { createdBy: true }
      }),
    markError: (id: string, errorMessage: string) =>
      prisma.backupRecord.update({
        where: { id },
        data: { status: 'ERROR', errorMessage }
      }),
    update: (id: string, data: Prisma.BackupRecordUpdateInput) =>
      prisma.backupRecord.update({ where: { id }, data })
  }
}
