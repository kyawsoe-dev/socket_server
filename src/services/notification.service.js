const prisma = require("../config/prisma");

exports.getAll = async (userId) => {
    return await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
};

exports.getUnread = async (userId) => {
    return await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
};

exports.getUnreadCount = async (userId) => {
    return await prisma.notification.count({
        where: { userId, read: false },
    });
};

exports.markAsRead = async (userId, notificationId) => {
    const notif = await prisma.notification.findUnique({
        where: { id: notificationId },
    });

    if (!notif) throw new Error("Notification not found");
    if (notif.userId !== userId) throw new Error("Unauthorized");

    return await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
    });
};

exports.markAllAsRead = async (userId) => {
    return await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
    });
};