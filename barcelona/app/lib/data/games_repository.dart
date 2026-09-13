import 'models.dart';

/// Read-only access to pick-up games. The app talks to this interface only,
/// so widgets can be tested with an in-memory fake.
abstract interface class GamesRepository {
  /// The dataset's fixed "today" (the mock data is built around 2026-08-25).
  Future<DateTime> referenceDate();

  /// Games between [from] and [to] inclusive (local calendar dates), ordered by kick-off.
  /// [minSpotsAvailable] = 1 hides full games.
  Future<List<Game>> games({
    DateTime? from,
    DateTime? to,
    int? minSpotsAvailable,
  });

  /// One game, or null when the id does not exist.
  Future<Game?> game(String id);
}
