/// Availability state computed server-side by the Games API.
enum Availability {
  urgent,
  available,
  full;

  static Availability parse(String value) => switch (value) {
    'URGENT' => Availability.urgent,
    'AVAILABLE' => Availability.available,
    'FULL' => Availability.full,
    _ => throw FormatException('Unknown availability "$value"'),
  };
}

class Venue {
  const Venue({required this.id, required this.name, this.address});
  final String id;
  final String name;
  final String? address;

  factory Venue.fromJson(Map<String, dynamic> j) => Venue(
    id: j['id'] as String,
    name: j['name'] as String,
    address: j['address'] as String?,
  );
}

class Organizer {
  const Organizer({
    required this.id,
    required this.displayName,
    this.avatarUrl,
  });
  final String id;
  final String displayName;
  final String? avatarUrl;

  factory Organizer.fromJson(Map<String, dynamic> j) => Organizer(
    id: j['id'] as String,
    displayName: j['displayName'] as String,
    avatarUrl: j['avatarUrl'] as String?,
  );
}

class Game {
  const Game({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.durationMinutes,
    required this.venue,
    required this.format,
    required this.organizer,
    required this.spotsTotal,
    required this.spotsAvailable,
    required this.availability,
    required this.isRecorded,
    required this.priceEur,
  });

  final String id;

  /// Local calendar date (time component is midnight).
  final DateTime date;

  /// Local kick-off time, "HH:mm".
  final String startTime;
  final String endTime;
  final int durationMinutes;
  final Venue venue;
  final String format;
  final Organizer organizer;
  final int spotsTotal;
  final int spotsAvailable;
  final Availability availability;
  final bool isRecorded;
  final double priceEur;

  factory Game.fromJson(Map<String, dynamic> j) => Game(
    id: j['id'] as String,
    date: DateTime.parse(j['date'] as String),
    startTime: j['startTime'] as String,
    endTime: j['endTime'] as String,
    durationMinutes: j['durationMinutes'] as int,
    venue: Venue.fromJson(j['venue'] as Map<String, dynamic>),
    format: j['format'] as String,
    organizer: Organizer.fromJson(j['organizer'] as Map<String, dynamic>),
    spotsTotal: j['spotsTotal'] as int,
    spotsAvailable: j['spotsAvailable'] as int,
    availability: Availability.parse(j['availability'] as String),
    isRecorded: j['isRecorded'] as bool,
    priceEur: (j['priceEur'] as num).toDouble(),
  );
}

/// Games that share a calendar date, in kick-off order.
class GameDay {
  const GameDay(this.date, this.games);
  final DateTime date;
  final List<Game> games;
}

List<GameDay> groupByDay(List<Game> games) {
  final map = <DateTime, List<Game>>{};
  for (final g in games) {
    map.putIfAbsent(g.date, () => []).add(g);
  }
  final days = map.entries.map((e) => GameDay(e.key, e.value)).toList()
    ..sort((a, b) => a.date.compareTo(b.date));
  return days;
}
