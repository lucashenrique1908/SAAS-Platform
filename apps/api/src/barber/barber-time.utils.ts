import { BadRequestException } from '@nestjs/common';

const localFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

function partsAt(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function localDateTimeToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new BadRequestException('Use a valid local date and HH:mm time.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(nominal);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new BadRequestException('The local date does not exist.');
  }

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = localFormatter(timeZone);
  } catch {
    throw new BadRequestException('The organization time zone is invalid.');
  }

  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 3) {
    const sample = new Date(nominal + hours * 3_600_000);
    const local = partsAt(sample, formatter);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    offsets.add(localAsUtc - Math.floor(sample.getTime() / 1000) * 1000);
  }

  const matches = [...offsets]
    .map((offset) => new Date(nominal - offset))
    .filter((candidate) => {
      const local = partsAt(candidate, formatter);
      return (
        local.year === year &&
        local.month === month &&
        local.day === day &&
        local.hour === hour &&
        local.minute === minute
      );
    });
  if (matches.length !== 1) {
    throw new BadRequestException(
      matches.length === 0
        ? 'The selected local time does not exist because of a daylight-saving transition.'
        : 'The selected local time is ambiguous because of a daylight-saving transition.',
    );
  }
  return matches[0];
}

export function instantToLocalDateTime(instant: Date, timeZone: string) {
  const local = partsAt(instant, localFormatter(timeZone));
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${local.year}-${pad(local.month)}-${pad(local.day)}`,
    time: `${pad(local.hour)}:${pad(local.minute)}`,
  };
}

export function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
