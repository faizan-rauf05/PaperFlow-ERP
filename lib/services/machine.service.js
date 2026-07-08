import { prisma } from "@/lib/prisma";

export async function listMachines(filters = {}) {
  const where = {};
  if (filters.stageType) where.stageType = filters.stageType;
  if (filters.status) where.status = filters.status;

  return prisma.machine.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { downtimes: true } },
    },
  });
}

export async function createMachine(data) {
  return prisma.machine.create({
    data: {
      name: data.name,
      machineCode: data.machineCode,
      stageType: data.stageType,
      status: data.status || "ACTIVE",
    },
  });
}

export async function updateMachine(id, data) {
  return prisma.machine.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.machineCode && { machineCode: data.machineCode }),
      ...(data.stageType && { stageType: data.stageType }),
      ...(data.status && { status: data.status }),
    },
  });
}

export async function logDowntime({ machineId, reason, startTime, endTime, createdById }) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;
  let durationMin = null;
  if (end) {
    durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  }

  const record = await prisma.machineDowntime.create({
    data: {
      machineId,
      reason,
      startTime: start,
      endTime: end,
      durationMin,
      createdById: createdById || null,
    },
  });

  if (!end) {
    await prisma.machine.update({
      where: { id: machineId },
      data: { status: "DOWN" },
    });
  } else {
    await prisma.machine.update({
      where: { id: machineId },
      data: { status: "ACTIVE" },
    });
  }

  return record;
}

export async function getMachineDowntimes(machineId) {
  return prisma.machineDowntime.findMany({
    where: { machineId },
    orderBy: { startTime: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function getMachineEfficiency(machineId, from, to) {
  const downtimes = await prisma.machineDowntime.findMany({
    where: {
      machineId,
      startTime: { gte: from ? new Date(from) : undefined },
      endTime: { lte: to ? new Date(to) : undefined },
    },
  });

  const totalDowntimeMin = downtimes.reduce((sum, d) => sum + (d.durationMin || 0), 0);
  const periodMs = (to ? new Date(to) : new Date()).getTime() - (from ? new Date(from) : new Date(Date.now() - 86400000)).getTime();
  const availableMin = periodMs / 60000;
  const runningMin = Math.max(0, availableMin - totalDowntimeMin);
  const efficiency = availableMin > 0 ? (runningMin / availableMin) * 100 : 100;

  return {
    availableMin: Math.round(availableMin),
    downtimeMin: totalDowntimeMin,
    runningMin: Math.round(runningMin),
    efficiencyPercent: Math.round(efficiency * 100) / 100,
  };
}
