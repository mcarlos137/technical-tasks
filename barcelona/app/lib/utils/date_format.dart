const _weekdaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

String weekdayShort(DateTime d) => _weekdaysShort[d.weekday - 1];

/// "Today, Tue 25 August, 2026" / "Tomorrow, Wed 26 August, 2026" / "Thu 27 August, 2026".
String dayHeader(DateTime date, DateTime today) {
  final diff = dateOnly(date).difference(dateOnly(today)).inDays;
  final base =
      '${weekdayShort(date)} ${date.day} ${_months[date.month - 1]}, ${date.year}';
  return switch (diff) {
    0 => 'Today, $base',
    1 => 'Tomorrow, $base',
    _ => base,
  };
}

/// "Today" for the reference date, otherwise the short weekday ("Wed").
String dateTileLabel(DateTime date, DateTime today) =>
    dateOnly(date) == dateOnly(today) ? 'Today' : weekdayShort(date);

/// "07:15" -> "7:15", matching the design.
String displayTime(String hhmm) {
  final parts = hhmm.split(':');
  return '${int.parse(parts[0])}:${parts[1]}';
}

/// "€9.90" style price.
String formatPrice(double eur) => '€${eur.toStringAsFixed(2)}';
