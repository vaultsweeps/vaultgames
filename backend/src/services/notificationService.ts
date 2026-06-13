import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface NotificationData {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  link?: string
}

export const createNotification = async (userId: string, data: NotificationData) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        link: data.link,
      }
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

export const createBroadcastNotification = async (data: NotificationData) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, isBanned: false },
      select: { id: true }
    })

    const notifications = users.map(u => ({
      userId: u.id,
      title: data.title,
      message: data.message,
      type: (data.type || 'info') as any,
      link: data.link,
    }))

    return await prisma.notification.createMany({ data: notifications })
  } catch (error) {
    console.error('Failed to broadcast notification:', error)
  }
}
