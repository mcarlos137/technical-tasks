import 'package:barcelona_explore/data/games_repository.dart';
import 'package:barcelona_explore/data/models.dart';

Game makeGame({
  required String id,
  required String date,
  required String time,
  String venue = 'Agapito Fernández',
  String organizer = 'Johnny C',
  int spots = 4,
  bool recorded = false,
  String format = '8v8',
}) => Game(
  id: id,
  date: DateTime.parse(date),
  startTime: time,
  endTime: time,
  durationMinutes: 60,
  venue: Venue(id: venue.toLowerCase(), name: venue),
  format: format,
  organizer: Organizer(id: organizer.toLowerCase(), displayName: organizer),
  spotsTotal: 16,
  spotsAvailable: spots,
  availability: spots == 0
      ? Availability.full
      : spots <= 2
      ? Availability.urgent
      : Availability.available,
  isRecorded: recorded,
  priceEur: 9.9,
);

/// Mirrors the API semantics on an in-memory list.
class FakeGamesRepository implements GamesRepository {
  FakeGamesRepository(this.all, {DateTime? today})
    : today = today ?? DateTime(2026, 8, 25);
  final List<Game> all;
  final DateTime today;
  int gamesCalls = 0;

  @override
  Future<DateTime> referenceDate() async => today;

  @override
  Future<List<Game>> games({
    DateTime? from,
    DateTime? to,
    int? minSpotsAvailable,
  }) async {
    gamesCalls++;
    return all
        .where((g) => from == null || !g.date.isBefore(from))
        .where((g) => to == null || !g.date.isAfter(to))
        .where(
          (g) =>
              minSpotsAvailable == null ||
              g.spotsAvailable >= minSpotsAvailable,
        )
        .toList()
      ..sort(
        (a, b) => a.date.compareTo(b.date) != 0
            ? a.date.compareTo(b.date)
            : a.startTime.compareTo(b.startTime),
      );
  }

  @override
  Future<Game?> game(String id) async =>
      all.where((g) => g.id == id).firstOrNull;
}

final sampleGames = [
  makeGame(
    id: 'a1',
    date: '2026-08-25',
    time: '21:15',
    venue: "L'Àliga",
    organizer: 'Diego P',
    spots: 0,
    format: '9v9',
  ),
  makeGame(
    id: 'a2',
    date: '2026-08-25',
    time: '21:55',
    organizer: 'Simón R',
    spots: 0,
  ),
  makeGame(
    id: 'b0',
    date: '2026-08-26',
    time: '07:15',
    venue: 'La Catalana',
    organizer: 'Roberto T',
    spots: 0,
    recorded: true,
  ),
  makeGame(id: 'b1', date: '2026-08-26', time: '09:15', spots: 2),
  makeGame(id: 'b2', date: '2026-08-26', time: '10:15', spots: 4),
  makeGame(
    id: 'b3',
    date: '2026-08-26',
    time: '18:45',
    venue: 'El Carmel',
    organizer: 'Eugenio R',
    spots: 3,
  ),
  makeGame(
    id: 'b4',
    date: '2026-08-26',
    time: '18:45',
    venue: 'El Carmel',
    organizer: 'Eugenio R',
    spots: 5,
  ),
  makeGame(
    id: 'b5',
    date: '2026-08-26',
    time: '20:00',
    venue: 'El Carmel',
    organizer: 'Eugenio R',
    spots: 6,
  ),
  makeGame(
    id: 'c1',
    date: '2026-08-27',
    time: '19:30',
    venue: 'La Catalana',
    organizer: 'Roberto T',
    spots: 6,
  ),
];
