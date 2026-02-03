export function nowLocal() {
  return new Date();
}

const resolveLocalTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const parseDateInput = (value: Date | string) => {
  if (value instanceof Date) return value;
  const raw = value.trim();
  const dateOnlyIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyIso) {
    const [, y, m, d] = dateOnlyIso;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dateOnlyBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateOnlyBr) {
    const [, d, m, y] = dateOnlyBr;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(raw);
};

export function formatDateBR(date: Date | string) {
  const d = parseDateInput(date);
  return d.toLocaleDateString("pt-BR", {
    timeZone: resolveLocalTimeZone(),
  });
}

export function formatDateTimeBR(date: Date | string) {
  const d = parseDateInput(date);
  return d.toLocaleString("pt-BR", {
    timeZone: resolveLocalTimeZone(),
  });
}

export function formatDateLongBR(date: Date | string) {
  const d = parseDateInput(date);
  return d.toLocaleDateString("pt-BR", {
    timeZone: resolveLocalTimeZone(),
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function formatDateFullBR(date: Date | string) {
  const d = parseDateInput(date);
  return d.toLocaleDateString("pt-BR", {
    timeZone: resolveLocalTimeZone(),
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonthBR(date: Date | string) {
  const d = parseDateInput(date);
  return d.toLocaleDateString("pt-BR", {
    timeZone: resolveLocalTimeZone(),
    month: "long",
  });
}

export function toInputDate(d: Date) {
  const off = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - off * 60000);
  return adjusted.toISOString().slice(0, 10);
}
