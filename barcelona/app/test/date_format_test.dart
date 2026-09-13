import 'package:barcelona_explore/utils/date_format.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final today = DateTime(2026, 8, 25);

  test('day headers use Today / Tomorrow prefixes like the design', () {
    expect(
      dayHeader(DateTime(2026, 8, 25), today),
      'Today, Tue 25 August, 2026',
    );
    expect(
      dayHeader(DateTime(2026, 8, 26), today),
      'Tomorrow, Wed 26 August, 2026',
    );
    expect(dayHeader(DateTime(2026, 8, 27), today), 'Thu 27 August, 2026');
  });

  test('date tile labels', () {
    expect(dateTileLabel(today, today), 'Today');
    expect(dateTileLabel(DateTime(2026, 8, 26), today), 'Wed');
  });

  test('times drop the leading zero', () {
    expect(displayTime('07:15'), '7:15');
    expect(displayTime('21:55'), '21:55');
  });
}
